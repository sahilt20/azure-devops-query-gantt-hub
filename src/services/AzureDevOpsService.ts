/**
 * Azure DevOps API Service
 * Handles all communication with Azure DevOps REST APIs
 */

import * as SDK from 'azure-devops-extension-sdk';
import {
    WorkItemTrackingRestClient,
    WorkItem,
    QueryHierarchyItem,
    WorkItemQueryResult,
    QueryExpand
} from 'azure-devops-extension-api/WorkItemTracking';
import { getClient, IProjectPageService, CommonServiceIds } from 'azure-devops-extension-api';
import { IQueryInfo } from '../models/WorkItemModels';

/**
 * Fields to fetch from work items
 */
const WORK_ITEM_FIELDS = [
    'System.Id',
    'System.Title',
    'System.WorkItemType',
    'System.State',
    'System.AssignedTo',
    'System.Parent',
    'System.IterationPath',
    'System.AreaPath',
    'Microsoft.VSTS.Scheduling.StartDate',
    'Microsoft.VSTS.Scheduling.TargetDate',
    'Microsoft.VSTS.Scheduling.FinishDate',
    'Microsoft.VSTS.Scheduling.Effort',
    'Microsoft.VSTS.Scheduling.StoryPoints',
    'Microsoft.VSTS.Scheduling.OriginalEstimate',
    'Microsoft.VSTS.Scheduling.RemainingWork',
    'Microsoft.VSTS.Scheduling.CompletedWork',
    'Microsoft.VSTS.Common.ClosedDate'
];

/**
 * Promise with timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

class AzureDevOpsService {
    private static instance: AzureDevOpsService;
    private projectId: string | null = null;
    private projectName: string | null = null;
    private initialized = false;
    private initError: string | null = null;
    private initPromise: Promise<void> | null = null;

    private constructor() { }

    public static getInstance(): AzureDevOpsService {
        if (!AzureDevOpsService.instance) {
            AzureDevOpsService.instance = new AzureDevOpsService();
        }
        return AzureDevOpsService.instance;
    }

    /**
     * Initialize the SDK and get project context
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        // Prevent multiple simultaneous initialization attempts
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        return this.initPromise;
    }

    private async doInitialize(): Promise<void> {
        try {
            console.log('[AzureDevOpsService] Starting SDK initialization...');

            // SDK.init() with timeout
            await withTimeout(
                SDK.init(),
                10000,
                'SDK.init() timed out after 10 seconds'
            );
            console.log('[AzureDevOpsService] SDK.init() complete');

            // SDK.ready() with timeout
            await withTimeout(
                SDK.ready(),
                10000,
                'SDK.ready() timed out after 10 seconds'
            );
            console.log('[AzureDevOpsService] SDK.ready() complete');

            // Get project service with timeout
            const projectService = await withTimeout(
                SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService),
                5000,
                'Failed to get ProjectPageService'
            );
            console.log('[AzureDevOpsService] Got ProjectPageService');

            // Get project with timeout
            const project = await withTimeout(
                projectService.getProject(),
                5000,
                'Failed to get project context'
            );
            console.log('[AzureDevOpsService] Project result:', project);

            if (project) {
                this.projectId = project.id;
                this.projectName = project.name;
                console.log(`[AzureDevOpsService] Connected to project: ${this.projectName} (${this.projectId})`);
            } else {
                this.initError = 'No project context found. Make sure you are viewing this extension within an Azure DevOps project.';
                console.warn('[AzureDevOpsService] No project found in context');
            }

            this.initialized = true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.initError = `SDK initialization failed: ${errorMsg}`;
            console.error('[AzureDevOpsService] Initialization error:', error);
            this.initialized = true; // Mark as initialized to prevent retries
            throw error;
        }
    }

    /**
     * Check if SDK is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get initialization error if any
     */
    public getInitError(): string | null {
        return this.initError;
    }

    /**
     * Get the Work Item Tracking REST client
     */
    private getWitClient(): WorkItemTrackingRestClient {
        return getClient(WorkItemTrackingRestClient);
    }

    /**
     * Get current project ID
     */
    public getProjectId(): string | null {
        return this.projectId;
    }

    /**
     * Get current project name
     */
    public getProjectName(): string | null {
        return this.projectName;
    }

    /**
     * Get all queries in the project
     */
    public async getQueries(depth: number = 5): Promise<IQueryInfo[]> {
        await this.initialize();

        if (!this.projectId) {
            const errorMsg = this.initError || 'Project not found';
            console.error('[AzureDevOpsService] Cannot get queries:', errorMsg);
            throw new Error(errorMsg);
        }

        try {
            console.log(`[AzureDevOpsService] Fetching queries for project ${this.projectName} with depth ${depth}...`);
            const client = this.getWitClient();

            // Get queries with timeout
            const queries = await withTimeout(
                client.getQueries(this.projectId, QueryExpand.All, depth),
                30000,
                'Query fetch timed out after 30 seconds'
            );

            console.log(`[AzureDevOpsService] Got ${queries.length} top-level query folders`);

            const flattenedQueries = this.flattenQueries(queries);
            console.log(`[AzureDevOpsService] Flattened to ${flattenedQueries.length} queries`);

            return flattenedQueries;
        } catch (error) {
            console.error('[AzureDevOpsService] Error fetching queries:', error);
            throw new Error(`Failed to fetch queries: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Flatten query hierarchy to a list
     */
    private flattenQueries(queries: QueryHierarchyItem[], path: string = ''): IQueryInfo[] {
        const result: IQueryInfo[] = [];

        for (const query of queries) {
            if (!query) continue;

            const currentPath = path ? `${path}/${query.name}` : query.name || 'Unknown';

            if (!query.isFolder && query.id) {
                // Determine query type from queryType enum
                let queryType: 'flat' | 'oneHop' | 'tree' = 'flat';
                if (query.queryType !== undefined) {
                    switch (query.queryType) {
                        case 1: queryType = 'flat'; break;
                        case 2: queryType = 'oneHop'; break;
                        case 3: queryType = 'tree'; break;
                        default: queryType = 'flat';
                    }
                }

                result.push({
                    id: query.id,
                    name: query.name || 'Unnamed Query',
                    path: currentPath,
                    queryType: queryType,
                    isFolder: false
                });
            }

            if (query.children && query.children.length > 0) {
                result.push(...this.flattenQueries(query.children, currentPath));
            }
        }

        return result;
    }

    /**
     * Execute a query and return work item IDs
     */
    public async executeQuery(queryId: string): Promise<WorkItemQueryResult> {
        await this.initialize();

        if (!this.projectId) {
            throw new Error('Project not found');
        }

        try {
            console.log(`[AzureDevOpsService] Executing query: ${queryId}`);
            const client = this.getWitClient();

            const result = await withTimeout(
                client.queryById(queryId, this.projectId),
                30000,
                'Query execution timed out'
            );

            const itemCount = result.workItems?.length || 0;
            const relationCount = result.workItemRelations?.length || 0;
            console.log(`[AzureDevOpsService] Query returned ${itemCount} items, ${relationCount} relations`);

            return result;
        } catch (error) {
            console.error('[AzureDevOpsService] Error executing query:', error);
            throw new Error(`Failed to execute query: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get work items by IDs with all required fields
     */
    public async getWorkItems(ids: number[]): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.projectId || ids.length === 0) {
            console.log('[AzureDevOpsService] getWorkItems: no project or empty ids');
            return [];
        }

        try {
            console.log(`[AzureDevOpsService] Fetching ${ids.length} work items...`);
            const client = this.getWitClient();

            // Azure DevOps API limits to 200 work items per request
            const batchSize = 200;
            const allWorkItems: WorkItem[] = [];

            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                console.log(`[AzureDevOpsService] Fetching batch ${Math.floor(i / batchSize) + 1}: ${batch.length} items`);

                const workItems = await withTimeout(
                    client.getWorkItems(
                        batch,
                        this.projectId,
                        WORK_ITEM_FIELDS,
                        undefined, // asOf
                        undefined, // expand
                        undefined  // errorPolicy
                    ),
                    30000,
                    'Work item fetch timed out'
                );

                // Filter out null items (deleted/inaccessible)
                const validItems = workItems.filter(wi => wi !== null);
                allWorkItems.push(...validItems);
            }

            console.log(`[AzureDevOpsService] Retrieved ${allWorkItems.length} work items`);
            return allWorkItems;
        } catch (error) {
            console.error('[AzureDevOpsService] Error fetching work items:', error);
            throw new Error(`Failed to fetch work items: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get work items with their relations/links
     */
    public async getWorkItemsWithRelations(ids: number[]): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.projectId || ids.length === 0) {
            return [];
        }

        try {
            const client = this.getWitClient();
            const batchSize = 200;
            const allWorkItems: WorkItem[] = [];

            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                const workItems = await client.getWorkItems(
                    batch,
                    this.projectId,
                    WORK_ITEM_FIELDS,
                    undefined,
                    4, // WorkItemExpand.Relations
                    undefined
                );
                const validItems = workItems.filter(wi => wi !== null);
                allWorkItems.push(...validItems);
            }

            return allWorkItems;
        } catch (error) {
            console.error('[AzureDevOpsService] Error fetching work items with relations:', error);
            throw error;
        }
    }

    /**
     * Execute a WIQL query directly
     */
    public async executeWiql(wiql: string): Promise<WorkItemQueryResult> {
        await this.initialize();

        if (!this.projectId) {
            throw new Error('Project not found');
        }

        try {
            console.log('[AzureDevOpsService] Executing WIQL query...');
            const client = this.getWitClient();
            const result = await withTimeout(
                client.queryByWiql({ query: wiql }, this.projectId),
                30000,
                'WIQL query timed out'
            );
            console.log(`[AzureDevOpsService] WIQL returned ${result.workItemRelations?.length || result.workItems?.length || 0} items`);
            return result;
        } catch (error) {
            console.error('[AzureDevOpsService] Error executing WIQL:', error);
            throw error;
        }
    }

    /**
     * Get all work items in hierarchy (Epic -> Feature -> PBI -> Task)
     */
    public async getHierarchicalWorkItems(): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.projectId) {
            throw new Error('Project not found');
        }

        // Query for all hierarchical work items - use simpler query first
        const wiql = `
            SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State]
            FROM WorkItems
            WHERE [System.TeamProject] = @project
                AND [System.WorkItemType] IN ('Epic', 'Feature', 'Product Backlog Item', 'User Story', 'Task', 'Bug')
                AND [System.State] <> 'Removed'
            ORDER BY [System.WorkItemType], [System.Id]
        `;

        try {
            console.log('[AzureDevOpsService] Fetching all hierarchical work items...');
            const result = await this.executeWiql(wiql);

            if (result.workItems && result.workItems.length > 0) {
                const ids = result.workItems.map(wi => wi.id);
                console.log(`[AzureDevOpsService] Found ${ids.length} work items to fetch`);
                return await this.getWorkItems(ids);
            }

            console.log('[AzureDevOpsService] No work items found');
            return [];
        } catch (error) {
            console.error('[AzureDevOpsService] Error in getHierarchicalWorkItems:', error);
            throw error;
        }
    }
}

export const azureDevOpsService = AzureDevOpsService.getInstance();
export default azureDevOpsService;
