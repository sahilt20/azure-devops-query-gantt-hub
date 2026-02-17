/**
 * Work Item Models for Azure DevOps Query Gantt Chart Extension
 * Hierarchy: Epic → Feature → PBI (Product Backlog Item) → Task
 */

/**
 * Represents a work item node in the hierarchy
 */
export interface IWorkItemNode {
    id: number;
    title: string;
    workItemType: WorkItemType;
    state: string;
    assignedTo: string;
    assignedToImageUrl: string | null;

    // Effort fields
    effort: number;                 // Story Points / Effort (for PBI)
    originalEstimate: number;       // Original Estimate hours (for Task) = Planned Hours
    remainingWork: number;          // Remaining Work hours (for Task)
    completedWork: number;          // Completed Work hours (for Task)
    plannedHours: number;           // Planned Hours (alias for originalEstimate for clarity)

    // Date fields
    createdDate: Date | null;        // System.CreatedDate - fallback if no start date
    startDate: Date | null;
    targetDate: Date | null;
    devCompletionDate: Date | null;  // Dev Completion Date for PBI/Bug
    qaCompletionDate: Date | null;   // QA Completion Date for PBI/Bug
    iterationStartDate: Date | null; // Iteration Path start date
    iterationEndDate: Date | null;   // Iteration Path end date
    iterationPath: string;           // System.IterationPath

    // Hierarchy
    parentId: number | null;
    children: IWorkItemNode[];
    level: number;                  // 0=Epic, 1=Feature, 2=PBI, 3=Task
    isExpanded: boolean;

    // Calculated rollup fields
    rollupEffort: number;           // Sum of all descendant effort/work (Planned Hours)
    rollupCompletedWork: number;    // Sum of all descendant completed work
    rollupRemainingWork: number;    // Sum of all descendant remaining work
    percentComplete: number;        // Done % calculation

    // Calculated date range (for Gantt positioning)
    calculatedStartDate: Date | null;
    calculatedEndDate: Date | null;
    hasValidDates: boolean;         // True if dates are real, false if default 2-day duration
}

/**
 * Work item types in the hierarchy
 */
/**
 * Work item types in the hierarchy
 * Using string to support custom process template types (User Story, Requirement, Issue, etc.)
 */
export type WorkItemType = string;

/**
 * Mapping of work item type to hierarchy level
 */
export const WorkItemTypeLevel: Record<string, number> = {
    'Epic': 0,
    'Feature': 1,
    'Product Backlog Item': 2,
    'User Story': 2,
    'Requirement': 2,
    'Bug': 2,
    'Issue': 2,
    'Release': 2,
    'Task': 3,
    'Test Case': 3,
    'Unknown': 4
};

/**
 * Colors for each work item type
 */
export const WorkItemTypeColors: Record<WorkItemType, string> = {
    'Epic': '#ed8936',       // Orange
    'Feature': '#9f7aea',    // Purple
    'Product Backlog Item': '#4299e1',  // Blue
    'User Story': '#4299e1', // Blue (same as PBI)
    'Requirement': '#4299e1', // Blue (same as PBI)
    'Bug': '#f56565',        // Red
    'Issue': '#f56565',      // Red (same as Bug)
    'Task': '#ecc94b',       // Yellow
    'Test Case': '#ecc94b',  // Yellow (same as Task)
    'Release': '#48bb78',    // Green
    'Unknown': '#718096'     // Gray
};

/**
 * Icons for each work item type (Azure DevOps icon names)
 */
export const WorkItemTypeIcons: Record<WorkItemType, string> = {
    'Epic': 'Crown',
    'Feature': 'Trophy2',
    'Product Backlog Item': 'BacklogBoard',
    'User Story': 'BacklogBoard',
    'Requirement': 'BacklogBoard',
    'Bug': 'Bug',
    'Issue': 'Bug',
    'Task': 'TaskBoard',
    'Test Case': 'TaskBoard',
    'Release': 'Rocket',
    'Unknown': 'Unknown'
};

/**
 * Query result from Azure DevOps
 */
export interface IQueryResult {
    queryId: string;
    queryName: string;
    workItems: IWorkItemNode[];
    totalCount: number;
    executedAt: Date;
}

/**
 * Gantt chart configuration
 */
export interface IGanttConfig {
    startDate: Date;
    endDate: Date;
    viewMode: 'day' | 'week' | 'month';
    showWeekends: boolean;
    rowHeight: number;
    headerHeight: number;
    columnWidth: number;
}

/**
 * Gantt row for rendering
 */
export interface IGanttRow {
    workItem: IWorkItemNode;
    isVisible: boolean;
    barStartPercent: number;    // Position of bar start (0-100%)
    barWidthPercent: number;    // Width of bar (0-100%)
    progressPercent: number;    // How much of the bar is filled
}

/**
 * Query information from Azure DevOps
 */
export interface IQueryInfo {
    id: string;
    name: string;
    path: string;
    queryType: 'flat' | 'tree' | 'oneHop';
    isFolder: boolean;
}

/**
 * Create an empty work item node with default values
 */
export function createEmptyWorkItemNode(partial: Partial<IWorkItemNode> = {}): IWorkItemNode {
    return {
        id: 0,
        title: '',
        workItemType: 'Unknown',
        state: '',
        assignedTo: '',
        assignedToImageUrl: null,
        effort: 0,
        originalEstimate: 0,
        remainingWork: 0,
        completedWork: 0,
        plannedHours: 0,
        createdDate: null,
        startDate: null,
        targetDate: null,
        devCompletionDate: null,
        qaCompletionDate: null,
        iterationStartDate: null,
        iterationEndDate: null,
        iterationPath: '',
        parentId: null,
        children: [],
        level: 0,
        isExpanded: true,
        rollupEffort: 0,
        rollupCompletedWork: 0,
        rollupRemainingWork: 0,
        percentComplete: 0,
        calculatedStartDate: null,
        calculatedEndDate: null,
        hasValidDates: false,
        ...partial
    };
}
