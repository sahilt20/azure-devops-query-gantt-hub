/**
 * Gantt Row Component
 * Renders a single work item row with expand/collapse, type icon, and effort info
 * Supports dynamic column widths
 */

import React from 'react';
import { IWorkItemNode } from '../../models/WorkItemModels';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { getWorkItemTypeClass, getWorkItemTypeAbbreviation, getCustomTypeColor, isCustomType } from '../../utils/WorkItemTypeUtils';
import { effortRollupService } from '../../services/EffortRollupService';
import { buildWorkItemTooltip } from '../../utils/WorkItemTooltipUtils';

interface IColumnWidths {
    title: number;
    effort: number;
    remaining: number;
    done: number;
}

interface IGanttRowProps {
    workItem: IWorkItemNode;
    onToggle: (id: number) => void;
    columnWidths?: IColumnWidths;
}

const DEFAULT_WIDTHS: IColumnWidths = {
    title: 250,
    effort: 70,
    remaining: 80,
    done: 60
};

export const GanttRow: React.FC<IGanttRowProps> = ({
    workItem,
    onToggle,
    columnWidths = DEFAULT_WIDTHS
}) => {
    const [avatarLoadFailed, setAvatarLoadFailed] = React.useState(false);
    const [avatarRetryCount, setAvatarRetryCount] = React.useState(0);
    const typeClass = getWorkItemTypeClass(workItem.workItemType);
    const typeAbbr = getWorkItemTypeAbbreviation(workItem.workItemType);
    const isCustom = isCustomType(workItem.workItemType);
    const customColor = isCustom ? getCustomTypeColor(workItem.workItemType) : undefined;
    const isRemoved = effortRollupService.isRemovedState(workItem.state);
    const isBlocked = effortRollupService.isBlockedState(workItem.state);
    const tooltipText = buildWorkItemTooltip(workItem);
    const assigneeInitials = getInitials(workItem.assignedTo);
    const avatarSrc = React.useMemo(() => {
        if (!workItem.assignedToImageUrl) return null;
        if (avatarRetryCount === 0) return workItem.assignedToImageUrl;
        const separator = workItem.assignedToImageUrl.includes('?') ? '&' : '?';
        return `${workItem.assignedToImageUrl}${separator}retry=${workItem.id}-${avatarRetryCount}`;
    }, [workItem.assignedToImageUrl, workItem.id, avatarRetryCount]);
    const hasAvatarImage = !!avatarSrc && !avatarLoadFailed;

    React.useEffect(() => {
        setAvatarLoadFailed(false);
        setAvatarRetryCount(0);
    }, [workItem.assignedToImageUrl, workItem.id]);



    const formatEffort = (hours: number): string => {
        if (hours === 0) return '-';
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours % 1 === 0) return `${hours}h`;
        return `${hours.toFixed(1)}h`;
    };

    const hasChildren = workItem.children.length > 0;

    const handleTitleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        azureDevOpsService.openWorkItem(workItem.id);
    };

    const workItemUrl = azureDevOpsService.getWorkItemUrl(workItem.id);

    const gridTemplate = `${columnWidths.title}px ${columnWidths.effort}px ${columnWidths.remaining}px ${columnWidths.done}px`;

    return (
        <div
            className={`gantt-row ${typeClass} ${isRemoved ? 'gantt-row-removed' : ''}`}
            style={{ gridTemplateColumns: gridTemplate }}
        >
            {/* Title with expand button and type icon */}
            <div className={`gantt-cell gantt-cell-title indent-${workItem.level}`}>
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

                <span
                    className={`gantt-type-icon ${typeClass}`}
                    style={customColor ? { backgroundColor: customColor } : undefined}
                >
                    {typeAbbr}
                </span>

                {isBlocked && (
                    <span
                        className="gantt-blocked-indicator"
                        title="Blocked item"
                        aria-label="Blocked item"
                    >
                        !
                    </span>
                )}

                <a
                    className="gantt-item-title gantt-item-link"
                    href={workItemUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={tooltipText}
                    onClick={handleTitleClick}
                >
                    {workItem.title}
                </a>

                <span className={`gantt-assignee-avatar ${hasAvatarImage ? 'has-image' : ''}`} title={workItem.assignedTo || 'Unassigned'}>
                    {hasAvatarImage && (
                        <img
                            src={avatarSrc!}
                            alt={workItem.assignedTo || 'Assignee'}
                            onLoad={() => setAvatarLoadFailed(false)}
                            onError={() => {
                                if (avatarRetryCount < 1) {
                                    setAvatarRetryCount(avatarRetryCount + 1);
                                    return;
                                }
                                setAvatarLoadFailed(true);
                            }}
                        />
                    )}
                    <span className="gantt-assignee-initials">{assigneeInitials}</span>
                </span>
            </div>

            {/* Effort (rollup) */}
            <div className="gantt-cell gantt-cell-effort">
                {formatEffort(workItem.rollupEffort)}
            </div>

            {/* Remaining */}
            <div className={`gantt-cell gantt-cell-remaining ${workItem.rollupRemainingWork > workItem.rollupEffort && workItem.rollupEffort > 0 ? 'remaining-over' : ''}`}>
                {formatEffort(workItem.rollupRemainingWork)}
            </div>

            {/* Percent Complete */}
            <div className="gantt-cell gantt-cell-percent">
                {workItem.percentComplete}%
            </div>
        </div>
    );
};

export default GanttRow;

function getInitials(name: string): string {
    const normalized = (name || '').trim();
    if (!normalized || normalized.toLowerCase() === 'unassigned') return '?';

    const clean = normalized.includes('<') ? normalized.split('<')[0].trim() : normalized;
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
