import { IWorkItemNode } from '../models/WorkItemModels';
import { addDays, formatISODate } from './DateUtils';

function formatDate(date: Date | null): string {
    return date ? formatISODate(date) : '-';
}

function formatHours(hours: number): string {
    return `${hours.toFixed(1)}h`;
}

export function getEffectiveStartDate(workItem: IWorkItemNode): Date | null {
    return workItem.calculatedStartDate || workItem.startDate || workItem.iterationStartDate || workItem.createdDate;
}

export function getEffectiveEndDate(workItem: IWorkItemNode, startDate: Date | null): Date | null {
    return workItem.calculatedEndDate
        || workItem.targetDate
        || workItem.devCompletionDate
        || workItem.qaCompletionDate
        || (startDate ? addDays(startDate, 1) : null);
}

export function buildWorkItemTooltip(workItem: IWorkItemNode): string {
    const startDate = getEffectiveStartDate(workItem);
    const endDate = getEffectiveEndDate(workItem, startDate);

    return [
        `#${workItem.id} ${workItem.title}`,
        `Type: ${workItem.workItemType}`,
        `State: ${workItem.state || '-'}`,
        `Assigned To: ${workItem.assignedTo || 'Unassigned'}`,
        `Iteration Path: ${workItem.iterationPath || '-'}`,
        `Start: ${formatDate(startDate)}`,
        `End: ${formatDate(endDate)}`,
        `Effort: ${formatHours(workItem.rollupEffort)}`,
        `Remaining: ${formatHours(workItem.rollupRemainingWork)}`,
        `Completed: ${formatHours(workItem.rollupCompletedWork)}`,
        `Progress: ${workItem.percentComplete}%`,
        'Click to open in Azure DevOps'
    ].join('\n');
}
