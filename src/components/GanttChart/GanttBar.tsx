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
    const hasRealDates = workItem.hasValidDates;

    const getTypeClass = (): string => {
        switch (workItem.workItemType) {
            case 'Epic': return 'epic';
            case 'Feature': return 'feature';
            case 'Product Backlog Item': return 'pbi';
            case 'Task': return 'task';
            case 'Bug': return 'bug';
            case 'Release': return 'release';
            default: return 'unknown';
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
                    width: '15%'
                }}
                title={`${workItem.title} - No dates set`}
                onClick={handleClick}
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

    // Determine if this is a frame-only bar (default 2-day duration)
    const isFrameOnly = !hasRealDates;

    return (
        <div
            className={`gantt-bar ${getTypeClass()} ${isFrameOnly ? 'no-dates' : ''}`}
            style={{
                left: `${clampedStart}%`,
                width: `${clampedWidth}%`
            }}
            onClick={handleClick}
            title={`${workItem.title}\n${workItem.percentComplete}% complete\nEffort: ${workItem.rollupEffort}h\nRemaining: ${workItem.rollupRemainingWork}h`}
        >
            {/* Progress fill - only show for items with valid dates */}
            {!isFrameOnly && (
                <div
                    className="gantt-bar-progress"
                    style={{ width: `${workItem.percentComplete}%` }}
                />
            )}

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
