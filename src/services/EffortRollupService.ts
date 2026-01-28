/**
 * Effort Rollup Service
 * Calculates effort rollup from Task level up through the hierarchy
 * and computes percent complete at each level
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

        if (node.children.length === 0) {
            // Leaf node (typically Task)
            // Use Remaining Work and Completed Work for tasks
            if (node.workItemType === 'Task') {
                // For tasks, effort is based on Original Estimate or sum of Remaining + Completed
                const totalWork = node.originalEstimate || (node.remainingWork + node.completedWork);
                node.rollupEffort = totalWork;
                node.rollupCompletedWork = node.completedWork;
                node.rollupRemainingWork = node.remainingWork;
            } else {
                // For leaf PBIs or Features without children, use their effort field
                node.rollupEffort = node.effort || 0;
                node.rollupCompletedWork = this.calculateCompletedFromState(node);
                node.rollupRemainingWork = node.rollupEffort - node.rollupCompletedWork;
            }
        } else {
            // Parent node - sum up all children's rollup values
            node.rollupEffort = node.children.reduce(
                (sum, child) => sum + child.rollupEffort,
                0
            );
            node.rollupCompletedWork = node.children.reduce(
                (sum, child) => sum + child.rollupCompletedWork,
                0
            );
            node.rollupRemainingWork = node.children.reduce(
                (sum, child) => sum + child.rollupRemainingWork,
                0
            );
        }

        // Calculate percent complete
        node.percentComplete = this.calculatePercentComplete(node);
    }

    /**
     * Calculate percent complete for a node
     */
    private calculatePercentComplete(node: IWorkItemNode): number {
        if (node.rollupEffort === 0) {
            // If no effort defined, use state-based calculation
            return this.calculatePercentFromState(node);
        }

        const percent = (node.rollupCompletedWork / node.rollupEffort) * 100;
        return Math.round(Math.min(100, Math.max(0, percent)));
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
        if (node.children.length > 0) {
            // For parent nodes, average the children's percent
            const totalPercent = node.children.reduce(
                (sum, child) => sum + child.percentComplete,
                0
            );
            return Math.round(totalPercent / node.children.length);
        }

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
        const doneStates = ['done', 'closed', 'completed', 'resolved', 'removed'];
        return doneStates.some(s => state.includes(s));
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

        const overallPercent = totalEffort > 0
            ? Math.round((totalCompleted / totalEffort) * 100)
            : 0;

        return {
            totalEffort,
            totalCompleted,
            totalRemaining,
            overallPercent,
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
