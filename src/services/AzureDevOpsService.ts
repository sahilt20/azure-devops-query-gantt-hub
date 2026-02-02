/**
 * Azure DevOps API Service
 * Handles all communication with Azure DevOps REST APIs
 */

import * as SDK from 'azure-devops-extension-sdk';
import {
    QueryHierarchyItem,
    WorkItem,
    WorkItemQueryResult
} from 'azure-devops-extension-api/WorkItemTracking';
import { IProjectPageService, CommonServiceIds } from 'azure-devops-extension-api';
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
    private organization: string | null = null;
    private baseUrl: string | null = null;
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
     * Get the organization name
     */
    public getOrganization(): string | null {
        return this.organization;
    }

    /**
     * Get the project name
     */
    public getProjectName(): string | null {
        return this.projectName;
    }

    /**
     * Get URL to view/edit a work item
     */
    public getWorkItemUrl(workItemId: number): string {
        if (this.organization && this.projectName) {
            return `https://dev.azure.com/${this.organization}/${encodeURIComponent(this.projectName)}/_workitems/edit/${workItemId}`;
        }
        // Fallback if not initialized
        return `#work-item-${workItemId}`;
    }

    /**
     * Open a work item in a new tab
     */
    public openWorkItem(workItemId: number): void {
        const url = this.getWorkItemUrl(workItemId);
        if (url.startsWith('http')) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Initialize the SDK and get project context
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this.doInitialize();
        return this.initPromise;
    }

    private async doInitialize(): Promise<void> {
        try {
            console.log('[AzureDevOpsService] Starting SDK initialization...');

            await SDK.init();
            console.log('[AzureDevOpsService] SDK.init() complete');

            await SDK.ready();
            console.log('[AzureDevOpsService] SDK.ready() complete');

            // Get host (organization)
            const host = SDK.getHost();
            this.organization = host.name;
            console.log(`[AzureDevOpsService] Host: ${host.name} (${host.id})`);

            const projectService = await SDK.getService<IProjectPageService>(CommonServiceIds.ProjectPageService);
            console.log('[AzureDevOpsService] Got ProjectPageService');

            const project = await projectService.getProject();
            console.log('[AzureDevOpsService] Project result:', project);

            if (project) {
                this.projectId = project.id;
                this.projectName = project.name;
                // Construct base URL: https://dev.azure.com/{org}/{project}/_apis
                this.baseUrl = `https://dev.azure.com/${this.organization}/${this.projectId}/_apis`;
                console.log(`[AzureDevOpsService] Connected to project: ${this.projectName} (${this.projectId})`);
                console.log(`[AzureDevOpsService] API Base URL: ${this.baseUrl}`);
            } else {
                this.initError = 'No project context found. Make sure you are viewing this extension within an Azure DevOps project.';
                console.warn('[AzureDevOpsService] No project found in context');
            }

            // Test Access Token acquisition
            console.log('[AzureDevOpsService] Testing access token acquisition...');
            const token = await SDK.getAccessToken();
            console.log(`[AzureDevOpsService] Access token acquired: ${token ? 'Yes (Length: ' + token.length + ')' : 'No'}`);

            this.initialized = true;
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.initError = `SDK initialization failed: ${errorMsg}`;
            console.error('[AzureDevOpsService] Initialization error:', error);
            this.initialized = true;
            throw error;
        }
    }

    /**
     * Helper to make authenticated API requests using fetch
     */
    private async makeApiRequest<T>(url: string, method: string = 'GET', body?: any): Promise<T> {
        const token = await SDK.getAccessToken();
        if (!token) throw new Error('No access token available');

        const headers: HeadersInit = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error ${response.status}: ${response.statusText} - ${text}`);
        }

        return response.json();
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
     * Get current project ID
     */
    public getProjectId(): string | null {
        return this.projectId;
    }

    /**
     * Get all queries in the project using REST API
     */
    public async getQueries(): Promise<IQueryInfo[]> {
        await this.initialize();
        if (!this.baseUrl) {
            console.error('[AzureDevOpsService] Cannot get queries: No base URL');
            return [];
        }

        try {
            console.log('[AzureDevOpsService] Fetching queries via REST...');
            // Get root folders with depth 2 to see Shared/My Queries and their children
            const url = `${this.baseUrl}/wit/queries?api-version=7.0&$depth=2&$expand=all`;

            console.log(`[AzureDevOpsService] GET ${url}`);
            const result = await this.makeApiRequest<{ value: QueryHierarchyItem[] }>(url);

            console.log(`[AzureDevOpsService] Got ${result.value?.length || 0} root items`);
            const flattened = this.flattenQueries(result.value || []);
            return flattened;
        } catch (error) {
            console.error('[AzureDevOpsService] Error fetching queries:', error);
            return [];
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

            // Add non-folder queries
            if (!query.isFolder && query.id) {
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

            // Recursively process children
            if (query.children && query.children.length > 0) {
                result.push(...this.flattenQueries(query.children, currentPath));
            }
        }

        return result;
    }

    /**
     * Execute query using REST API (via WIQL endpoint)
     */
    public async executeQuery(queryId: string): Promise<WorkItemQueryResult> {
        await this.initialize();
        if (!this.baseUrl) throw new Error('No project context');

        try {
            console.log(`[AzureDevOpsService] Executing Query ${queryId} via REST...`);
            // To execute a stored query, we actually use the GET /wit/wiql/{id} endpoint
            const url = `${this.baseUrl}/wit/wiql/${queryId}?api-version=7.0`;

            const result = await this.makeApiRequest<WorkItemQueryResult>(url);
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
     * Execute a WIQL query using REST API
     */
    public async executeWiql(wiql: string): Promise<WorkItemQueryResult> {
        await this.initialize();
        if (!this.baseUrl) throw new Error('No project context');

        try {
            console.log('[AzureDevOpsService] Executing WIQL via REST...');
            const url = `${this.baseUrl}/wit/wiql?api-version=7.0`;
            const result = await this.makeApiRequest<WorkItemQueryResult>(url, 'POST', { query: wiql });
            console.log(`[AzureDevOpsService] WIQL result: ${result.workItems?.length || result.workItemRelations?.length || 0} items`);
            return result;
        } catch (error) {
            console.error('[AzureDevOpsService] Error executing WIQL:', error);
            throw error;
        }
    }

    /**
     * Get work items by IDs using REST API batch
     */
    public async getWorkItems(ids: number[]): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.baseUrl || ids.length === 0) {
            console.log('[AzureDevOpsService] getWorkItems: no project or empty ids');
            return [];
        }

        try {
            console.log(`[AzureDevOpsService] Fetching ${ids.length} work items...`);
            const url = `${this.baseUrl}/wit/workitemsbatch?api-version=7.0`;

            const batchSize = 200;
            const allWorkItems: WorkItem[] = [];

            for (let i = 0; i < ids.length; i += batchSize) {
                const batch = ids.slice(i, i + batchSize);
                console.log(`[AzureDevOpsService] Fetching batch ${Math.floor(i / batchSize) + 1}: ${batch.length} items`);

                const body = {
                    ids: batch,
                    fields: WORK_ITEM_FIELDS
                };

                const result = await this.makeApiRequest<{ value: WorkItem[] }>(url, 'POST', body);

                if (result.value) {
                    const validItems = result.value.filter(wi => wi !== null);
                    allWorkItems.push(...validItems);
                }
            }

            console.log(`[AzureDevOpsService] Retrieved ${allWorkItems.length} work items`);
            return allWorkItems;
        } catch (error) {
            console.error('[AzureDevOpsService] Error fetching work items:', error);
            throw new Error(`Failed to fetch work items: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get all hierarchical work items using REST API
     */
    public async getHierarchicalWorkItems(): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.baseUrl) {
            throw new Error('Project not found');
        }

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
