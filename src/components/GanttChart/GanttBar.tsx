/**
 * Gantt Bar Component
 * Renders a progress bar on the timeline for a work item
 */

import React from 'react';
import { IWorkItemNode, WorkItemTypeColors } from '../../models/WorkItemModels';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { getWorkItemTypeClass } from '../../utils/WorkItemTypeUtils';

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
    const isRemoved = workItem.isRemoved || workItem.state.toLowerCase() === 'removed';

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
        // Determine which date is missing
        const hasStartDate = !!workItem.startDate;
        const hasEndDate = !!(workItem.devCompletionDate || workItem.qaCompletionDate || workItem.targetDate);
        let noDatesLabel = 'No dates';
        if (!hasStartDate && hasEndDate) {
            noDatesLabel = 'No start date';
        } else if (hasStartDate && !hasEndDate) {
            noDatesLabel = 'No end date';
        } else if (!hasStartDate) {
            noDatesLabel = 'No start date';
        }

        return (
            <div
                className="gantt-bar no-dates"
                style={{
                    left: '5%',
                    width: '15%'
                }}
                title={`${workItem.title} - ${noDatesLabel}\nClick to open in Azure DevOps`}
                onClick={handleClick}
            >
                <div className="gantt-bar-content">
                    {noDatesLabel}
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
            className={`gantt-bar ${typeClass} ${isFrameOnly ? 'no-dates' : ''}${isRemoved ? ' gantt-bar-removed' : ''}`}
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
        </div>
    );
};

export default GanttBar;
