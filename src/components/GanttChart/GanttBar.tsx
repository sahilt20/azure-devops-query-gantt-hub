/**
 * Gantt Bar Component
 * Renders a progress bar on the timeline for a work item
 */

import React from 'react';
import { IWorkItemNode, WorkItemTypeColors } from '../../models/WorkItemModels';

interface IGanttBarProps {
    workItem: IWorkItemNode;
    startPercent: number;
    widthPercent: number;
    onClick?: (workItem: IWorkItemNode) => void;
}

export const GanttBar: React.FC<IGanttBarProps> = ({
    workItem,
    startPercent,
    widthPercent,
    onClick
}) => {
    const hasValidDates = startPercent >= 0 && widthPercent > 0;

    const getTypeClass = (): string => {
        switch (workItem.workItemType) {
            case 'Epic': return 'epic';
            case 'Feature': return 'feature';
            case 'Product Backlog Item': return 'pbi';
            case 'Task': return 'task';
            case 'Bug': return 'bug';
            default: return 'task';
        }
    };

    const handleClick = () => {
        if (onClick) {
            onClick(workItem);
        }
    };

    if (!hasValidDates) {
        // Show a placeholder bar for items without dates
        return (
            <div
                className="gantt-bar no-dates"
                style={{
                    left: '5%',
                    width: '20%'
                }}
                title={`${workItem.title} - No dates set`}
            >
                <div className="gantt-bar-content">
                    No dates
                </div>
            </div>
        );
    }

    // Clamp values to valid range
    const clampedStart = Math.max(0, Math.min(100 - 1, startPercent));
    const clampedWidth = Math.max(1, Math.min(100 - clampedStart, widthPercent));

    return (
        <div
            className={`gantt-bar ${getTypeClass()}`}
            style={{
                left: `${clampedStart}%`,
                width: `${clampedWidth}%`
            }}
            onClick={handleClick}
            title={`${workItem.title}\n${workItem.percentComplete}% complete\nEffort: ${workItem.rollupEffort}h`}
        >
            {/* Progress fill */}
            <div
                className="gantt-bar-progress"
                style={{ width: `${workItem.percentComplete}%` }}
            />

            {/* Bar content - only show if bar is wide enough */}
            {clampedWidth > 5 && (
                <div className="gantt-bar-content">
                    {clampedWidth > 15 ? workItem.title : `${workItem.percentComplete}%`}
                </div>
            )}
        </div>
    );
};

export default GanttBar;
