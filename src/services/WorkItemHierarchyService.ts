/**
 * Work Item Hierarchy Service
 * Builds hierarchical structure from flat work items: Epic → Feature → PBI → Task
 */

import { WorkItem } from 'azure-devops-extension-api/WorkItemTracking';
import {
    IWorkItemNode,
    WorkItemType,
    WorkItemTypeLevel,
    createEmptyWorkItemNode
} from '../models/WorkItemModels';
import { parseAzureDate, minDate, maxDate } from '../utils/DateUtils';

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

        return createEmptyWorkItemNode({
            id: workItem.id,
            title: fields['System.Title'] || 'Untitled',
            workItemType,
            state: fields['System.State'] || '',
            assignedTo: this.getAssignedTo(fields['System.AssignedTo']),
            effort: this.parseNumber(fields['Microsoft.VSTS.Scheduling.Effort']),
            originalEstimate: this.parseNumber(fields['Microsoft.VSTS.Scheduling.OriginalEstimate']),
            remainingWork: this.parseNumber(fields['Microsoft.VSTS.Scheduling.RemainingWork']),
            completedWork: this.parseNumber(fields['Microsoft.VSTS.Scheduling.CompletedWork']),
            startDate: parseAzureDate(fields['Microsoft.VSTS.Scheduling.StartDate']),
            targetDate: parseAzureDate(fields['Microsoft.VSTS.Scheduling.TargetDate']),
            parentId: this.parseNumber(fields['System.Parent']) || null,
            level: WorkItemTypeLevel[workItemType],
            isExpanded: true
        });
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

        // Calculate date ranges for parent nodes
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
     * Calculate date ranges for parent nodes based on children
     */
    private calculateDateRanges(nodes: IWorkItemNode[]): void {
        for (const node of nodes) {
            // Recursively calculate for children first
            if (node.children.length > 0) {
                this.calculateDateRanges(node.children);
            }

            // Calculate the effective date range
            if (node.children.length > 0) {
                // Parent date range spans all children
                const childStarts = node.children
                    .map(c => c.calculatedStartDate || c.startDate)
                    .filter((d): d is Date => d !== null);
                const childEnds = node.children
                    .map(c => c.calculatedEndDate || c.targetDate)
                    .filter((d): d is Date => d !== null);

                node.calculatedStartDate = node.startDate || minDate(...childStarts);
                node.calculatedEndDate = node.targetDate || maxDate(...childEnds);
            } else {
                // Leaf node - use its own dates
                node.calculatedStartDate = node.startDate;
                node.calculatedEndDate = node.targetDate;
            }
        }
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
