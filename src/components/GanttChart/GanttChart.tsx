/**
 * Main Gantt Chart Component
 * Combines all sub-components to render the complete Gantt chart view
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { IWorkItemNode, IGanttConfig } from '../../models/WorkItemModels';
import { workItemHierarchyService } from '../../services/WorkItemHierarchyService';
import { effortRollupService } from '../../services/EffortRollupService';
import { exportService } from '../../services/ExportService';
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
import { DateRangePicker } from './DateRangePicker';
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
    const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
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

    // Reset custom date range when work items change
    useEffect(() => {
        setCustomDateRange(null);
    }, [workItems]);

    // Flatten hierarchy for rendering (respecting expand/collapse state)
    const flattenedItems = useMemo(() => {
        return workItemHierarchyService.flattenHierarchy(hierarchy, true);
    }, [hierarchy]);

    // Calculate default date range from work items (earliest Start → longest Target)
    const defaultDateRange = useMemo(() => {
        if (flattenedItems.length === 0) {
            const today = new Date();
            return {
                start: addDays(today, -7),
                end: addDays(today, 30)
            };
        }

        const startDates: Date[] = [];
        const endDates: Date[] = [];

        for (const item of flattenedItems) {
            // Collect start dates
            if (item.startDate) startDates.push(item.startDate);
            if (item.calculatedStartDate) startDates.push(item.calculatedStartDate);

            // Collect end dates (Target Date is the longest)
            if (item.targetDate) endDates.push(item.targetDate);
            if (item.calculatedEndDate) endDates.push(item.calculatedEndDate);
            if (item.devCompletionDate) endDates.push(item.devCompletionDate);
            if (item.qaCompletionDate) endDates.push(item.qaCompletionDate);
        }

        const earliestStart = minDate(...startDates);
        const longestEnd = maxDate(...endDates);

        const today = new Date();
        return {
            start: earliestStart || addDays(today, -7),
            end: longestEnd || addDays(today, 30)
        };
    }, [flattenedItems]);

    // Active date range (custom or default with padding)
    const dateRange = useMemo(() => {
        if (customDateRange) {
            return customDateRange;
        }

        // Add padding to default range for visual comfort
        return {
            start: addDays(defaultDateRange.start, -7),
            end: addDays(defaultDateRange.end, 14)
        };
    }, [customDateRange, defaultDateRange]);

    // Handle date range change from picker
    const handleDateRangeChange = useCallback((start: Date, end: Date) => {
        setCustomDateRange({ start, end });
    }, []);

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

    // Export to Excel/CSV with Gantt chart
    const handleExport = useCallback(() => {
        const timestamp = new Date().toISOString().split('T')[0];
        exportService.exportToExcel(hierarchy, `gantt-export-${timestamp}`, dateRange);
    }, [hierarchy, dateRange]);

    // Sync scroll between table and timeline - improved with requestAnimationFrame
    useEffect(() => {
        const tableBody = tableBodyRef.current;
        const timelineBody = timelineBodyRef.current;

        if (!tableBody || !timelineBody) return;

        let isScrollingTable = false;
        let isScrollingTimeline = false;

        const handleTableScroll = () => {
            if (isScrollingTimeline) return;
            isScrollingTable = true;
            requestAnimationFrame(() => {
                if (timelineBody) {
                    timelineBody.scrollTop = tableBody.scrollTop;
                }
                isScrollingTable = false;
            });
        };

        const handleTimelineScroll = () => {
            if (isScrollingTable) return;
            isScrollingTimeline = true;
            requestAnimationFrame(() => {
                if (tableBody) {
                    tableBody.scrollTop = timelineBody.scrollTop;
                }
                isScrollingTimeline = false;
            });
        };

        tableBody.addEventListener('scroll', handleTableScroll, { passive: true });
        timelineBody.addEventListener('scroll', handleTimelineScroll, { passive: true });

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
                    {/* Date Range Picker - Before view mode selector */}
                    <DateRangePicker
                        startDate={customDateRange?.start || defaultDateRange.start}
                        endDate={customDateRange?.end || defaultDateRange.end}
                        onRangeChange={handleDateRangeChange}
                    />

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
                    <button className="gantt-btn gantt-btn-export" onClick={handleExport}>
                        📥 Export
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
