/**
 * Gantt Bar Component
 * Renders a progress bar on the timeline for a work item
 */

import React from 'react';
import { IWorkItemNode, WorkItemTypeColors } from '../../models/WorkItemModels';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { getWorkItemTypeClass } from '../../utils/WorkItemTypeUtils';
import { effortRollupService } from '../../services/EffortRollupService';

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
    const isRemoved = effortRollupService.isRemovedState(workItem.state);

    const typeClass = getWorkItemTypeClass(workItem.workItemType);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            // Open work item in Azure DevOps
            azureDevOpsService.openWorkItem(workItem.id);
        } catch (error) {
            console.error('Failed to open work item:', error);
            alert('Could not open work item details. Please ensure you are connected to Azure DevOps.');
        }

        // Also call the onClick callback if provided
        if (onClick) {
            onClick(workItem);
        }
    };

    if (!hasValidDates) {
        const hasStartDate = !!(workItem.startDate);
        const noDateLabel = hasStartDate ? '' : 'No start date';

        // Show a placeholder bar for items without start dates
        return (
            <div
                className="gantt-bar no-dates"
                style={{
                    left: '5%',
                    width: '15%'
                }}
                title={`${workItem.title}${noDateLabel ? ' - ' + noDateLabel : ''}\nClick to open in Azure DevOps`}
                onClick={handleClick}
            >
                {noDateLabel && (
                    <div className="gantt-bar-content">
                        {noDateLabel}
                    </div>
                )}
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
            className={`gantt-bar ${typeClass} ${isFrameOnly ? 'no-dates' : ''} ${isRemoved ? 'gantt-bar-removed' : ''}`}
            style={{
                left: `${clampedStart}%`,
                width: `${clampedWidth}%`,
                cursor: 'pointer'
            }}
            onClick={handleClick}
            title={`${workItem.title}\n${workItem.percentComplete}% complete\nEffort: ${workItem.rollupEffort}h\nRemaining: ${workItem.rollupRemainingWork}h\nClick to open in Azure DevOps`}
        >
            {/* Progress fill - only show for items with valid dates */}
            {!isFrameOnly && (
                <div
                    className="gantt-bar-progress"
                    style={{ width: `${workItem.percentComplete}%` }}
                />
            )}
            {/* Show label text for frame-only bars without start date */}
            {isFrameOnly && !workItem.startDate && (
                <div className="gantt-bar-content">
                    No start date
                </div>
            )}
        </div>
    );
};

export default GanttBar;
