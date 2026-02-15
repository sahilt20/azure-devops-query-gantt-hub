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
type RiskFilter = 'all' | 'overdue' | 'overrun' | 'blocked' | 'unassigned' | 'no_estimate';
type Tone = 'default' | 'danger' | 'warning' | 'success';

interface ITaskFact {
    id: number;
    title: string;
    owner: string;
    state: string;
    dueDate: Date | null;
    estimatedHours: number;
    remainingHours: number;
    completedHours: number;
    forecastHours: number;
    overrunHours: number;
    reasons: RiskReason[];
    riskScore: number;
    severity: 'high' | 'medium' | 'low';
}

interface IRiskRow {
    id: number;
    title: string;
    owner: string;
    state: string;
    dueDate: Date | null;
    remainingHours: number;
    overrunHours: number;
    riskScore: number;
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

interface IOwnerRiskRow {
    owner: string;
    openTasks: number;
    atRiskTasks: number;
    overdueTasks: number;
    overrunTasks: number;
    blockedTasks: number;
    remainingHours: number;
    avgRiskScore: number;
}

interface IFilterCounts {
    all: number;
    overdue: number;
    overrun: number;
    blocked: number;
    unassigned: number;
    noEstimate: number;
}

interface IAnalysis {
    totalTasks: number;
    openTasks: number;
    doneTasks: number;
    ganttOverallPercent: number;
    healthScore: number;
    deliveryConfidence: number;
    overdueTasks: number;
    overrunTasks: number;
    dueSoonTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
    noEstimateTasks: number;
    riskDensityPercent: number;
    schedulePressurePercent: number;
    estimateCoveragePercent: number;
    assignmentCoveragePercent: number;
    loadBalanceScore: number;
    exposureHours: number;
    overrunHours: number;
    riskRows: IRiskRow[];
    ownerRiskRows: IOwnerRiskRow[];
    dueSoonRows: IDueSoonRow[];
    bottlenecks: IRiskRow[];
}

interface IAdvancedMetric {
    label: string;
    value: string;
    tone: Tone;
}

interface IRiskBreakdownRow {
    label: string;
    count: number;
    percent: number;
    tone: Tone;
}

export const DeliveryAnalysis: React.FC<IDeliveryAnalysisProps> = ({ workItems }) => {
    const [riskFilter, setRiskFilter] = React.useState<RiskFilter>('all');
    const [ownerFilter, setOwnerFilter] = React.useState<string>('all');

    const analysis = React.useMemo<IAnalysis>(() => {
        const allItems = flattenHierarchy(workItems);
        const tasks = allItems.filter(item => isTaskWorkItem(item));
        const today = startOfDay(new Date());
        const nextWeek = addDays(today, 7);
        const nextThreeDays = addDays(today, 3);

        const openTasks = tasks.filter(task => !isDoneTask(task) && !effortRollupService.isRemovedState(task.state));
        const doneTasks = tasks.length - openTasks.length;
        const taskFacts = openTasks.map(task => buildTaskFact(task, today, nextThreeDays));
        const riskFacts = taskFacts.filter(f => f.reasons.length > 0);

        const dueSoonRows = taskFacts
            .filter(f => !!(f.dueDate && f.dueDate >= today && f.dueDate <= nextWeek))
            .sort((a, b) => {
                const byDate = (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0);
                if (byDate !== 0) return byDate;
                return b.remainingHours - a.remainingHours;
            })
            .slice(0, 12)
            .map(f => ({
                id: f.id,
                title: f.title,
                owner: f.owner,
                dueDate: f.dueDate!,
                remainingHours: f.remainingHours
            }));

        const overdueTasks = countWithReason(taskFacts, 'Overdue');
        const overrunTasks = countWithReason(taskFacts, 'Overrun');
        const blockedTasks = countWithReason(taskFacts, 'Blocked');
        const unassignedTasks = countWithReason(taskFacts, 'Unassigned');
        const noEstimateTasks = countWithReason(taskFacts, 'No Estimate');

        const ownerRiskRows = buildOwnerRiskRows(taskFacts);
        const ganttOverallPercent = effortRollupService.getTotalStats(workItems).overallPercent;
        const riskDensityPercent = toPercent(riskFacts.length, taskFacts.length);
        const schedulePressurePercent = toPercent(
            taskFacts.filter(f => !!(f.dueDate && f.dueDate <= nextWeek)).length,
            taskFacts.length
        );
        const estimateCoveragePercent = toPercent(
            taskFacts.filter(f => f.estimatedHours > 0).length,
            taskFacts.length,
            100
        );
        const assignmentCoveragePercent = toPercent(
            taskFacts.filter(f => !isUnassigned(f.owner)).length,
            taskFacts.length,
            100
        );
        const exposureHours = round1(
            taskFacts
                .filter(f => !!(f.dueDate && f.dueDate <= nextWeek))
                .reduce((sum, f) => sum + f.remainingHours, 0)
        );
        const overrunHours = round1(taskFacts.reduce((sum, f) => sum + f.overrunHours, 0));
        const loadBalanceScore = calculateLoadBalanceScore(ownerRiskRows);
        const healthScore = calculateHealthScore({
            openTasks: taskFacts.length,
            overdueTasks,
            overrunTasks,
            blockedTasks,
            unassignedTasks,
            noEstimateTasks
        });
        const deliveryConfidence = calculateDeliveryConfidence({
            completion: ganttOverallPercent,
            health: healthScore,
            estimateCoverage: estimateCoveragePercent,
            assignmentCoverage: assignmentCoveragePercent,
            loadBalance: loadBalanceScore
        });

        const riskRows = riskFacts
            .sort((a, b) => b.riskScore - a.riskScore)
            .map(toRiskRow)
            .slice(0, 100);

        return {
            totalTasks: tasks.length,
            openTasks: taskFacts.length,
            doneTasks,
            ganttOverallPercent,
            healthScore,
            deliveryConfidence,
            overdueTasks,
            overrunTasks,
            dueSoonTasks: dueSoonRows.length,
            blockedTasks,
            unassignedTasks,
            noEstimateTasks,
            riskDensityPercent,
            schedulePressurePercent,
            estimateCoveragePercent,
            assignmentCoveragePercent,
            loadBalanceScore,
            exposureHours,
            overrunHours,
            riskRows,
            ownerRiskRows,
            dueSoonRows,
            bottlenecks: riskRows.slice(0, 10)
        };
    }, [workItems]);

    const ownersWithRisk = React.useMemo(() => {
        return Array.from(new Set(analysis.riskRows.map(r => r.owner))).sort((a, b) => a.localeCompare(b));
    }, [analysis.riskRows]);

    React.useEffect(() => {
        if (ownerFilter !== 'all' && !ownersWithRisk.includes(ownerFilter)) {
            setOwnerFilter('all');
        }
    }, [ownerFilter, ownersWithRisk]);

    const ownerScopedRiskRows = React.useMemo(() => {
        if (ownerFilter === 'all') return analysis.riskRows;
        return analysis.riskRows.filter(row => row.owner === ownerFilter);
    }, [analysis.riskRows, ownerFilter]);

    const scopedFilterCounts = React.useMemo((): IFilterCounts => {
        return {
            all: ownerScopedRiskRows.length,
            overdue: ownerScopedRiskRows.filter(r => r.reasons.includes('Overdue')).length,
            overrun: ownerScopedRiskRows.filter(r => r.reasons.includes('Overrun')).length,
            blocked: ownerScopedRiskRows.filter(r => r.reasons.includes('Blocked')).length,
            unassigned: ownerScopedRiskRows.filter(r => r.reasons.includes('Unassigned')).length,
            noEstimate: ownerScopedRiskRows.filter(r => r.reasons.includes('No Estimate')).length
        };
    }, [ownerScopedRiskRows]);

    const filteredRiskRows = React.useMemo(() => {
        return ownerScopedRiskRows.filter(row => matchesRiskFilter(row, riskFilter));
    }, [ownerScopedRiskRows, riskFilter]);

    const actions = React.useMemo(() => getRecommendedActions(analysis), [analysis]);
    const advancedMetrics = React.useMemo(() => buildAdvancedMetrics(analysis), [analysis]);
    const riskBreakdown = React.useMemo(() => buildRiskBreakdown(analysis), [analysis]);

    const handleOpenWorkItem = React.useCallback((workItemId: number) => {
        azureDevOpsService.openWorkItem(workItemId);
    }, []);

    return (
        <div className="delivery-analysis">
            <div className="delivery-summary-grid">
                <SummaryCard label="Total Tasks" value={analysis.totalTasks} tone="default" />
                <SummaryCard label="Open Tasks" value={analysis.openTasks} tone="default" />
                <SummaryCard label="Completion (Gantt)" value={`${analysis.ganttOverallPercent}%`} tone="success" />
                <SummaryCard label="Delivery Health" value={`${analysis.healthScore}/100`} tone={toneFromScore(analysis.healthScore)} />
                <SummaryCard label="Confidence" value={`${analysis.deliveryConfidence}/100`} tone={toneFromScore(analysis.deliveryConfidence)} />
                <SummaryCard label="Overdue" value={analysis.overdueTasks} tone="danger" />
                <SummaryCard label="Overrun" value={analysis.overrunTasks} tone="danger" />
                <SummaryCard label="Blocked" value={analysis.blockedTasks} tone="warning" />
                <SummaryCard label="Unassigned" value={analysis.unassignedTasks} tone="warning" />
                <SummaryCard label="No Estimate" value={analysis.noEstimateTasks} tone="warning" />
                <SummaryCard label="Estimate Coverage" value={`${analysis.estimateCoveragePercent}%`} tone={toneFromScore(analysis.estimateCoveragePercent)} />
                <SummaryCard label="Assignment Coverage" value={`${analysis.assignmentCoveragePercent}%`} tone={toneFromScore(analysis.assignmentCoveragePercent)} />
                <SummaryCard label="Risk Density" value={`${analysis.riskDensityPercent}%`} tone={analysis.riskDensityPercent >= 50 ? 'danger' : analysis.riskDensityPercent >= 30 ? 'warning' : 'success'} />
                <SummaryCard label="Exposure (h)" value={analysis.exposureHours.toFixed(1)} tone={analysis.exposureHours >= 80 ? 'danger' : analysis.exposureHours >= 40 ? 'warning' : 'default'} />
                <SummaryCard label="Load Balance" value={`${analysis.loadBalanceScore}%`} tone={toneFromScore(analysis.loadBalanceScore)} />
            </div>

            <div className="delivery-controls">
                <div className="delivery-filter-group">
                    <span className="delivery-filter-label">Risk Filter:</span>
                    <button className={`delivery-chip ${riskFilter === 'all' ? 'active' : ''}`} onClick={() => setRiskFilter('all')}>All ({scopedFilterCounts.all})</button>
                    <button className={`delivery-chip ${riskFilter === 'overdue' ? 'active' : ''}`} onClick={() => setRiskFilter('overdue')}>Overdue ({scopedFilterCounts.overdue})</button>
                    <button className={`delivery-chip ${riskFilter === 'overrun' ? 'active' : ''}`} onClick={() => setRiskFilter('overrun')}>Overrun ({scopedFilterCounts.overrun})</button>
                    <button className={`delivery-chip ${riskFilter === 'blocked' ? 'active' : ''}`} onClick={() => setRiskFilter('blocked')}>Blocked ({scopedFilterCounts.blocked})</button>
                    <button className={`delivery-chip ${riskFilter === 'unassigned' ? 'active' : ''}`} onClick={() => setRiskFilter('unassigned')}>Unassigned ({scopedFilterCounts.unassigned})</button>
                    <button className={`delivery-chip ${riskFilter === 'no_estimate' ? 'active' : ''}`} onClick={() => setRiskFilter('no_estimate')}>No Estimate ({scopedFilterCounts.noEstimate})</button>
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
                        {ownersWithRisk.map(owner => (
                            <option key={owner} value={owner}>{owner}</option>
                        ))}
                    </select>
                    <span className="delivery-filter-count">{filteredRiskRows.length} risk item(s)</span>
                </div>
                <div className="delivery-risk-legend">
                    Overdue: schedule date passed. Overrun: forecast effort exceeds estimate.
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
                                    <th>Due</th>
                                    <th>Remaining</th>
                                    <th>Overrun</th>
                                    <th>Risk</th>
                                    <th>Score</th>
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
                                        <td>{row.dueDate ? formatShortDate(row.dueDate) : '-'}</td>
                                        <td>{row.remainingHours.toFixed(1)}h</td>
                                        <td>{row.overrunHours.toFixed(1)}h</td>
                                        <td>
                                            <span className={`delivery-risk-pill ${row.severity}`}>
                                                {row.reasons.join(', ')}
                                            </span>
                                        </td>
                                        <td>{row.riskScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </section>

                <section className="delivery-panel">
                    <h3>Owner Risk Matrix</h3>
                    {analysis.ownerRiskRows.length === 0 ? (
                        <div className="delivery-empty">No open tasks found.</div>
                    ) : (
                        <table className="delivery-table">
                            <thead>
                                <tr>
                                    <th>Owner</th>
                                    <th>Open</th>
                                    <th>At Risk</th>
                                    <th>Overdue</th>
                                    <th>Overrun</th>
                                    <th>Blocked</th>
                                    <th>Remaining</th>
                                    <th>Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.ownerRiskRows.map(owner => (
                                    <tr key={owner.owner}>
                                        <td>{owner.owner}</td>
                                        <td>{owner.openTasks}</td>
                                        <td>{owner.atRiskTasks}</td>
                                        <td>{owner.overdueTasks}</td>
                                        <td>{owner.overrunTasks}</td>
                                        <td>{owner.blockedTasks}</td>
                                        <td>{owner.remainingHours.toFixed(1)}h</td>
                                        <td>{owner.avgRiskScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    <div className="delivery-subsection">
                        <h4>Top Bottlenecks</h4>
                        {analysis.bottlenecks.length === 0 ? (
                            <div className="delivery-empty">No active bottlenecks detected.</div>
                        ) : (
                            <ul className="delivery-due-list">
                                {analysis.bottlenecks.map(item => (
                                    <li key={item.id}>
                                        <button className="delivery-task-link" onClick={() => handleOpenWorkItem(item.id)}>
                                            #{item.id} {item.title}
                                        </button>
                                        <span className="delivery-due-meta">
                                            Score {item.riskScore} • {item.owner} • {item.remainingHours.toFixed(1)}h • {item.reasons.join(', ')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                <section className="delivery-panel">
                    <h3>Action Center</h3>
                    <div className="delivery-subsection">
                        <h4>Advanced Metrics</h4>
                        <div className="delivery-metric-list">
                            {advancedMetrics.map(metric => (
                                <div key={metric.label} className={`delivery-metric-item ${metric.tone}`}>
                                    <span className="delivery-metric-label">{metric.label}</span>
                                    <span className="delivery-metric-value">{metric.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="delivery-subsection">
                        <h4>Risk Breakdown</h4>
                        <div className="delivery-breakdown-list">
                            {riskBreakdown.map(row => (
                                <div key={row.label} className={`delivery-breakdown-item ${row.tone}`}>
                                    <span className="delivery-breakdown-label">{row.label}</span>
                                    <span className="delivery-breakdown-value">{row.count} ({row.percent}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>

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
    tone: Tone;
}

const SummaryCard: React.FC<ISummaryCardProps> = ({ label, value, tone }) => (
    <div className={`delivery-summary-card ${tone}`}>
        <div className="delivery-summary-label">{label}</div>
        <div className="delivery-summary-value">{value}</div>
    </div>
);

function toRiskRow(fact: ITaskFact): IRiskRow {
    return {
        id: fact.id,
        title: fact.title,
        owner: fact.owner,
        state: fact.state,
        dueDate: fact.dueDate,
        remainingHours: fact.remainingHours,
        overrunHours: fact.overrunHours,
        riskScore: fact.riskScore,
        severity: fact.severity,
        reasons: fact.reasons
    };
}

function flattenHierarchy(nodes: IWorkItemNode[]): IWorkItemNode[] {
    const result: IWorkItemNode[] = [];
    const visit = (items: IWorkItemNode[]) => {
        for (const item of items) {
            result.push(item);
            if (item.children.length > 0) visit(item.children);
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
    return normalized.includes('block') || normalized.includes('impediment') || normalized.includes('on hold') || normalized.includes('waiting');
}

function isUnassigned(assignedTo: string): boolean {
    const value = (assignedTo || '').trim().toLowerCase();
    return !value || value === 'unassigned';
}

function getTaskEffort(task: IWorkItemNode): number {
    return Math.max(0, task.plannedHours || task.originalEstimate || task.rollupEffort || task.effort || 0);
}

function getTaskRemaining(task: IWorkItemNode): number {
    return Math.max(0, task.remainingWork || task.rollupRemainingWork || 0);
}

function getTaskCompleted(task: IWorkItemNode): number {
    return Math.max(0, task.completedWork || task.rollupCompletedWork || 0);
}

function getEffectiveEndDate(task: IWorkItemNode): Date | null {
    return toDate(task.calculatedEndDate || task.targetDate || task.devCompletionDate || task.qaCompletionDate);
}

function countWithReason(facts: ITaskFact[], reason: RiskReason): number {
    return facts.filter(f => f.reasons.includes(reason)).length;
}

function buildTaskFact(task: IWorkItemNode, today: Date, nextThreeDays: Date): ITaskFact {
    const owner = task.assignedTo || 'Unassigned';
    const dueDate = getEffectiveEndDate(task);
    const estimatedHours = getTaskEffort(task);
    const remainingHours = getTaskRemaining(task);
    const completedHours = getTaskCompleted(task);
    const forecastHours = completedHours + remainingHours > 0 ? completedHours + remainingHours : remainingHours;
    const overrunHours = estimatedHours > 0 ? Math.max(0, forecastHours - estimatedHours) : 0;

    const reasons: RiskReason[] = [];
    if (dueDate && dueDate < today) reasons.push('Overdue');
    if (isBlockedState(task.state)) reasons.push('Blocked');
    if (estimatedHours > 0 && overrunHours > 0.25) reasons.push('Overrun');
    if (estimatedHours <= 0.01) reasons.push('No Estimate');
    if (isUnassigned(owner)) reasons.push('Unassigned');

    let riskScore = 0;
    if (reasons.includes('Overdue')) riskScore += 45;
    if (reasons.includes('Blocked')) riskScore += 35;
    if (reasons.includes('Overrun')) riskScore += 25;
    if (reasons.includes('No Estimate')) riskScore += 15;
    if (reasons.includes('Unassigned')) riskScore += 15;
    if (dueDate && dueDate >= today && dueDate <= nextThreeDays) riskScore += 10;
    riskScore += Math.min(20, Math.round(remainingHours));
    riskScore += Math.min(15, Math.round(overrunHours * 2));
    riskScore = Math.min(100, riskScore);

    const severity: ITaskFact['severity'] = riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low';

    return {
        id: task.id,
        title: task.title,
        owner,
        state: task.state,
        dueDate,
        estimatedHours,
        remainingHours,
        completedHours,
        forecastHours,
        overrunHours: round1(overrunHours),
        reasons,
        riskScore,
        severity
    };
}

function buildOwnerRiskRows(taskFacts: ITaskFact[]): IOwnerRiskRow[] {
    const map = new Map<string, IOwnerRiskRow & { totalRisk: number }>();

    for (const fact of taskFacts) {
        if (!map.has(fact.owner)) {
            map.set(fact.owner, {
                owner: fact.owner,
                openTasks: 0,
                atRiskTasks: 0,
                overdueTasks: 0,
                overrunTasks: 0,
                blockedTasks: 0,
                remainingHours: 0,
                avgRiskScore: 0,
                totalRisk: 0
            });
        }

        const row = map.get(fact.owner)!;
        row.openTasks += 1;
        row.remainingHours += fact.remainingHours;

        if (fact.reasons.length > 0) row.atRiskTasks += 1;
        if (fact.reasons.includes('Overdue')) row.overdueTasks += 1;
        if (fact.reasons.includes('Overrun')) row.overrunTasks += 1;
        if (fact.reasons.includes('Blocked')) row.blockedTasks += 1;
        row.totalRisk += fact.riskScore;
    }

    return Array.from(map.values())
        .map(row => ({
            owner: row.owner,
            openTasks: row.openTasks,
            atRiskTasks: row.atRiskTasks,
            overdueTasks: row.overdueTasks,
            overrunTasks: row.overrunTasks,
            blockedTasks: row.blockedTasks,
            remainingHours: round1(row.remainingHours),
            avgRiskScore: row.openTasks > 0 ? Math.round(row.totalRisk / row.openTasks) : 0
        }))
        .sort((a, b) => {
            if (b.avgRiskScore !== a.avgRiskScore) return b.avgRiskScore - a.avgRiskScore;
            if (b.remainingHours !== a.remainingHours) return b.remainingHours - a.remainingHours;
            return b.openTasks - a.openTasks;
        });
}

function calculateLoadBalanceScore(ownerRows: IOwnerRiskRow[]): number {
    const loads = ownerRows.map(r => r.remainingHours).filter(v => v > 0);
    if (loads.length <= 1) return 100;
    const mean = loads.reduce((sum, v) => sum + v, 0) / loads.length;
    if (mean <= 0) return 100;
    const variance = loads.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / loads.length;
    const coeffVar = Math.sqrt(variance) / mean;
    return Math.max(0, Math.min(100, Math.round(100 - coeffVar * 100)));
}

function calculateHealthScore(input: {
    openTasks: number;
    overdueTasks: number;
    overrunTasks: number;
    blockedTasks: number;
    unassignedTasks: number;
    noEstimateTasks: number;
}): number {
    if (input.openTasks <= 0) return 100;
    const overduePenalty = (input.overdueTasks / input.openTasks) * 40;
    const overrunPenalty = (input.overrunTasks / input.openTasks) * 25;
    const blockedPenalty = (input.blockedTasks / input.openTasks) * 25;
    const unassignedPenalty = (input.unassignedTasks / input.openTasks) * 20;
    const noEstimatePenalty = (input.noEstimateTasks / input.openTasks) * 10;
    const score = Math.round(100 - overduePenalty - overrunPenalty - blockedPenalty - unassignedPenalty - noEstimatePenalty);
    return Math.max(0, Math.min(100, score));
}

function calculateDeliveryConfidence(input: {
    completion: number;
    health: number;
    estimateCoverage: number;
    assignmentCoverage: number;
    loadBalance: number;
}): number {
    const weighted = (
        input.completion * 0.30 +
        input.health * 0.30 +
        input.estimateCoverage * 0.15 +
        input.assignmentCoverage * 0.15 +
        input.loadBalance * 0.10
    );
    return Math.round(Math.max(0, Math.min(100, weighted)));
}

function matchesRiskFilter(row: IRiskRow, filter: RiskFilter): boolean {
    if (filter === 'all') return true;
    if (filter === 'overdue') return row.reasons.includes('Overdue');
    if (filter === 'overrun') return row.reasons.includes('Overrun');
    if (filter === 'blocked') return row.reasons.includes('Blocked');
    if (filter === 'unassigned') return row.reasons.includes('Unassigned');
    if (filter === 'no_estimate') return row.reasons.includes('No Estimate');
    return true;
}

function buildAdvancedMetrics(analysis: IAnalysis): IAdvancedMetric[] {
    return [
        {
            label: 'Schedule Pressure',
            value: `${analysis.schedulePressurePercent}% due in 7 days`,
            tone: analysis.schedulePressurePercent >= 45 ? 'danger' : analysis.schedulePressurePercent >= 25 ? 'warning' : 'success'
        },
        {
            label: 'Estimate Coverage',
            value: `${analysis.estimateCoveragePercent}%`,
            tone: toneFromScore(analysis.estimateCoveragePercent)
        },
        {
            label: 'Assignment Coverage',
            value: `${analysis.assignmentCoveragePercent}%`,
            tone: toneFromScore(analysis.assignmentCoveragePercent)
        },
        {
            label: 'Risk Density',
            value: `${analysis.riskDensityPercent}% of open tasks`,
            tone: analysis.riskDensityPercent >= 50 ? 'danger' : analysis.riskDensityPercent >= 30 ? 'warning' : 'success'
        },
        {
            label: 'Exposure Hours',
            value: `${analysis.exposureHours.toFixed(1)}h`,
            tone: analysis.exposureHours >= 80 ? 'danger' : analysis.exposureHours >= 40 ? 'warning' : 'default'
        },
        {
            label: 'Overrun Hours',
            value: `${analysis.overrunHours.toFixed(1)}h`,
            tone: analysis.overrunHours >= 40 ? 'danger' : analysis.overrunHours >= 20 ? 'warning' : 'default'
        },
        {
            label: 'Load Balance',
            value: `${analysis.loadBalanceScore}%`,
            tone: toneFromScore(analysis.loadBalanceScore)
        },
        {
            label: 'Delivery Confidence',
            value: `${analysis.deliveryConfidence}/100`,
            tone: toneFromScore(analysis.deliveryConfidence)
        }
    ];
}

function buildRiskBreakdown(analysis: IAnalysis): IRiskBreakdownRow[] {
    return [
        { label: 'Overdue', count: analysis.overdueTasks, percent: toPercent(analysis.overdueTasks, analysis.openTasks), tone: 'danger' },
        { label: 'Overrun', count: analysis.overrunTasks, percent: toPercent(analysis.overrunTasks, analysis.openTasks), tone: 'danger' },
        { label: 'Blocked', count: analysis.blockedTasks, percent: toPercent(analysis.blockedTasks, analysis.openTasks), tone: 'warning' },
        { label: 'Unassigned', count: analysis.unassignedTasks, percent: toPercent(analysis.unassignedTasks, analysis.openTasks), tone: 'warning' },
        { label: 'No Estimate', count: analysis.noEstimateTasks, percent: toPercent(analysis.noEstimateTasks, analysis.openTasks), tone: 'warning' }
    ];
}

function getRecommendedActions(analysis: IAnalysis): string[] {
    const actions: string[] = [];
    if (analysis.overdueTasks > 0) actions.push(`Review ${analysis.overdueTasks} overdue task(s) and re-baseline dates/scope.`);
    if (analysis.overrunTasks > 0) actions.push(`Re-estimate or reduce scope for ${analysis.overrunTasks} overrun task(s).`);
    if (analysis.blockedTasks > 0) actions.push(`Escalate ${analysis.blockedTasks} blocked task(s) and assign unblock owners.`);
    if (analysis.schedulePressurePercent >= 40) actions.push('Run near-term checkpoint: high portion of workload is due within 7 days.');
    if (analysis.assignmentCoveragePercent < 90) actions.push('Close assignment gaps to improve accountability.');
    if (analysis.estimateCoveragePercent < 85) actions.push('Increase estimate coverage to improve forecasting quality.');
    if (analysis.loadBalanceScore < 55) actions.push('Rebalance workload across owners to reduce concentration risk.');
    if (analysis.deliveryConfidence < 60) actions.push('Delivery confidence is low: run scope, sequencing, and dependency review this sprint.');
    return actions.slice(0, 8);
}

function toneFromScore(score: number): Tone {
    if (score >= 75) return 'success';
    if (score >= 50) return 'warning';
    return 'danger';
}

function toPercent(numerator: number, denominator: number, fallback: number = 0): number {
    if (denominator <= 0) return fallback;
    return Math.round((numerator / denominator) * 100);
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

export default DeliveryAnalysis;
