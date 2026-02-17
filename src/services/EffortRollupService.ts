/**
 * Effort Rollup Service
 * Calculates effort rollup from Task level up through the hierarchy
 * and computes percent complete at each level
 * 
 * Calculation Rules:
 * 1. EFFORT (h)
 *    Task: EFFORT (h) = Planned Hours
 *    PBI/Bug: EFFORT (h) = sum of Planned Hours on all child tasks
 *    Feature/Epic: EFFORT (h) = sum of Planned Hours on all child PBIs and bugs
 *
 * 2. REMAINING (h)
 *    Task: REMAINING (h) = Remaining Work
 *    PBI/Bug: REMAINING (h) = sum of Remaining Work on all child tasks
 *    Feature/Epic: REMAINING (h) = sum of Remaining Work on all child PBIs and bugs
 *
 * 3. DONE (%)
 *    Task: DONE (%) = 100 - (Remaining Work * 100 / Planned Hours)
 *    PBI/Bug: DONE (%) = roll up of Done for all child tasks
 *    Feature/Epic: DONE (%) = roll up of Done for all child PBIs and bugs
 */

import { IWorkItemNode } from '../models/WorkItemModels';

class EffortRollupService {
    private static instance: EffortRollupService;

    private constructor() { }

    public static getInstance(): EffortRollupService {
        if (!EffortRollupService.instance) {
            EffortRollupService.instance = new EffortRollupService();
        }
        return EffortRollupService.instance;
    }

    /**
     * Calculate effort rollup for the entire hierarchy
     * This should be called after building the hierarchy
     */
    public calculateRollup(nodes: IWorkItemNode[]): void {
        for (const node of nodes) {
            this.calculateNodeRollup(node);
        }
    }

    /**
     * Recursively calculate rollup for a single node and its children
     */
    private calculateNodeRollup(node: IWorkItemNode): void {
        // First, calculate rollup for all children
        for (const child of node.children) {
            this.calculateNodeRollup(child);
        }

        // Removed items must not contribute effort/remaining anywhere in rollup totals.
        if (this.isRemovedState(node.state)) {
            node.plannedHours = 0;
            node.rollupEffort = 0;
            node.rollupRemainingWork = 0;
            node.rollupCompletedWork = 0;
            node.percentComplete = 0;
            return;
        }

        // Set planned hours from originalEstimate for clarity
        node.plannedHours = node.originalEstimate || 0;

        switch (node.workItemType) {
            case 'Task':
                this.calculateTaskRollup(node);
                break;
            case 'Product Backlog Item':
            case 'Bug':
                this.calculatePBIBugRollup(node);
                break;
            case 'Feature':
            case 'Epic':
                this.calculateFeatureEpicRollup(node);
                break;
            default:
                // For unknown types, try to infer based on children
                if (node.children.length > 0) {
                    this.calculateFeatureEpicRollup(node);
                } else {
                    this.calculateTaskRollup(node);
                }
        }
    }

    /**
     * Calculate rollup for Task work items
     * EFFORT = Planned Hours
     * REMAINING = Remaining Work
     * DONE = 100 - (Remaining Work * 100 / Planned Hours)
     */
    private calculateTaskRollup(node: IWorkItemNode): void {
        node.rollupEffort = node.plannedHours || node.originalEstimate || 0;
        node.rollupRemainingWork = node.remainingWork || 0;
        node.rollupCompletedWork = node.completedWork || 0;

        const isDone = this.isDoneState(node.state.toLowerCase());
        if (isDone) {
            // Completed tasks should not carry remaining effort in table/rollups.
            node.rollupRemainingWork = 0;
            node.rollupCompletedWork = Math.max(node.rollupCompletedWork, node.rollupEffort);
            node.percentComplete = 100;
            return;
        }

        // Calculate percent complete
        if (node.rollupEffort > 0) {
            node.percentComplete = Math.round(100 - (node.rollupRemainingWork * 100 / node.rollupEffort));
            node.percentComplete = Math.max(0, Math.min(100, node.percentComplete));
        } else {
            // If no effort defined, use state-based calculation
            node.percentComplete = this.calculatePercentFromState(node);
        }
    }

    /**
     * Calculate rollup for PBI/Bug work items
     * EFFORT = sum of Planned Hours on all child tasks
     * REMAINING = sum of Remaining Work on all child tasks
     * DONE = roll up of Done for all child tasks
     */
    private calculatePBIBugRollup(node: IWorkItemNode): void {
        const childTasks = this.getChildrenByTypes(node, ['Task']);

        if (childTasks.length > 0) {
            // Sum from child tasks
            node.rollupEffort = childTasks.reduce((sum, child) => sum + child.rollupEffort, 0);
            node.rollupRemainingWork = childTasks.reduce((sum, child) => sum + child.rollupRemainingWork, 0);
            node.rollupCompletedWork = childTasks.reduce((sum, child) => sum + child.rollupCompletedWork, 0);

            // Calculate weighted percent complete based on effort
            node.percentComplete = this.calculateWeightedPercent(childTasks);
        } else {
            // No child tasks - treat like a leaf item using its own effort/remaining fields
            node.rollupEffort = node.plannedHours || node.originalEstimate || node.effort || 0;
            node.rollupRemainingWork = node.remainingWork || 0;
            const isDone = this.isDoneState(node.state.toLowerCase());

            // If effort exists but no remaining work is explicitly set, infer from state
            if (node.rollupEffort > 0 && node.remainingWork === 0) {
                if (isDone) {
                    node.rollupRemainingWork = 0;
                } else if (this.isActiveState(node.state.toLowerCase())) {
                    node.rollupRemainingWork = node.rollupEffort * 0.5;
                } else {
                    // Not started - remaining = full effort
                    node.rollupRemainingWork = node.rollupEffort;
                }
            }

            node.rollupCompletedWork = node.completedWork || (node.rollupEffort - node.rollupRemainingWork);

            if (isDone) {
                node.rollupRemainingWork = 0;
                node.rollupCompletedWork = Math.max(node.rollupCompletedWork, node.rollupEffort);
                node.percentComplete = 100;
                return;
            }

            // Calculate percent complete
            if (node.rollupEffort > 0) {
                node.percentComplete = Math.round(100 - (node.rollupRemainingWork * 100 / node.rollupEffort));
                node.percentComplete = Math.max(0, Math.min(100, node.percentComplete));
            } else {
                node.percentComplete = this.calculatePercentFromState(node);
            }
        }
    }

    /**
     * Calculate rollup for Feature/Epic work items
     * EFFORT = sum of Planned Hours on all child PBIs and bugs
     * REMAINING = sum of Remaining Work on all child PBIs and bugs
     * DONE = roll up of Done for all child PBIs and bugs
     */
    private calculateFeatureEpicRollup(node: IWorkItemNode): void {
        const childPBIsBugs = this.getChildrenByTypes(node, ['Product Backlog Item', 'Bug', 'Feature']);

        if (childPBIsBugs.length > 0) {
            // Sum from child PBIs/Bugs
            node.rollupEffort = childPBIsBugs.reduce((sum, child) => sum + child.rollupEffort, 0);
            node.rollupRemainingWork = childPBIsBugs.reduce((sum, child) => sum + child.rollupRemainingWork, 0);
            node.rollupCompletedWork = childPBIsBugs.reduce((sum, child) => sum + child.rollupCompletedWork, 0);

            // Calculate weighted percent complete based on effort
            node.percentComplete = this.calculateWeightedPercent(childPBIsBugs);
        } else if (node.children.length > 0) {
            // Has children but not PBIs/Bugs - sum all children
            node.rollupEffort = node.children.reduce((sum, child) => sum + child.rollupEffort, 0);
            node.rollupRemainingWork = node.children.reduce((sum, child) => sum + child.rollupRemainingWork, 0);
            node.rollupCompletedWork = node.children.reduce((sum, child) => sum + child.rollupCompletedWork, 0);
            node.percentComplete = this.calculateWeightedPercent(node.children);
        } else {
            // No children
            node.rollupEffort = 0;
            node.rollupRemainingWork = 0;
            node.rollupCompletedWork = 0;
            node.percentComplete = this.calculatePercentFromState(node);
        }
    }

    /**
     * Get children by specific work item types
     */
    private getChildrenByTypes(node: IWorkItemNode, types: string[]): IWorkItemNode[] {
        return node.children.filter(child => types.includes(child.workItemType));
    }

    /**
     * Calculate weighted percent complete based on effort
     */
    private calculateWeightedPercent(nodes: IWorkItemNode[]): number {
        const activeNodes = nodes.filter(n => !this.isRemovedState(n.state));
        const totalEffort = activeNodes.reduce((sum, n) => sum + n.rollupEffort, 0);

        if (totalEffort === 0) {
            // If no effort, use simple average
            if (activeNodes.length === 0) return 0;
            const totalPercent = activeNodes.reduce((sum, n) => sum + n.percentComplete, 0);
            return Math.round(totalPercent / activeNodes.length);
        }

        // Weighted average based on effort
        const weightedSum = activeNodes.reduce((sum, n) => sum + (n.percentComplete * n.rollupEffort), 0);
        return Math.round(weightedSum / totalEffort);
    }

    /**
     * Calculate completed work based on state (for items without effort tracking)
     */
    private calculateCompletedFromState(node: IWorkItemNode): number {
        const state = node.state.toLowerCase();

        if (this.isDoneState(state)) {
            return node.effort || node.rollupEffort;
        } else if (this.isActiveState(state)) {
            // Assume 50% complete if in progress
            return (node.effort || node.rollupEffort) * 0.5;
        }

        return 0;
    }

    /**
     * Calculate percent complete based on state
     */
    private calculatePercentFromState(node: IWorkItemNode): number {
        const state = node.state.toLowerCase();

        if (this.isDoneState(state)) {
            return 100;
        } else if (this.isActiveState(state)) {
            return 50;
        }

        return 0;
    }

    /**
     * Check if a state represents "done"
     */
    private isDoneState(state: string): boolean {
        const doneStates = ['done', 'closed', 'completed', 'resolved'];
        return doneStates.some(s => state.includes(s));
    }

    /**
     * Check if a state represents "removed"
     */
    public isRemovedState(state: string): boolean {
        return state.toLowerCase().includes('removed');
    }

    public isBlockedState(state: string): boolean {
        const normalized = state.toLowerCase();
        return normalized.includes('block')
            || normalized.includes('impediment')
            || normalized.includes('on hold')
            || normalized.includes('waiting');
    }

    /**
     * Check if a state represents "in progress"
     */
    private isActiveState(state: string): boolean {
        const activeStates = ['active', 'in progress', 'committed', 'started', 'developing'];
        return activeStates.some(s => state.includes(s));
    }

    /**
     * Get a summary of effort rollup for display
     */
    public getRollupSummary(node: IWorkItemNode): {
        totalEffort: string;
        completed: string;
        remaining: string;
        percent: string;
    } {
        return {
            totalEffort: this.formatHours(node.rollupEffort),
            completed: this.formatHours(node.rollupCompletedWork),
            remaining: this.formatHours(node.rollupRemainingWork),
            percent: `${node.percentComplete}%`
        };
    }

    /**
     * Format hours for display
     */
    private formatHours(hours: number): string {
        if (hours === 0) return '0h';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours % 1 === 0) return `${hours}h`;
        return `${hours.toFixed(1)}h`;
    }

    /**
     * Get total effort statistics for the hierarchy
     */
    public getTotalStats(nodes: IWorkItemNode[]): {
        totalEffort: number;
        totalCompleted: number;
        totalRemaining: number;
        overallPercent: number;
        itemCount: number;
    } {
        let totalEffort = 0;
        let totalCompleted = 0;
        let totalRemaining = 0;
        let itemCount = 0;

        // Only sum root-level nodes (to avoid double counting)
        for (const node of nodes) {
            totalEffort += node.rollupEffort;
            totalCompleted += node.rollupCompletedWork;
            totalRemaining += node.rollupRemainingWork;
            itemCount += this.countItems(node);
        }

        // Calculate overall percent using the same weighted percent formula
        // as Epic/Feature rollup, so they match when there's a single root item
        const overallPercent = this.calculateWeightedPercent(nodes);

        // Ensure percent is within bounds [0, 100]
        const boundedPercent = Math.max(0, Math.min(100, overallPercent));

        return {
            totalEffort,
            totalCompleted,
            totalRemaining,
            overallPercent: boundedPercent,
            itemCount
        };
    }

    /**
     * Count total items in hierarchy
     */
    private countItems(node: IWorkItemNode): number {
        let count = 1;
        for (const child of node.children) {
            count += this.countItems(child);
        }
        return count;
    }
}

export const effortRollupService = EffortRollupService.getInstance();
export default effortRollupService;
