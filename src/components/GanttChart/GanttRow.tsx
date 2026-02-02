/**
 * Gantt Row Component
 * Renders a single work item row with expand/collapse, type icon, and effort info
 */

import React from 'react';
import { IWorkItemNode } from '../../models/WorkItemModels';

interface IGanttRowProps {
    workItem: IWorkItemNode;
    onToggle: (id: number) => void;
    onClick?: (workItem: IWorkItemNode) => void;
}

export const GanttRow: React.FC<IGanttRowProps> = ({
    workItem,
    onToggle,
    onClick
}) => {
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

    const getTypeAbbr = (): string => {
        switch (workItem.workItemType) {
            case 'Epic': return 'E';
            case 'Feature': return 'F';
            case 'Product Backlog Item': return 'P';
            case 'Task': return 'T';
            case 'Bug': return 'B';
            case 'Release': return 'R';
            default: return '?';
        }
    };

    const getPercentClass = (percent: number): string => {
        if (percent === 100) return 'percent-100';
        if (percent >= 75) return 'percent-75-100';
        if (percent >= 50) return 'percent-50-75';
        if (percent >= 25) return 'percent-25-50';
        return 'percent-0-25';
    };

    const formatEffort = (hours: number): string => {
        if (hours === 0) return '-';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours % 1 === 0) return `${hours}h`;
        return `${hours.toFixed(1)}h`;
    };

    const hasChildren = workItem.children.length > 0;

    const handleRowClick = () => {
        if (onClick) {
            onClick(workItem);
        }
    };

    return (
        <div className={`gantt-row ${getTypeClass()}`} onClick={handleRowClick}>
            {/* Title with expand button and type icon */}
            <div className={`gantt-cell gantt-cell-title indent-${workItem.level}`}>
                {/* Expand/Collapse button */}
                {hasChildren ? (
                    <button
                        className={`gantt-expand-btn ${workItem.isExpanded ? 'expanded' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle(workItem.id);
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                            <path d="M4 2 L10 6 L4 10 Z" />
                        </svg>
                    </button>
                ) : (
                    <span style={{ width: 20 }} />
                )}

                {/* Work item type icon */}
                <span className={`gantt-type-icon ${getTypeClass()}`}>
                    {getTypeAbbr()}
                </span>

                {/* Title */}
                <span className="gantt-item-title" title={workItem.title}>
                    {workItem.title}
                </span>
            </div>

            {/* Effort (rollup) */}
            <div className="gantt-cell gantt-cell-effort">
                {formatEffort(workItem.rollupEffort)}
            </div>

            {/* Remaining */}
            <div className="gantt-cell gantt-cell-remaining">
                {formatEffort(workItem.rollupRemainingWork)}
            </div>

            {/* Percent Complete */}
            <div className={`gantt-cell gantt-cell-percent ${getPercentClass(workItem.percentComplete)}`}>
                {workItem.percentComplete}%
            </div>
        </div>
    );
};

export default GanttRow;
