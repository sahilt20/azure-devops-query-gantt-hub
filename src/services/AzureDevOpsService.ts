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
    'Microsoft.VSTS.Scheduling.StartDate',
    'Microsoft.VSTS.Scheduling.TargetDate',
    'Microsoft.VSTS.Scheduling.Effort',
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

        await SDK.init();
        await SDK.ready();

        const projectService = await SDK.getService<IProjectPageService>(
            CommonServiceIds.ProjectPageService
        );
        const project = await projectService.getProject();

        if (project) {
            this.projectId = project.id;
            this.projectName = project.name;
        }

        this.initialized = true;
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
    public async getQueries(depth: number = 2): Promise<IQueryInfo[]> {
        await this.initialize();

        if (!this.projectId) {
            throw new Error('Project not found');
        }

        const client = this.getWitClient();
        const queries = await client.getQueries(this.projectId, QueryExpand.All, depth);

        return this.flattenQueries(queries);
    }

    /**
     * Flatten query hierarchy to a list
     */
    private flattenQueries(queries: QueryHierarchyItem[], path: string = ''): IQueryInfo[] {
        const result: IQueryInfo[] = [];

        for (const query of queries) {
            const currentPath = path ? `${path}/${query.name}` : query.name;

            if (!query.isFolder) {
                result.push({
                    id: query.id,
                    name: query.name,
                    path: currentPath,
                    queryType: query.queryType === 1 ? 'flat' : query.queryType === 2 ? 'oneHop' : 'tree',
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

        const client = this.getWitClient();
        return await client.queryById(queryId, this.projectId);
    }

    /**
     * Get work items by IDs with all required fields
     */
    public async getWorkItems(ids: number[]): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.projectId || ids.length === 0) {
            return [];
        }

        const client = this.getWitClient();

        // Azure DevOps API limits to 200 work items per request
        const batchSize = 200;
        const allWorkItems: WorkItem[] = [];

        for (let i = 0; i < ids.length; i += batchSize) {
            const batch = ids.slice(i, i + batchSize);
            const workItems = await client.getWorkItems(
                batch,
                this.projectId,
                WORK_ITEM_FIELDS,
                undefined,
                undefined,
                undefined
            );
            allWorkItems.push(...workItems);
        }

        return allWorkItems;
    }

    /**
     * Get work items with their relations/links
     */
    public async getWorkItemsWithRelations(ids: number[]): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.projectId || ids.length === 0) {
            return [];
        }

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
            allWorkItems.push(...workItems);
        }

        return allWorkItems;
    }

    /**
     * Execute a WIQL query directly
     */
    public async executeWiql(wiql: string): Promise<WorkItemQueryResult> {
        await this.initialize();

        if (!this.projectId) {
            throw new Error('Project not found');
        }

        const client = this.getWitClient();
        return await client.queryByWiql(
            { query: wiql },
            this.projectId
        );
    }

    /**
     * Get all work items in hierarchy (Epic -> Feature -> PBI -> Task)
     */
    public async getHierarchicalWorkItems(): Promise<WorkItem[]> {
        await this.initialize();

        if (!this.projectId) {
            throw new Error('Project not found');
        }

        // Query for all hierarchical work items
        const wiql = `
            SELECT [System.Id]
            FROM WorkItemLinks
            WHERE ([Source].[System.TeamProject] = @project
                AND [Source].[System.WorkItemType] IN ('Epic', 'Feature', 'Product Backlog Item', 'Task', 'Bug')
                AND [Source].[System.State] <> 'Removed')
                AND ([Target].[System.TeamProject] = @project
                AND [Target].[System.WorkItemType] IN ('Epic', 'Feature', 'Product Backlog Item', 'Task', 'Bug')
                AND [Target].[System.State] <> 'Removed')
                AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
            MODE (Recursive)
        `;

        const result = await this.executeWiql(wiql);

        if (result.workItemRelations) {
            const ids = new Set<number>();
            for (const relation of result.workItemRelations) {
                if (relation.source?.id) ids.add(relation.source.id);
                if (relation.target?.id) ids.add(relation.target.id);
            }
            return await this.getWorkItems(Array.from(ids));
        }

        return [];
    }
}

export const azureDevOpsService = AzureDevOpsService.getInstance();
export default azureDevOpsService;
