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
import { getClient, IProjectPageService, CommonServiceIds, IHostPageLayoutService } from 'azure-devops-extension-api';
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

class AzureDevOpsService {
    private static instance: AzureDevOpsService;
    private projectId: string | null = null;
    private projectName: string | null = null;
    private initialized = false;
    private initError: string | null = null;

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

        try {
            console.log('[AzureDevOpsService] Initializing SDK...');
            await SDK.init();
            console.log('[AzureDevOpsService] SDK initialized, waiting for ready...');
            await SDK.ready();
            console.log('[AzureDevOpsService] SDK ready');

            const projectService = await SDK.getService<IProjectPageService>(
                CommonServiceIds.ProjectPageService
            );
            console.log('[AzureDevOpsService] Got project service');

            const project = await projectService.getProject();
            console.log('[AzureDevOpsService] Project:', project);

            if (project) {
                this.projectId = project.id;
                this.projectName = project.name;
                console.log(`[AzureDevOpsService] Project ID: ${this.projectId}, Name: ${this.projectName}`);
            } else {
                this.initError = 'Could not get project context. Make sure the extension is loaded within an Azure DevOps project.';
                console.error('[AzureDevOpsService] No project found');
            }

            this.initialized = true;
        } catch (error) {
            this.initError = `SDK initialization failed: ${error instanceof Error ? error.message : String(error)}`;
            console.error('[AzureDevOpsService] Initialization error:', error);
            throw error;
        }
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
            console.error('[AzureDevOpsService] Cannot get queries - no project ID');
            throw new Error('Project not found. ' + (this.initError || ''));
        }

        try {
            console.log(`[AzureDevOpsService] Fetching queries with depth ${depth}...`);
            const client = this.getWitClient();

            // Get both "Shared Queries" and "My Queries" folders
            const queries = await client.getQueries(this.projectId, QueryExpand.All, depth);
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
            const result = await client.queryById(queryId, this.projectId);

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

                const workItems = await client.getWorkItems(
                    batch,
                    this.projectId,
                    WORK_ITEM_FIELDS,
                    undefined, // asOf
                    undefined, // expand
                    undefined  // errorPolicy
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
            const result = await client.queryByWiql(
                { query: wiql },
                this.projectId
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
