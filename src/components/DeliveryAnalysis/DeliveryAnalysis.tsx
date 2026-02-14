/**
 * Delivery Analysis Component
 * Provides delivery-manager focused insights for the currently selected query
 */

import React from 'react';
import { IWorkItemNode } from '../../models/WorkItemModels';
import { effortRollupService } from '../../services/EffortRollupService';
import { addDays, formatShortDate, startOfDay, toDate } from '../../utils/DateUtils';
import './DeliveryAnalysis.css';

interface IDeliveryAnalysisProps {
    workItems: IWorkItemNode[];
}

interface IRiskRow {
    id: number;
    title: string;
    owner: string;
    state: string;
    dueDate: Date | null;
    remainingHours: number;
    severity: 'high' | 'medium' | 'low';
    reasons: string[];
}

interface IOwnerLoad {
    owner: string;
    openTasks: number;
    overdueTasks: number;
    remainingHours: number;
}

export const DeliveryAnalysis: React.FC<IDeliveryAnalysisProps> = ({ workItems }) => {
    const analysis = React.useMemo(() => {
        const allItems = flattenHierarchy(workItems);
        const tasks = allItems.filter(item => isTaskWorkItem(item));
        const today = startOfDay(new Date());
        const nextWeek = addDays(today, 7);

        const openTasks = tasks.filter(task => !isDoneTask(task) && !effortRollupService.isRemovedState(task.state));
        const doneTasks = tasks.length - openTasks.length;

        const overdueTasks = openTasks.filter(task => {
            const dueDate = getEffectiveEndDate(task);
            return !!(dueDate && dueDate < today);
        });

        const dueSoonTasks = openTasks.filter(task => {
            const dueDate = getEffectiveEndDate(task);
            return !!(dueDate && dueDate >= today && dueDate <= nextWeek);
        });

        const blockedTasks = openTasks.filter(task => isBlockedState(task.state));
        const unassignedTasks = openTasks.filter(task => isUnassigned(task.assignedTo));
        const noEstimateTasks = openTasks.filter(task => getTaskEffort(task) <= 0);

        const riskRows = openTasks
            .map(task => buildRiskRow(task, today))
            .filter((row): row is IRiskRow => row !== null)
            .sort((a, b) => {
                const severityOrder = { high: 0, medium: 1, low: 2 };
                const bySeverity = severityOrder[a.severity] - severityOrder[b.severity];
                if (bySeverity !== 0) return bySeverity;
                const aDue = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
                const bDue = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
                return aDue - bDue;
            });

        const ownerLoad = buildOwnerLoad(openTasks, today);

        const completionPercent = tasks.length > 0
            ? Math.round((doneTasks / tasks.length) * 100)
            : 0;

        return {
            totalTasks: tasks.length,
            openTasks: openTasks.length,
            doneTasks,
            completionPercent,
            overdueTasks: overdueTasks.length,
            dueSoonTasks: dueSoonTasks.length,
            blockedTasks: blockedTasks.length,
            unassignedTasks: unassignedTasks.length,
            noEstimateTasks: noEstimateTasks.length,
            riskRows: riskRows.slice(0, 20),
            ownerLoad
        };
    }, [workItems]);

    const actions = getRecommendedActions(analysis);

    return (
        <div className="delivery-analysis">
            <div className="delivery-summary-grid">
                <SummaryCard label="Total Tasks" value={analysis.totalTasks} tone="default" />
                <SummaryCard label="Open Tasks" value={analysis.openTasks} tone="default" />
                <SummaryCard label="Overdue" value={analysis.overdueTasks} tone="danger" />
                <SummaryCard label="Blocked" value={analysis.blockedTasks} tone="warning" />
                <SummaryCard label="Unassigned" value={analysis.unassignedTasks} tone="warning" />
                <SummaryCard label="Completion" value={`${analysis.completionPercent}%`} tone="success" />
            </div>

            <div className="delivery-panels">
                <section className="delivery-panel">
                    <h3>At-Risk Tasks</h3>
                    {analysis.riskRows.length === 0 ? (
                        <div className="delivery-empty">No at-risk tasks detected in this query.</div>
                    ) : (
                        <table className="delivery-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Task</th>
                                    <th>Owner</th>
                                    <th>State</th>
                                    <th>Due</th>
                                    <th>Remaining</th>
                                    <th>Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.riskRows.map(row => (
                                    <tr key={row.id}>
                                        <td>#{row.id}</td>
                                        <td title={row.title}>{row.title}</td>
                                        <td>{row.owner}</td>
                                        <td>{row.state || '-'}</td>
                                        <td>{row.dueDate ? formatShortDate(row.dueDate) : '-'}</td>
                                        <td>{row.remainingHours.toFixed(1)}h</td>
                                        <td>
                                            <span className={`delivery-risk-pill ${row.severity}`}>
                                                {row.reasons.join(', ')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="delivery-panel">
                    <h3>Owner Load (Open Tasks)</h3>
                    {analysis.ownerLoad.length === 0 ? (
                        <div className="delivery-empty">No open tasks found.</div>
                    ) : (
                        <table className="delivery-table">
                            <thead>
                                <tr>
                                    <th>Owner</th>
                                    <th>Open Tasks</th>
                                    <th>Overdue</th>
                                    <th>Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.ownerLoad.map(owner => (
                                    <tr key={owner.owner}>
                                        <td>{owner.owner}</td>
                                        <td>{owner.openTasks}</td>
                                        <td>{owner.overdueTasks}</td>
                                        <td>{owner.remainingHours.toFixed(1)}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="delivery-panel">
                    <h3>Recommended Actions</h3>
                    {actions.length === 0 ? (
                        <div className="delivery-empty">No immediate actions required.</div>
                    ) : (
                        <ol className="delivery-actions">
                            {actions.map(action => (
                                <li key={action}>{action}</li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>
        </div>
    );
};

interface ISummaryCardProps {
    label: string;
    value: string | number;
    tone: 'default' | 'danger' | 'warning' | 'success';
}

const SummaryCard: React.FC<ISummaryCardProps> = ({ label, value, tone }) => (
    <div className={`delivery-summary-card ${tone}`}>
        <div className="delivery-summary-label">{label}</div>
        <div className="delivery-summary-value">{value}</div>
    </div>
);

function flattenHierarchy(nodes: IWorkItemNode[]): IWorkItemNode[] {
    const result: IWorkItemNode[] = [];

    const visit = (items: IWorkItemNode[]) => {
        for (const item of items) {
            result.push(item);
            if (item.children.length > 0) {
                visit(item.children);
            }
        }
    };

    visit(nodes);
    return result;
}

function isTaskWorkItem(item: IWorkItemNode): boolean {
    return item.workItemType.trim().toLowerCase() === 'task';
}

function isDoneTask(item: IWorkItemNode): boolean {
    if (item.percentComplete >= 100) return true;
    const state = item.state.toLowerCase();
    return state.includes('done') || state.includes('closed') || state.includes('completed') || state.includes('resolved');
}

function isBlockedState(state: string): boolean {
    const normalized = state.toLowerCase();
    return normalized.includes('block') || normalized.includes('impediment') || normalized.includes('on hold');
}

function isUnassigned(assignedTo: string): boolean {
    const value = assignedTo.trim().toLowerCase();
    return !value || value === 'unassigned';
}

function getTaskEffort(task: IWorkItemNode): number {
    return task.plannedHours || task.originalEstimate || task.rollupEffort || task.effort || 0;
}

function getTaskRemaining(task: IWorkItemNode): number {
    return task.remainingWork || task.rollupRemainingWork || 0;
}

function getEffectiveEndDate(task: IWorkItemNode): Date | null {
    return toDate(task.calculatedEndDate || task.targetDate || task.devCompletionDate || task.qaCompletionDate);
}

function buildRiskRow(task: IWorkItemNode, today: Date): IRiskRow | null {
    const reasons: string[] = [];
    const dueDate = getEffectiveEndDate(task);
    const effort = getTaskEffort(task);
    const remaining = getTaskRemaining(task);

    if (dueDate && dueDate < today) reasons.push('Overdue');
    if (isBlockedState(task.state)) reasons.push('Blocked');
    if (effort > 0 && remaining > effort) reasons.push('Overrun');
    if (effort <= 0) reasons.push('No Estimate');
    if (isUnassigned(task.assignedTo)) reasons.push('Unassigned');

    if (reasons.length === 0) return null;

    const severity: IRiskRow['severity'] = reasons.some(reason => reason === 'Overdue' || reason === 'Blocked')
        ? 'high'
        : reasons.some(reason => reason === 'Overrun' || reason === 'No Estimate')
            ? 'medium'
            : 'low';

    return {
        id: task.id,
        title: task.title,
        owner: task.assignedTo || 'Unassigned',
        state: task.state,
        dueDate,
        remainingHours: remaining,
        severity,
        reasons
    };
}

function buildOwnerLoad(openTasks: IWorkItemNode[], today: Date): IOwnerLoad[] {
    const ownerMap = new Map<string, IOwnerLoad>();

    for (const task of openTasks) {
        const owner = task.assignedTo || 'Unassigned';
        if (!ownerMap.has(owner)) {
            ownerMap.set(owner, {
                owner,
                openTasks: 0,
                overdueTasks: 0,
                remainingHours: 0
            });
        }

        const entry = ownerMap.get(owner)!;
        entry.openTasks += 1;
        entry.remainingHours += getTaskRemaining(task);

        const dueDate = getEffectiveEndDate(task);
        if (dueDate && dueDate < today) {
            entry.overdueTasks += 1;
        }
    }

    return Array.from(ownerMap.values()).sort((a, b) => {
        if (b.remainingHours !== a.remainingHours) {
            return b.remainingHours - a.remainingHours;
        }
        return b.openTasks - a.openTasks;
    });
}

function getRecommendedActions(analysis: {
    overdueTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
    noEstimateTasks: number;
    dueSoonTasks: number;
}): string[] {
    const actions: string[] = [];

    if (analysis.overdueTasks > 0) {
        actions.push(`Review ${analysis.overdueTasks} overdue task(s) and reset due dates or scope today.`);
    }
    if (analysis.blockedTasks > 0) {
        actions.push(`Escalate ${analysis.blockedTasks} blocked task(s) and assign unblock owners.`);
    }
    if (analysis.unassignedTasks > 0) {
        actions.push(`Assign owners for ${analysis.unassignedTasks} unassigned task(s).`);
    }
    if (analysis.noEstimateTasks > 0) {
        actions.push(`Add effort estimates to ${analysis.noEstimateTasks} task(s) for reliable forecasting.`);
    }
    if (analysis.dueSoonTasks > 0) {
        actions.push(`Validate completion plan for ${analysis.dueSoonTasks} task(s) due in the next 7 days.`);
    }

    return actions;
}

export default DeliveryAnalysis;
