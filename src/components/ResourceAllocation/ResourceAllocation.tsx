/**
 * Resource Allocation Component
 * Displays aggregated effort and progress per user
 */

import React from 'react';
import { IWorkItemNode } from '../../models/WorkItemModels';
import './ResourceAllocation.css';

interface IResourceAllocationProps {
    workItems: IWorkItemNode[];
}

interface IResourceStats {
    displayName: string;
    avatarInitials: string;
    workItemCount: number;
    totalEffort: number;
    totalRemaining: number;
    totalCompleted: number;
    percentComplete: number;
}

export const ResourceAllocation: React.FC<IResourceAllocationProps> = ({ workItems }) => {

    // Aggregate data by user
    const resourceStats = React.useMemo(() => {
        const statsMap = new Map<string, IResourceStats>();

        // Flatten hierarchy to get all items
        const flatten = (nodes: IWorkItemNode[]): IWorkItemNode[] => {
            let flat: IWorkItemNode[] = [];
            for (const node of nodes) {
                flat.push(node);
                if (node.children.length > 0) {
                    flat = flat.concat(flatten(node.children));
                }
            }
            return flat;
        };

        const allItems = flatten(workItems);

        // Filter to only leaf nodes (Tasks)
        // This avoids double counting parent rollup values and ensures we only track actionable work
        const accountableItems = allItems.filter(item => item.workItemType === 'Task');

        for (const item of accountableItems) {
            const userName = item.assignedTo || 'Unassigned';

            if (!statsMap.has(userName)) {
                statsMap.set(userName, {
                    displayName: userName,
                    avatarInitials: getInitials(userName),
                    workItemCount: 0,
                    totalEffort: 0,
                    totalRemaining: 0,
                    totalCompleted: 0,
                    percentComplete: 0
                });
            }

            const stats = statsMap.get(userName)!;

            // Add values
            const effort = item.effort || item.originalEstimate || item.plannedHours || 0;
            const remaining = item.remainingWork || 0;
            const completed = item.completedWork || 0;

            stats.workItemCount++;
            stats.totalEffort += effort;
            stats.totalRemaining += remaining;
            stats.totalCompleted += completed;
        }

        // Calculate percentages
        const result = Array.from(statsMap.values()).map(stat => {
            if (stat.totalEffort > 0) {
                stat.percentComplete = Math.round(100 - ((stat.totalRemaining / stat.totalEffort) * 100));
            } else if (stat.totalCompleted > 0) {
                // Even if no effort planned, if work completions exist
                stat.percentComplete = 100; // Assume done if tracked completed? Or maybe 0?
                // Let's stick to standard formula, calculate from remaining if possible
            }
            return stat;
        });

        // Sort by effort descending
        return result.sort((a, b) => b.totalEffort - a.totalEffort);

    }, [workItems]);

    return (
        <div className="resource-allocation">
            <div className="resource-list-container">
                <table className="resource-table">
                    <thead>
                        <tr>
                            <th>Resource</th>
                            <th>Work Items</th>
                            <th>Total Effort</th>
                            <th>Remaining</th>
                            <th>Progress</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resourceStats.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="resource-empty">
                                    No resource data available
                                </td>
                            </tr>
                        ) : (
                            resourceStats.map((stat) => (
                                <tr key={stat.displayName} className="resource-row">
                                    <td>
                                        <div className="resource-user">
                                            <div className="resource-avatar" title={stat.displayName}>
                                                {stat.avatarInitials}
                                            </div>
                                            <div className="resource-name">{stat.displayName}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="resource-stat">
                                            <span className="resource-stat-value">{stat.workItemCount}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="resource-stat">
                                            <span className="resource-stat-value">{stat.totalEffort.toFixed(1)}</span>
                                            <span className="resource-stat-label">h</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="resource-stat">
                                            <span className="resource-stat-value">{stat.totalRemaining.toFixed(1)}</span>
                                            <span className="resource-stat-label">h</span>
                                        </div>
                                    </td>
                                    <td className="resource-progress-cell">
                                        <div className="resource-progress-wrapper">
                                            <div className="resource-progress-bar">
                                                <div
                                                    className="resource-progress-fill"
                                                    style={{ width: `${Math.max(0, Math.min(100, stat.percentComplete))}%` }}
                                                />
                                            </div>
                                            <div className="resource-progress-text">
                                                {stat.percentComplete}%
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Helper: Get initials from name
function getInitials(name: string): string {
    if (!name) return '?';

    // Check if email format
    if (name.includes('<') && name.includes('>')) {
        name = name.split('<')[0].trim();
    }

    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default ResourceAllocation;
