/**
 * Delivery Analysis Component
 * Provides delivery-manager focused insights for the currently selected query
 */

import React from 'react';
import { IWorkItemNode } from '../../models/WorkItemModels';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { effortRollupService } from '../../services/EffortRollupService';
import { addDays, formatShortDate, startOfDay, toDate } from '../../utils/DateUtils';
import './DeliveryAnalysis.css';

interface IDeliveryAnalysisProps {
    workItems: IWorkItemNode[];
}

type RiskReason = 'Overdue' | 'Blocked' | 'Overrun' | 'No Estimate' | 'Unassigned';
type RiskFilter = 'all' | 'high' | 'overdue' | 'blocked' | 'unassigned' | 'no_estimate';

interface IRiskRow {
    id: number;
    title: string;
    owner: string;
    state: string;
    dueDate: Date | null;
    remainingHours: number;
    effortHours: number;
    severity: 'high' | 'medium' | 'low';
    reasons: RiskReason[];
}

interface IDueSoonRow {
    id: number;
    title: string;
    owner: string;
    dueDate: Date;
    remainingHours: number;
}

interface IOwnerLoad {
    owner: string;
    openTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    remainingHours: number;
}

interface IAnalysis {
    totalTasks: number;
    openTasks: number;
    doneTasks: number;
    ganttOverallPercent: number;
    healthScore: number;
    overdueTasks: number;
    dueSoonTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
    noEstimateTasks: number;
    riskRows: IRiskRow[];
    ownerLoad: IOwnerLoad[];
    dueSoonRows: IDueSoonRow[];
}

export const DeliveryAnalysis: React.FC<IDeliveryAnalysisProps> = ({ workItems }) => {
    const [riskFilter, setRiskFilter] = React.useState<RiskFilter>('all');
    const [ownerFilter, setOwnerFilter] = React.useState<string>('all');

    const analysis = React.useMemo<IAnalysis>(() => {
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

        const dueSoonRows = openTasks
            .map(task => {
                const dueDate = getEffectiveEndDate(task);
                if (!dueDate || dueDate < today || dueDate > nextWeek) return null;
                return {
                    id: task.id,
                    title: task.title,
                    owner: task.assignedTo || 'Unassigned',
                    dueDate,
                    remainingHours: getTaskRemaining(task)
                } as IDueSoonRow;
            })
            .filter((item): item is IDueSoonRow => item !== null)
            .sort((a, b) => {
                const byDate = a.dueDate.getTime() - b.dueDate.getTime();
                if (byDate !== 0) return byDate;
                return b.remainingHours - a.remainingHours;
            })
            .slice(0, 12);

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
        const ganttOverallPercent = effortRollupService.getTotalStats(workItems).overallPercent;
        const healthScore = calculateHealthScore({
            openTasks: openTasks.length,
            overdueTasks: overdueTasks.length,
            blockedTasks: blockedTasks.length,
            unassignedTasks: unassignedTasks.length,
            noEstimateTasks: noEstimateTasks.length
        });

        return {
            totalTasks: tasks.length,
            openTasks: openTasks.length,
            doneTasks,
            ganttOverallPercent,
            healthScore,
            overdueTasks: overdueTasks.length,
            dueSoonTasks: dueSoonRows.length,
            blockedTasks: blockedTasks.length,
            unassignedTasks: unassignedTasks.length,
            noEstimateTasks: noEstimateTasks.length,
            riskRows: riskRows.slice(0, 50),
            ownerLoad,
            dueSoonRows
        };
    }, [workItems]);

    const filteredRiskRows = React.useMemo(() => {
        return analysis.riskRows.filter(row => {
            const ownerMatch = ownerFilter === 'all' || row.owner === ownerFilter;
            const riskMatch = matchesRiskFilter(row, riskFilter);
            return ownerMatch && riskMatch;
        });
    }, [analysis.riskRows, ownerFilter, riskFilter]);

    const actions = React.useMemo(() => getRecommendedActions(analysis), [analysis]);

    const handleOpenWorkItem = React.useCallback((workItemId: number) => {
        azureDevOpsService.openWorkItem(workItemId);
    }, []);

    return (
        <div className="delivery-analysis">
            <div className="delivery-summary-grid">
                <SummaryCard label="Total Tasks" value={analysis.totalTasks} tone="default" />
                <SummaryCard label="Open Tasks" value={analysis.openTasks} tone="default" />
                <SummaryCard label="Overdue" value={analysis.overdueTasks} tone="danger" />
                <SummaryCard label="Blocked" value={analysis.blockedTasks} tone="warning" />
                <SummaryCard label="Unassigned" value={analysis.unassignedTasks} tone="warning" />
                <SummaryCard label="No Estimate" value={analysis.noEstimateTasks} tone="warning" />
                <SummaryCard label="Completion (Gantt)" value={`${analysis.ganttOverallPercent}%`} tone="success" />
                <SummaryCard label="Delivery Health" value={`${analysis.healthScore}/100`} tone={analysis.healthScore >= 70 ? 'success' : analysis.healthScore >= 45 ? 'warning' : 'danger'} />
            </div>

            <div className="delivery-controls">
                <div className="delivery-filter-group">
                    <span className="delivery-filter-label">Risk Filter:</span>
                    <button className={`delivery-chip ${riskFilter === 'all' ? 'active' : ''}`} onClick={() => setRiskFilter('all')}>All</button>
                    <button className={`delivery-chip ${riskFilter === 'high' ? 'active' : ''}`} onClick={() => setRiskFilter('high')}>High</button>
                    <button className={`delivery-chip ${riskFilter === 'overdue' ? 'active' : ''}`} onClick={() => setRiskFilter('overdue')}>Overdue</button>
                    <button className={`delivery-chip ${riskFilter === 'blocked' ? 'active' : ''}`} onClick={() => setRiskFilter('blocked')}>Blocked</button>
                    <button className={`delivery-chip ${riskFilter === 'unassigned' ? 'active' : ''}`} onClick={() => setRiskFilter('unassigned')}>Unassigned</button>
                    <button className={`delivery-chip ${riskFilter === 'no_estimate' ? 'active' : ''}`} onClick={() => setRiskFilter('no_estimate')}>No Estimate</button>
                </div>
                <div className="delivery-filter-group">
                    <label className="delivery-filter-label" htmlFor="delivery-owner-filter">Owner:</label>
                    <select
                        id="delivery-owner-filter"
                        className="delivery-owner-filter"
                        value={ownerFilter}
                        onChange={(e) => setOwnerFilter(e.target.value)}
                    >
                        <option value="all">All Owners</option>
                        {analysis.ownerLoad.map(owner => (
                            <option key={owner.owner} value={owner.owner}>{owner.owner}</option>
                        ))}
                    </select>
                    <span className="delivery-filter-count">{filteredRiskRows.length} risk item(s)</span>
                </div>
            </div>

            <div className="delivery-panels">
                <section className="delivery-panel">
                    <h3>At-Risk Tasks</h3>
                    {filteredRiskRows.length === 0 ? (
                        <div className="delivery-empty">No at-risk tasks for the current filter.</div>
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
                                {filteredRiskRows.map(row => (
                                    <tr key={row.id}>
                                        <td>
                                            <button className="delivery-link-btn" onClick={() => handleOpenWorkItem(row.id)}>
                                                #{row.id}
                                            </button>
                                        </td>
                                        <td title={row.title}>
                                            <button className="delivery-task-link" onClick={() => handleOpenWorkItem(row.id)}>
                                                {row.title}
                                            </button>
                                        </td>
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
                                    <th>Open</th>
                                    <th>Overdue</th>
                                    <th>Blocked</th>
                                    <th>Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.ownerLoad.map(owner => (
                                    <tr key={owner.owner}>
                                        <td>{owner.owner}</td>
                                        <td>{owner.openTasks}</td>
                                        <td>{owner.overdueTasks}</td>
                                        <td>{owner.blockedTasks}</td>
                                        <td>{owner.remainingHours.toFixed(1)}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="delivery-panel">
                    <h3>Action Center</h3>
                    <div className="delivery-subsection">
                        <h4>Due In Next 7 Days</h4>
                        {analysis.dueSoonRows.length === 0 ? (
                            <div className="delivery-empty">No tasks due in the next 7 days.</div>
                        ) : (
                            <ul className="delivery-due-list">
                                {analysis.dueSoonRows.map(item => (
                                    <li key={item.id}>
                                        <button className="delivery-task-link" onClick={() => handleOpenWorkItem(item.id)}>
                                            #{item.id} {item.title}
                                        </button>
                                        <span className="delivery-due-meta">
                                            {formatShortDate(item.dueDate)} • {item.owner} • {item.remainingHours.toFixed(1)}h
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="delivery-subsection">
                        <h4>Recommended Actions</h4>
                        {actions.length === 0 ? (
                            <div className="delivery-empty">No immediate actions required.</div>
                        ) : (
                            <ol className="delivery-actions">
                                {actions.map(action => (
                                    <li key={action}>{action}</li>
                                ))}
                            </ol>
                        )}
                    </div>
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
    const reasons: RiskReason[] = [];
    const dueDate = getEffectiveEndDate(task);
    const effort = getTaskEffort(task);
    const remaining = getTaskRemaining(task);

    if (dueDate && dueDate < today) reasons.push('Overdue');
    if (isBlockedState(task.state)) reasons.push('Blocked');
    if (effort > 0 && remaining > effort) reasons.push('Overrun');
    if (effort <= 0) reasons.push('No Estimate');
    if (isUnassigned(task.assignedTo)) reasons.push('Unassigned');

    if (reasons.length === 0) return null;

    const severity: IRiskRow['severity'] = reasons.includes('Overdue') || reasons.includes('Blocked')
        ? 'high'
        : reasons.includes('Overrun') || reasons.includes('No Estimate')
            ? 'medium'
            : 'low';

    return {
        id: task.id,
        title: task.title,
        owner: task.assignedTo || 'Unassigned',
        state: task.state,
        dueDate,
        remainingHours: remaining,
        effortHours: effort,
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
                blockedTasks: 0,
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

        if (isBlockedState(task.state)) {
            entry.blockedTasks += 1;
        }
    }

    return Array.from(ownerMap.values()).sort((a, b) => {
        if (b.remainingHours !== a.remainingHours) {
            return b.remainingHours - a.remainingHours;
        }
        return b.openTasks - a.openTasks;
    });
}

function calculateHealthScore(input: {
    openTasks: number;
    overdueTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
    noEstimateTasks: number;
}): number {
    if (input.openTasks <= 0) return 100;

    const overduePenalty = (input.overdueTasks / input.openTasks) * 40;
    const blockedPenalty = (input.blockedTasks / input.openTasks) * 30;
    const unassignedPenalty = (input.unassignedTasks / input.openTasks) * 20;
    const noEstimatePenalty = (input.noEstimateTasks / input.openTasks) * 10;

    const score = Math.round(100 - overduePenalty - blockedPenalty - unassignedPenalty - noEstimatePenalty);
    return Math.max(0, Math.min(100, score));
}

function matchesRiskFilter(row: IRiskRow, filter: RiskFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'high') return row.severity === 'high';
    if (filter === 'overdue') return row.reasons.includes('Overdue');
    if (filter === 'blocked') return row.reasons.includes('Blocked');
    if (filter === 'unassigned') return row.reasons.includes('Unassigned');
    if (filter === 'no_estimate') return row.reasons.includes('No Estimate');
    return true;
}

function getRecommendedActions(analysis: IAnalysis): string[] {
    const actions: string[] = [];

    if (analysis.overdueTasks > 0) {
        actions.push(`Review ${analysis.overdueTasks} overdue task(s) and re-baseline due dates/scope.`);
    }
    if (analysis.blockedTasks > 0) {
        actions.push(`Escalate ${analysis.blockedTasks} blocked task(s) and assign an unblock owner by EOD.`);
    }
    if (analysis.unassignedTasks > 0) {
        actions.push(`Assign owners for ${analysis.unassignedTasks} unassigned task(s).`);
    }
    if (analysis.noEstimateTasks > 0) {
        actions.push(`Add estimates for ${analysis.noEstimateTasks} task(s) to improve forecasting accuracy.`);
    }
    if (analysis.dueSoonTasks > 0) {
        actions.push(`Validate readiness for ${analysis.dueSoonTasks} task(s) due in the next 7 days.`);
    }
    if (analysis.ganttOverallPercent < 50 && analysis.openTasks > 0) {
        actions.push('Run a scope-risk review this week: progress is below 50% for current selection.');
    }

    return actions.slice(0, 8);
}

export default DeliveryAnalysis;
