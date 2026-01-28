/**
 * Main Gantt Chart Component
 * Combines all sub-components to render the complete Gantt chart view
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { IWorkItemNode, IGanttConfig } from '../../models/WorkItemModels';
import { workItemHierarchyService } from '../../services/WorkItemHierarchyService';
import { effortRollupService } from '../../services/EffortRollupService';
import {
    minDate,
    maxDate,
    addDays,
    diffInDays,
    getDatePositionPercent
} from '../../utils/DateUtils';
import { GanttRow } from './GanttRow';
import { GanttBar } from './GanttBar';
import { GanttTimeline } from './GanttTimeline';
import './GanttChart.css';

interface IGanttChartProps {
    workItems: IWorkItemNode[];
    isLoading?: boolean;
    onWorkItemClick?: (workItem: IWorkItemNode) => void;
}

export const GanttChart: React.FC<IGanttChartProps> = ({
    workItems,
    isLoading = false,
    onWorkItemClick
}) => {
    const [hierarchy, setHierarchy] = useState<IWorkItemNode[]>([]);
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    const tableBodyRef = useRef<HTMLDivElement>(null);
    const timelineBodyRef = useRef<HTMLDivElement>(null);

    // Process work items into hierarchy
    useEffect(() => {
        if (workItems.length > 0) {
            // Deep copy to avoid mutating props
            const cloned = JSON.parse(JSON.stringify(workItems));
            effortRollupService.calculateRollup(cloned);
            setHierarchy(cloned);
        } else {
            setHierarchy([]);
        }
    }, [workItems]);

    // Flatten hierarchy for rendering (respecting expand/collapse state)
    const flattenedItems = useMemo(() => {
        return workItemHierarchyService.flattenHierarchy(hierarchy, true);
    }, [hierarchy]);

    // Calculate date range for the timeline
    const dateRange = useMemo(() => {
        if (flattenedItems.length === 0) {
            const today = new Date();
            return {
                start: addDays(today, -7),
                end: addDays(today, 30)
            };
        }

        const allDates: Date[] = [];

        for (const item of flattenedItems) {
            if (item.calculatedStartDate) allDates.push(item.calculatedStartDate);
            if (item.calculatedEndDate) allDates.push(item.calculatedEndDate);
            if (item.startDate) allDates.push(item.startDate);
            if (item.targetDate) allDates.push(item.targetDate);
        }

        if (allDates.length === 0) {
            const today = new Date();
            return {
                start: addDays(today, -7),
                end: addDays(today, 30)
            };
        }

        const min = minDate(...allDates)!;
        const max = maxDate(...allDates)!;

        // Add some padding
        return {
            start: addDays(min, -7),
            end: addDays(max, 14)
        };
    }, [flattenedItems]);

    // Gantt configuration
    const ganttConfig: IGanttConfig = useMemo(() => ({
        startDate: dateRange.start,
        endDate: dateRange.end,
        viewMode,
        showWeekends: true,
        rowHeight: 44,
        headerHeight: 60,
        columnWidth: viewMode === 'day' ? 30 : viewMode === 'week' ? 100 : 150
    }), [dateRange, viewMode]);

    // Calculate total stats
    const stats = useMemo(() => {
        return effortRollupService.getTotalStats(hierarchy);
    }, [hierarchy]);

    // Handle node toggle (expand/collapse)
    const handleToggle = useCallback((nodeId: number) => {
        setHierarchy(prev => {
            const toggle = (items: IWorkItemNode[]): IWorkItemNode[] => {
                return items.map(node => {
                    if (node.id === nodeId) {
                        return { ...node, isExpanded: !node.isExpanded };
                    }
                    if (node.children.length > 0) {
                        return { ...node, children: toggle(node.children) };
                    }
                    return node;
                });
            };
            return toggle(prev);
        });
    }, []);

    // Expand all
    const handleExpandAll = useCallback(() => {
        setHierarchy(prev => {
            const cloned = JSON.parse(JSON.stringify(prev));
            workItemHierarchyService.expandAll(cloned);
            return cloned;
        });
    }, []);

    // Collapse all
    const handleCollapseAll = useCallback(() => {
        setHierarchy(prev => {
            const cloned = JSON.parse(JSON.stringify(prev));
            workItemHierarchyService.collapseAll(cloned);
            return cloned;
        });
    }, []);

    // Sync scroll between table and timeline
    useEffect(() => {
        const tableBody = tableBodyRef.current;
        const timelineBody = timelineBodyRef.current;

        if (!tableBody || !timelineBody) return;

        const handleTableScroll = () => {
            if (timelineBody) {
                timelineBody.scrollTop = tableBody.scrollTop;
            }
        };

        const handleTimelineScroll = () => {
            if (tableBody) {
                tableBody.scrollTop = timelineBody.scrollTop;
            }
        };

        tableBody.addEventListener('scroll', handleTableScroll);
        timelineBody.addEventListener('scroll', handleTimelineScroll);

        return () => {
            tableBody.removeEventListener('scroll', handleTableScroll);
            timelineBody.removeEventListener('scroll', handleTimelineScroll);
        };
    }, []);

    // Calculate bar position for a work item
    const getBarPosition = (item: IWorkItemNode) => {
        const start = item.calculatedStartDate || item.startDate;
        const end = item.calculatedEndDate || item.targetDate;

        if (!start || !end) {
            return { startPercent: -1, widthPercent: 0 };
        }

        const startPercent = getDatePositionPercent(start, dateRange.start, dateRange.end);
        const endPercent = getDatePositionPercent(end, dateRange.start, dateRange.end);
        const widthPercent = endPercent - startPercent;

        return { startPercent, widthPercent };
    };

    // Calculate timeline width
    const timelineWidth = useMemo(() => {
        const days = diffInDays(dateRange.start, dateRange.end);
        return days * ganttConfig.columnWidth;
    }, [dateRange, ganttConfig.columnWidth]);

    // Get today's position
    const todayPosition = useMemo(() => {
        const today = new Date();
        return getDatePositionPercent(today, dateRange.start, dateRange.end);
    }, [dateRange]);

    // Render loading state
    if (isLoading) {
        return (
            <div className="gantt-chart">
                <div className="gantt-loading">
                    <div className="gantt-loading-spinner" />
                    <span>Loading work items...</span>
                </div>
            </div>
        );
    }

    // Render empty state
    if (flattenedItems.length === 0) {
        return (
            <div className="gantt-chart">
                <div className="gantt-empty">
                    <div className="gantt-empty-icon">📊</div>
                    <div className="gantt-empty-title">No Work Items</div>
                    <p>Select a query to view work items in the Gantt chart.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="gantt-chart">
            {/* Toolbar */}
            <div className="gantt-toolbar">
                <div className="gantt-toolbar-left">
                    <span className="gantt-toolbar-title">Gantt Chart</span>
                    <div className="gantt-toolbar-stats">
                        <span className="gantt-stat">
                            <span>Items:</span>
                            <span className="gantt-stat-value">{stats.itemCount}</span>
                        </span>
                        <span className="gantt-stat">
                            <span>Total Effort:</span>
                            <span className="gantt-stat-value">{stats.totalEffort}h</span>
                        </span>
                        <span className="gantt-stat">
                            <span>Overall:</span>
                            <span className="gantt-stat-value">{stats.overallPercent}%</span>
                        </span>
                    </div>
                </div>
                <div className="gantt-toolbar-right">
                    {/* View Mode Toggle */}
                    <div className="gantt-view-modes">
                        <button
                            className={`gantt-view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
                            onClick={() => setViewMode('day')}
                        >
                            Day
                        </button>
                        <button
                            className={`gantt-view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
                            onClick={() => setViewMode('week')}
                        >
                            Week
                        </button>
                        <button
                            className={`gantt-view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
                            onClick={() => setViewMode('month')}
                        >
                            Month
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <button className="gantt-btn" onClick={handleExpandAll}>
                        Expand All
                    </button>
                    <button className="gantt-btn" onClick={handleCollapseAll}>
                        Collapse All
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="gantt-content">
                {/* Left Panel - Work Items Table */}
                <div className="gantt-table">
                    <div className="gantt-table-header">
                        <div className="gantt-table-header-cell">Work Item</div>
                        <div className="gantt-table-header-cell">Effort</div>
                        <div className="gantt-table-header-cell">Remaining</div>
                        <div className="gantt-table-header-cell">Done</div>
                    </div>
                    <div className="gantt-table-body" ref={tableBodyRef}>
                        {flattenedItems.map(item => (
                            <GanttRow
                                key={item.id}
                                workItem={item}
                                onToggle={handleToggle}
                                onClick={onWorkItemClick}
                            />
                        ))}
                    </div>
                </div>

                {/* Right Panel - Timeline */}
                <div className="gantt-timeline">
                    <GanttTimeline config={ganttConfig} />
                    <div className="gantt-timeline-body" ref={timelineBodyRef}>
                        {/* Grid lines */}
                        <div className="gantt-timeline-grid" style={{ width: timelineWidth }}>
                            {/* Today line */}
                            {todayPosition >= 0 && todayPosition <= 100 && (
                                <div
                                    className="gantt-timeline-today-line"
                                    style={{ left: `${todayPosition}%` }}
                                />
                            )}
                        </div>

                        {/* Timeline rows with bars */}
                        {flattenedItems.map(item => {
                            const pos = getBarPosition(item);
                            return (
                                <div
                                    key={item.id}
                                    className="gantt-timeline-row"
                                    style={{ width: timelineWidth }}
                                >
                                    <GanttBar
                                        workItem={item}
                                        startPercent={pos.startPercent}
                                        widthPercent={pos.widthPercent}
                                        onClick={onWorkItemClick}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GanttChart;
