/**
 * Work Item Hierarchy Service
 * Builds hierarchical structure from flat work items: Epic → Feature → PBI → Task
 * 
 * Bar Duration Calculation Rules:
 * - Feature/Epic: Start Date → Target Date; fallback to child PBI/Bug date range
 * - PBI/Bug: Start Date → Dev/QA Completion Date; fallback to child task dates + Planned Hours
 * - Task: Start Date + Planned Hours (7h working day); fallback to Iteration Path start + Planned Hours
 * - Default: 2 days with empty bar if no dates/children
 */

import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import {
    IWorkItemNode,
    WorkItemType,
    WorkItemTypeLevel,
    createEmptyWorkItemNode
} from '../models/WorkItemModels';
import { parseAzureDate, minDate, maxDate, addDays, addWorkingHours } from '../utils/DateUtils';

class WorkItemHierarchyService {
    private static instance: WorkItemHierarchyService;

    private constructor() { }

    public static getInstance(): WorkItemHierarchyService {
        if (!WorkItemHierarchyService.instance) {
            WorkItemHierarchyService.instance = new WorkItemHierarchyService();
        }
        return WorkItemHierarchyService.instance;
    }

    /**
         * Convert Azure DevOps WorkItem to IWorkItemNode
         */
    public convertToNode(workItem: WorkItem): IWorkItemNode {
        const fields = workItem.fields || {};
        const workItemType = this.normalizeWorkItemType(fields['System.WorkItemType']);

        // Get field config for dynamic field mapping
        const fieldConfig = this.getFieldConfig();

        // Read effort/remaining from configured fields
        const originalEstimate = this.parseNumber(fields[fieldConfig.effortField] || fields['Microsoft.VSTS.Scheduling.OriginalEstimate']);
        const remainingWork = this.parseNumber(fields[fieldConfig.remainingField] || fields['Microsoft.VSTS.Scheduling.RemainingWork']);
        const completedWork = this.parseNumber(fields['Microsoft.VSTS.Scheduling.CompletedWork']);

        return createEmptyWorkItemNode({
            id: workItem.id,
            title: fields['System.Title'] || 'Untitled',
            workItemType,
            state: fields['System.State'] || '',
            assignedTo: this.getAssignedTo(fields['System.AssignedTo']),
            effort: this.parseNumber(fields['Microsoft.VSTS.Scheduling.Effort']),
            originalEstimate,
            plannedHours: originalEstimate, // Alias for clarity
            remainingWork,
            completedWork,
            createdDate: parseAzureDate(fields['System.CreatedDate']),
            startDate: parseAzureDate(fields['Microsoft.VSTS.Scheduling.StartDate']),
            targetDate: parseAzureDate(fields['Microsoft.VSTS.Scheduling.TargetDate']),
            devCompletionDate: parseAzureDate(fields['Custom.DevCompletionDate']),
            qaCompletionDate: parseAzureDate(fields['Custom.QACompletionDate']),
            finishDate: parseAzureDate(fields['Microsoft.VSTS.Scheduling.FinishDate']),
            iterationStartDate: this.parseIterationDates(fields['System.IterationPath'])?.start || null,
            iterationEndDate: this.parseIterationDates(fields['System.IterationPath'])?.end || null,
            parentId: this.parseNumber(fields['System.Parent']) || null,
            level: WorkItemTypeLevel[workItemType],
            isExpanded: true,
            hasValidDates: false, // Will be set during date calculation
            isRemoved: (fields['System.State'] || '').toLowerCase() === 'removed'
        });
    }

    /**
     * Get field configuration (lazy loaded to avoid circular dependency)
     */
    private getFieldConfig(): { effortField: string; remainingField: string } {
        try {
            // Dynamically import to avoid circular dependency
            const stored = localStorage.getItem('gantt-field-config');
            if (stored) {
                const config = JSON.parse(stored);
                return {
                    effortField: config.effortField || 'Microsoft.VSTS.Scheduling.OriginalEstimate',
                    remainingField: config.remainingField || 'Microsoft.VSTS.Scheduling.RemainingWork'
                };
            }
        } catch (e) {
            console.warn('Failed to load field config:', e);
        }
        return {
            effortField: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
            remainingField: 'Microsoft.VSTS.Scheduling.RemainingWork'
        };
    }

    /**
     * Parse iteration path to get start and end dates
     * Note: This is a placeholder - actual implementation would need to query iteration info
     */
    private parseIterationDates(_iterationPath: string | undefined): { start: Date | null; end: Date | null } | null {
        // In a real implementation, we would query the iteration API
        // For now, return null and fall back to other date logic
        return null;
    }

    /**
     * Build hierarchical structure from flat work items
     */
    public buildHierarchy(workItems: WorkItem[]): IWorkItemNode[] {
        // Convert all work items to nodes
        const nodeMap = new Map<number, IWorkItemNode>();
        const nodes = workItems.map(wi => {
            const node = this.convertToNode(wi);
            nodeMap.set(node.id, node);
            return node;
        });

        // Build parent-child relationships
        const rootNodes: IWorkItemNode[] = [];

        for (const node of nodes) {
            if (node.parentId && nodeMap.has(node.parentId)) {
                const parent = nodeMap.get(node.parentId)!;
                parent.children.push(node);
            } else {
                // No parent or parent not in result - this is a root node
                rootNodes.push(node);
            }
        }

        // Sort children at each level
        this.sortHierarchy(rootNodes);

        // Calculate date ranges for all nodes
        this.calculateDateRanges(rootNodes);

        return rootNodes;
    }

    /**
     * Build hierarchy from query result with work item relations
     */
    public buildHierarchyFromRelations(
        workItems: WorkItem[],
        relations: Array<{ source?: { id: number }, target?: { id: number } }>
    ): IWorkItemNode[] {
        // Convert all work items to nodes
        const nodeMap = new Map<number, IWorkItemNode>();
        for (const wi of workItems) {
            const node = this.convertToNode(wi);
            nodeMap.set(node.id, node);
        }

        // Track which nodes have parents
        const hasParent = new Set<number>();

        // Build relationships from query relations
        for (const relation of relations) {
            if (relation.source?.id && relation.target?.id) {
                const sourceNode = nodeMap.get(relation.source.id);
                const targetNode = nodeMap.get(relation.target.id);

                if (sourceNode && targetNode) {
                    // In Azure DevOps, source is parent, target is child
                    if (!sourceNode.children.some(c => c.id === targetNode.id)) {
                        sourceNode.children.push(targetNode);
                        targetNode.parentId = sourceNode.id;
                        hasParent.add(targetNode.id);
                    }
                }
            }
        }

        // Collect root nodes (those without parents)
        const rootNodes: IWorkItemNode[] = [];
        for (const node of nodeMap.values()) {
            if (!hasParent.has(node.id)) {
                rootNodes.push(node);
            }
        }

        // Sort and calculate dates
        this.sortHierarchy(rootNodes);
        this.calculateDateRanges(rootNodes);

        return rootNodes;
    }

    /**
     * Sort hierarchy by work item type level, then by ID
     */
    private sortHierarchy(nodes: IWorkItemNode[]): void {
        nodes.sort((a, b) => {
            // First by level (Epic before Feature, etc.)
            if (a.level !== b.level) return a.level - b.level;
            // Then by ID
            return a.id - b.id;
        });

        // Recursively sort children
        for (const node of nodes) {
            if (node.children.length > 0) {
                this.sortHierarchy(node.children);
            }
        }
    }

    /**
     * Build a map of all nodes by ID for parent lookup
     */
    private buildNodeMap(nodes: IWorkItemNode[]): Map<number, IWorkItemNode> {
        const map = new Map<number, IWorkItemNode>();
        const traverse = (items: IWorkItemNode[]) => {
            for (const node of items) {
                map.set(node.id, node);
                if (node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };
        traverse(nodes);
        return map;
    }

    /**
     * Get inherited start date by traversing up the parent chain
     * Returns the first non-null calculatedStartDate or startDate found in parent chain
     * Falls back to createdDate if no parent has a start date
     */
    /**
     * Get best available end date from various fields
     */
    private getBestEndDate(node: IWorkItemNode): Date | null {
        return node.finishDate ||
            node.devCompletionDate ||
            node.qaCompletionDate ||
            node.targetDate ||
            null;
    }

    /**
     * Get inherited start date by traversing up the parent chain
     * Returns the first non-null calculatedStartDate or startDate found in parent chain
     * Falls back to createdDate if no parent has a start date
     */
    private getInheritedStartDate(node: IWorkItemNode, nodeMap: Map<number, IWorkItemNode>): Date | null {
        // If node has its own start date, return it
        if (node.startDate) return node.startDate;

        // Traverse up parent chain
        let currentNode = node;
        while (currentNode.parentId) {
            const parent = nodeMap.get(currentNode.parentId);
            if (!parent) break;

            // Check if parent has a calculated or explicit start date
            if (parent.calculatedStartDate) return parent.calculatedStartDate;
            if (parent.startDate) return parent.startDate;

            currentNode = parent;
        }

        // No parent with start date found - use created date as fallback
        return node.createdDate;
    }

    /**
     * Calculate date ranges for all nodes based on work item type
     * Uses different logic for Feature/Epic, PBI/Bug, and Task
     */
    private calculateDateRanges(nodes: IWorkItemNode[]): void {
        // Build node map for parent lookup
        const nodeMap = this.buildNodeMap(nodes);

        for (const node of nodes) {
            // Recursively calculate for children first
            if (node.children.length > 0) {
                this.calculateDateRanges(node.children);
            }

            // Calculate based on work item type
            switch (node.workItemType) {
                case 'Task':
                    this.calculateTaskDates(node, nodeMap);
                    break;
                case 'Product Backlog Item':
                case 'Bug':
                    this.calculatePBIBugDates(node, nodeMap);
                    break;
                case 'Feature':
                case 'Epic':
                case 'Release':
                    this.calculateFeatureEpicDates(node, nodeMap);
                    break;
                default:
                    this.calculateDefaultDates(node, nodeMap);
            }
        }
    }

    /**
     * Calculate dates for Task work items
     * - Use Start Date + Planned Hours (7h working day)
     * - Fallback to inherited start date from parent + Planned Hours
     * - Fallback to Iteration Path start + Planned Hours
     * - Fallback to created date
     * - Default: 2 days, frame-only bar
     */
    private calculateTaskDates(node: IWorkItemNode, nodeMap: Map<number, IWorkItemNode>): void {
        const startDate = node.startDate || this.getInheritedStartDate(node, nodeMap) || node.iterationStartDate;
        const endDate = this.getBestEndDate(node);
        const plannedHours = node.plannedHours || node.originalEstimate || 0;

        if (startDate && endDate) {
            // Has explicit start and end dates - use them directly
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = endDate;
            node.hasValidDates = true;
        } else if (startDate && plannedHours > 0) {
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = addWorkingHours(startDate, plannedHours);
            node.hasValidDates = true;
        } else if (startDate) {
            // Has only start date, estimate 1 day duration
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = addDays(startDate, 1);
            node.hasValidDates = true;
        } else {
            // No dates - use default 2 days
            this.setDefaultDates(node);
        }
    }

    /**
     * Calculate dates for PBI/Bug work items
     * - Use Start Date → Dev/QA Completion Date
     * - Fallback: inherited start date from parent or earliest child Start Date + sum of Planned Hours (7h working day)
     * - Fallback: created date
     * - Default: 2 days, frame-only bar
     */
    private calculatePBIBugDates(node: IWorkItemNode, nodeMap: Map<number, IWorkItemNode>): void {
        const endDate = this.getBestEndDate(node);
        const startDate = node.startDate || this.getInheritedStartDate(node, nodeMap);

        if (startDate && endDate) {
            // Has explicit dates
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = endDate;
            node.hasValidDates = true;
        } else if (node.children.length > 0) {
            // Calculate from children
            const childDates = this.getChildDateRange(node.children);

            if (childDates.start || startDate) {
                node.calculatedStartDate = startDate || childDates.start;

                if (childDates.end) {
                    node.calculatedEndDate = endDate || childDates.end;
                } else if (node.calculatedStartDate) {
                    // Calculate from child planned hours
                    const totalPlannedHours = node.children.reduce(
                        (sum, child) => sum + (child.plannedHours || child.originalEstimate || 0),
                        0
                    );
                    if (totalPlannedHours > 0) {
                        node.calculatedEndDate = addWorkingHours(node.calculatedStartDate, totalPlannedHours);
                    } else {
                        node.calculatedEndDate = addDays(node.calculatedStartDate, 7);
                    }
                }
                node.hasValidDates = !!(node.calculatedStartDate && node.calculatedEndDate);
            } else {
                this.setDefaultDates(node);
            }
        } else if (startDate) {
            // Has only start date (explicit or inherited)
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = endDate || addDays(startDate, 5);
            node.hasValidDates = true;
        } else {
            // No dates, no children
            this.setDefaultDates(node);
        }
    }

    /**
     * Calculate dates for Feature/Epic work items
     * - Use Start Date → Target Date
     * - Fallback: inherited start date from parent or earliest child Start Date → longest child Dev/QA Completion Date
     * - Fallback: created date
     * - Default: 2 days, frame-only bar
     */
    private calculateFeatureEpicDates(node: IWorkItemNode, nodeMap: Map<number, IWorkItemNode>): void {
        const startDate = node.startDate || this.getInheritedStartDate(node, nodeMap);
        const endDate = this.getBestEndDate(node);

        if (startDate && endDate) {
            // Has explicit dates
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = endDate;
            node.hasValidDates = true;
        } else if (node.children.length > 0) {
            // Calculate from children
            const childDates = this.getChildDateRange(node.children);

            node.calculatedStartDate = startDate || childDates.start;
            node.calculatedEndDate = endDate || childDates.end;

            if (node.calculatedStartDate && node.calculatedEndDate) {
                node.hasValidDates = true;
            } else if (node.calculatedStartDate) {
                // Has start but no end - estimate based on children
                node.calculatedEndDate = addDays(node.calculatedStartDate, 14);
                node.hasValidDates = true;
            } else {
                this.setDefaultDates(node);
            }
        } else if (startDate) {
            // Has only start date (explicit or inherited)
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = endDate || addDays(startDate, 30);
            node.hasValidDates = true;
        } else {
            // No dates, no children
            this.setDefaultDates(node);
        }
    }

    /**
     * Calculate dates for unknown work item types
     */
    private calculateDefaultDates(node: IWorkItemNode, nodeMap: Map<number, IWorkItemNode>): void {
        const startDate = node.startDate || this.getInheritedStartDate(node, nodeMap);
        const endDate = this.getBestEndDate(node);

        if (startDate && endDate) {
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = endDate;
            node.hasValidDates = true;
        } else if (node.children.length > 0) {
            const childDates = this.getChildDateRange(node.children);
            node.calculatedStartDate = startDate || childDates.start;
            node.calculatedEndDate = endDate || childDates.end;
            node.hasValidDates = !!(node.calculatedStartDate && node.calculatedEndDate);
        } else if (startDate) {
            node.calculatedStartDate = startDate;
            node.calculatedEndDate = addDays(startDate, 2);
            node.hasValidDates = true;
        } else {
            this.setDefaultDates(node);
        }
    }

    /**
     * Set default 2-day duration (frame-only bar)
     */
    private setDefaultDates(node: IWorkItemNode): void {
        const today = new Date();
        node.calculatedStartDate = node.startDate || today;
        node.calculatedEndDate = addDays(node.calculatedStartDate, 2);
        node.hasValidDates = false;
    }

    /**
     * Get the date range from a list of child nodes
     */
    private getChildDateRange(children: IWorkItemNode[]): { start: Date | null; end: Date | null } {
        const childStarts = children
            .map(c => c.calculatedStartDate || c.startDate)
            .filter((d): d is Date => d !== null);

        const childEnds = children
            .map(c => c.calculatedEndDate || this.getBestEndDate(c))
            .filter((d): d is Date => d !== null);

        return {
            start: minDate(...childStarts),
            end: maxDate(...childEnds)
        };
    }

    /**
     * Flatten hierarchy to an array (for Gantt rendering)
     */
    public flattenHierarchy(nodes: IWorkItemNode[], visibleOnly: boolean = true): IWorkItemNode[] {
        const result: IWorkItemNode[] = [];

        const traverse = (items: IWorkItemNode[], currentLevel: number) => {
            for (const node of items) {
                node.level = currentLevel;
                result.push(node);

                if (node.children.length > 0 && (!visibleOnly || node.isExpanded)) {
                    traverse(node.children, currentLevel + 1);
                }
            }
        };

        traverse(nodes, 0);
        return result;
    }

    /**
     * Toggle expand/collapse for a node
     */
    public toggleNode(nodes: IWorkItemNode[], nodeId: number): IWorkItemNode[] {
        const toggle = (items: IWorkItemNode[]): boolean => {
            for (const node of items) {
                if (node.id === nodeId) {
                    node.isExpanded = !node.isExpanded;
                    return true;
                }
                if (node.children.length > 0 && toggle(node.children)) {
                    return true;
                }
            }
            return false;
        };

        toggle(nodes);
        return [...nodes]; // Return new array to trigger React re-render
    }

    /**
     * Expand all nodes
     */
    public expandAll(nodes: IWorkItemNode[]): void {
        const expand = (items: IWorkItemNode[]) => {
            for (const node of items) {
                node.isExpanded = true;
                if (node.children.length > 0) {
                    expand(node.children);
                }
            }
        };
        expand(nodes);
    }

    /**
     * Collapse all nodes
     */
    public collapseAll(nodes: IWorkItemNode[]): void {
        const collapse = (items: IWorkItemNode[]) => {
            for (const node of items) {
                node.isExpanded = false;
                if (node.children.length > 0) {
                    collapse(node.children);
                }
            }
        };
        collapse(nodes);
    }

    /**
     * Normalize work item type string
     */
    private normalizeWorkItemType(type: string | undefined): WorkItemType {
        if (!type) return 'Unknown';

        const normalized = type.toLowerCase().trim();

        if (normalized === 'epic') return 'Epic';
        if (normalized === 'feature') return 'Feature';
        if (normalized === 'product backlog item' || normalized === 'pbi') return 'Product Backlog Item';
        if (normalized === 'task') return 'Task';
        if (normalized === 'bug') return 'Bug';
        if (normalized === 'release') return 'Release';

        return 'Unknown';
    }

    /**
     * Get assigned to display name
     */
    private getAssignedTo(assignedTo: unknown): string {
        if (!assignedTo) return 'Unassigned';
        if (typeof assignedTo === 'string') return assignedTo;
        if (typeof assignedTo === 'object' && assignedTo !== null) {
            const obj = assignedTo as Record<string, unknown>;
            return (obj['displayName'] as string) || (obj['uniqueName'] as string) || 'Unassigned';
        }
        return 'Unassigned';
    }

    /**
     * Parse a number from a field value
     */
    private parseNumber(value: unknown): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }
}

export const workItemHierarchyService = WorkItemHierarchyService.getInstance();
export default workItemHierarchyService;
