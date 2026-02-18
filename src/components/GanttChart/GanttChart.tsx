/**
 * Main Gantt Chart Component
 * Combines all sub-components to render the complete Gantt chart view
 * Features: Unified scroll, resizable columns
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
    getDatePositionPercent,
    getTimelineWidth,
    getColumnWidth
} from '../../utils/DateUtils';
import { GanttRow } from './GanttRow';
import { GanttBar } from './GanttBar';
import { GanttTimeline, IMilestone } from './GanttTimeline';
import { DateRangePicker } from './DateRangePicker';
import { SettingsPanel } from '../FieldConfig/SettingsPanel';
import './GanttChart.css';

const MILESTONE_COLORS = ['#9f7aea', '#f6ad55', '#68d391', '#f687b3', '#76e4f7', '#fc8181'];

function loadMilestonesFromStorage(): IMilestone[] {
    try {
        const stored = localStorage.getItem('gantt-milestones');
        if (stored) {
            const parsed = JSON.parse(stored) as Array<{ id: string; date: string; label: string; color: string }>;
            return parsed.map(m => ({ ...m, date: new Date(m.date) }));
        }
    } catch { /* ignore */ }
    return [];
}

interface IGanttChartProps {
    workItems: IWorkItemNode[];
    isLoading?: boolean;
    onWorkItemClick?: (workItem: IWorkItemNode) => void;
    onRefresh?: () => void;
}

// Default column widths
const DEFAULT_COLUMN_WIDTHS = {
    title: 250,
    effort: 70,
    remaining: 80,
    done: 60
};

export const GanttChart: React.FC<IGanttChartProps> = ({
    workItems,
    isLoading = false,
    onWorkItemClick,
    onRefresh
}) => {
    const [hierarchy, setHierarchy] = useState<IWorkItemNode[]>([]);
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
    const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
    const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
    const [resizing, setResizing] = useState<{ column: string; startX: number; startWidth: number } | null>(null);
    const [showFieldConfig, setShowFieldConfig] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Milestones / bookmarks
    const [milestones, setMilestones] = useState<IMilestone[]>(loadMilestonesFromStorage);
    const [showMilestoneModal, setShowMilestoneModal] = useState(false);
    const [pendingMilestoneDate, setPendingMilestoneDate] = useState<Date | null>(null);
    const [milestoneInputLabel, setMilestoneInputLabel] = useState('');
    const milestoneInputRef = useRef<HTMLInputElement>(null);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const ganttContentRef = useRef<HTMLDivElement>(null);
    const ganttChartRef = useRef<HTMLDivElement>(null);

    // Process work items into hierarchy
    useEffect(() => {
        if (workItems.length > 0) {
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

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.gantt-export-dropdown')) {
                setShowExportMenu(false);
            }
        };

        if (showExportMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showExportMenu]);

    // Flatten hierarchy for rendering
    const flattenedItems = useMemo(() => {
        return workItemHierarchyService.flattenHierarchy(hierarchy, true);
    }, [hierarchy]);

    // Calculate default date range
    const defaultDateRange = useMemo(() => {
        if (flattenedItems.length === 0) {
            const today = new Date();
            return { start: addDays(today, -7), end: addDays(today, 30) };
        }

        const startDates: Date[] = [];
        const endDates: Date[] = [];

        for (const item of flattenedItems) {
            if (item.startDate) startDates.push(item.startDate);
            if (item.iterationStartDate) startDates.push(item.iterationStartDate);
            if (item.createdDate) startDates.push(item.createdDate);
            if (item.calculatedStartDate) startDates.push(item.calculatedStartDate);
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

    // Active date range
    const dateRange = useMemo(() => {
        if (customDateRange) return customDateRange;
        return {
            start: addDays(defaultDateRange.start, -7),
            end: addDays(defaultDateRange.end, 14)
        };
    }, [customDateRange, defaultDateRange]);

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
        headerHeight: 70,
        columnWidth: getColumnWidth(viewMode)
    }), [dateRange, viewMode]);

    // Stats
    const stats = useMemo(() => effortRollupService.getTotalStats(hierarchy), [hierarchy]);

    // Handlers
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

    const handleExpandAll = useCallback(() => {
        setHierarchy(prev => {
            const cloned = JSON.parse(JSON.stringify(prev));
            workItemHierarchyService.expandAll(cloned);
            return cloned;
        });
    }, []);

    const handleCollapseAll = useCallback(() => {
        setHierarchy(prev => {
            const cloned = JSON.parse(JSON.stringify(prev));
            workItemHierarchyService.collapseAll(cloned);
            return cloned;
        });
    }, []);

    // Persist milestones to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('gantt-milestones', JSON.stringify(milestones));
        } catch { /* ignore */ }
    }, [milestones]);

    // Auto-focus milestone input when modal opens
    useEffect(() => {
        if (showMilestoneModal && milestoneInputRef.current) {
            milestoneInputRef.current.focus();
        }
    }, [showMilestoneModal]);

    // Milestone handlers
    const handleDateClick = useCallback((date: Date) => {
        setPendingMilestoneDate(date);
        setMilestoneInputLabel('');
        setShowMilestoneModal(true);
    }, []);

    const handleAddMilestone = useCallback(() => {
        if (!pendingMilestoneDate || !milestoneInputLabel.trim()) return;
        const newMilestone: IMilestone = {
            id: `milestone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            date: pendingMilestoneDate,
            label: milestoneInputLabel.trim(),
            color: MILESTONE_COLORS[milestones.length % MILESTONE_COLORS.length]
        };
        setMilestones(prev => [...prev, newMilestone]);
        setShowMilestoneModal(false);
        setMilestoneInputLabel('');
        setPendingMilestoneDate(null);
    }, [pendingMilestoneDate, milestoneInputLabel, milestones.length]);

    const handleRemoveMilestone = useCallback((id: string) => {
        setMilestones(prev => prev.filter(m => m.id !== id));
    }, []);

    // Sync scroll between body and timeline header
    const handleScroll = useCallback(() => {
        if (scrollContainerRef.current && timelineScrollRef.current) {
            timelineScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft;
        }
    }, []);

    const handleExportExcel = useCallback(async () => {
        if (isExporting) return;
        setIsExporting(true);
        setShowExportMenu(false);

        try {
            const timestamp = new Date().toISOString().split('T')[0];
            exportService.exportToExcelOnly(hierarchy, `gantt-export-${timestamp}`);
        } catch (error) {
            console.error('Excel export failed:', error);
        } finally {
            setIsExporting(false);
        }
    }, [hierarchy, isExporting]);

    const handleExportScreenshot = useCallback(async () => {
        if (isExporting) return;
        setIsExporting(true);
        setShowExportMenu(false);

        try {
            const timestamp = new Date().toISOString().split('T')[0];
            await exportService.exportScreenshotOnly(ganttChartRef.current, `gantt-export-${timestamp}-chart`);
        } catch (error) {
            console.error('Screenshot export failed:', error);
        } finally {
            setIsExporting(false);
        }
    }, [isExporting]);

    // Column resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
        e.preventDefault();
        setResizing({
            column,
            startX: e.clientX,
            startWidth: columnWidths[column as keyof typeof columnWidths]
        });
    }, [columnWidths]);

    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const diff = e.clientX - resizing.startX;
            const newWidth = Math.max(40, resizing.startWidth + diff);
            setColumnWidths(prev => ({
                ...prev,
                [resizing.column]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    // Calculate bar position
    const getBarPosition = (item: IWorkItemNode) => {
        const start = item.calculatedStartDate || item.startDate || item.iterationStartDate || item.createdDate;
        const end = item.calculatedEndDate || item.targetDate || item.devCompletionDate || item.qaCompletionDate || (start ? addDays(start, 1) : null);

        if (!start || !end) {
            return { startPercent: -1, widthPercent: 0 };
        }

        let startPercent = getDatePositionPercent(start, dateRange.start, dateRange.end);
        let endPercent = getDatePositionPercent(end, dateRange.start, dateRange.end);

        if (endPercent < startPercent) {
            [startPercent, endPercent] = [endPercent, startPercent];
        }

        return { startPercent, widthPercent: Math.max(0.5, endPercent - startPercent) };
    };

    // Timeline width - use centralized function for consistency with GanttTimeline
    const timelineWidth = useMemo(() => {
        return getTimelineWidth(dateRange.start, dateRange.end, viewMode);
    }, [dateRange, viewMode]);

    // Today position
    const todayPosition = useMemo(() => {
        const today = new Date();
        return getDatePositionPercent(today, dateRange.start, dateRange.end);
    }, [dateRange]);

    // Total table width
    const tableWidth = columnWidths.title + columnWidths.effort + columnWidths.remaining + columnWidths.done;

    // Grid template for columns
    const gridTemplate = `${columnWidths.title}px ${columnWidths.effort}px ${columnWidths.remaining}px ${columnWidths.done}px`;

    // Loading state
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

    // Empty state
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
        <div className={`gantt-chart ${resizing ? 'resizing' : ''}`}>
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
                            <span>Remaining:</span>
                            <span className="gantt-stat-value">{stats.totalRemaining}h</span>
                        </span>
                        <span className="gantt-stat">
                            <span>Overall Done:</span>
                            <span className="gantt-stat-value">{stats.overallPercent}%</span>
                        </span>
                    </div>
                </div>
                <div className="gantt-toolbar-right">
                    <button
                        className="gantt-btn gantt-btn-refresh"
                        onClick={onRefresh}
                        title="Refresh Data"
                    >
                        🔄
                    </button>
                    <DateRangePicker
                        startDate={customDateRange?.start || defaultDateRange.start}
                        endDate={customDateRange?.end || defaultDateRange.end}
                        onRangeChange={handleDateRangeChange}
                    />
                    <div className="gantt-view-modes">
                        <button
                            className={`gantt-view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
                            onClick={() => setViewMode('day')}
                        >Day</button>
                        <button
                            className={`gantt-view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
                            onClick={() => setViewMode('week')}
                        >Week</button>
                        <button
                            className={`gantt-view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
                            onClick={() => setViewMode('month')}
                        >Month</button>
                    </div>
                    <button className="gantt-btn" onClick={handleExpandAll}>Expand All</button>
                    <button className="gantt-btn" onClick={handleCollapseAll}>Collapse All</button>

                    {/* Export Dropdown */}
                    <div className="gantt-export-dropdown">
                        <button
                            className="gantt-btn gantt-btn-export"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                            disabled={isExporting}
                        >
                            {isExporting ? '⏳ Exporting...' : '📥 Export ▼'}
                        </button>
                        {showExportMenu && !isExporting && (
                            <div className="gantt-export-menu">
                                <button
                                    className="gantt-export-menu-item"
                                    onClick={handleExportExcel}
                                >
                                    📊 Export to Excel
                                </button>
                                <button
                                    className="gantt-export-menu-item"
                                    onClick={handleExportScreenshot}
                                >
                                    📷 Export Gantt Screenshot
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Settings Button (Rightmost) */}
                    <button
                        className="gantt-btn gantt-btn-settings"
                        onClick={() => setShowFieldConfig(true)}
                        title="Settings"
                    >
                        ⚙️ Settings
                    </button>
                </div>
            </div>

            {/* Gantt Chart Content (for screenshot - includes headers and body) */}
            <div className="gantt-chart-content" ref={ganttChartRef}>
                {/* Headers Row */}
                <div className="gantt-headers">
                {/* Table Header */}
                <div className="gantt-table-header" style={{ width: tableWidth, gridTemplateColumns: gridTemplate }}>
                    <div className="gantt-table-header-cell">
                        Work Item
                        <div className="gantt-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'title')} />
                    </div>
                    <div className="gantt-table-header-cell">
                        Effort
                        <div className="gantt-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'effort')} />
                    </div>
                    <div className="gantt-table-header-cell">
                        Remaining
                        <div className="gantt-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'remaining')} />
                    </div>
                    <div className="gantt-table-header-cell">
                        Done
                        <div className="gantt-resize-handle" onMouseDown={(e) => handleResizeStart(e, 'done')} />
                    </div>
                </div>

                {/* Timeline Header */}
                <div className="gantt-timeline-header-wrapper" ref={timelineScrollRef}>
                    <GanttTimeline
                        config={ganttConfig}
                        onDateClick={handleDateClick}
                        milestones={milestones}
                    />
                </div>
            </div>

            {/* Single Scroll Container for Body */}
            <div className="gantt-scroll-container" ref={scrollContainerRef} onScroll={handleScroll}>
                <div className="gantt-scroll-content" ref={ganttContentRef}>
                    {/* Table Body */}
                    <div className="gantt-table-body" style={{ width: tableWidth }}>
                        {flattenedItems.map(item => (
                            <GanttRow
                                key={item.id}
                                workItem={item}
                                onToggle={handleToggle}
                                columnWidths={columnWidths}
                            />
                        ))}
                    </div>

                    {/* Timeline Body */}
                    <div className="gantt-timeline-body" style={{ width: timelineWidth }}>
                        {/* Grid with today line */}
                        <div className="gantt-timeline-grid">
                            {todayPosition >= 0 && todayPosition <= 100 && (
                                <div
                                    className="gantt-timeline-today-line"
                                    style={{ left: `${todayPosition}%` }}
                                />
                            )}
                        </div>

                        {/* Milestone / bookmark vertical lines */}
                        {milestones.map(milestone => {
                            const pos = getDatePositionPercent(milestone.date, dateRange.start, dateRange.end);
                            if (pos < 0 || pos > 100) return null;
                            return (
                                <div
                                    key={milestone.id}
                                    className="gantt-milestone-line"
                                    style={{ left: `${pos}%`, borderLeftColor: milestone.color }}
                                    title={`📌 ${milestone.label} — ${milestone.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}\nClick to remove`}
                                    onClick={() => handleRemoveMilestone(milestone.id)}
                                >
                                    <div
                                        className="gantt-milestone-flag"
                                        style={{ backgroundColor: milestone.color }}
                                    >
                                        📌
                                    </div>
                                    <div
                                        className="gantt-milestone-label"
                                        style={{ color: milestone.color, borderColor: milestone.color }}
                                    >
                                        {milestone.label}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Timeline rows with bars */}
                        {flattenedItems.map(item => {
                            const pos = getBarPosition(item);
                            return (
                                <div key={item.id} className="gantt-timeline-row">
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

            {/* Settings Panel */}
            <SettingsPanel
                isOpen={showFieldConfig}
                onClose={() => setShowFieldConfig(false)}
                onSave={() => {
                    // Trigger refresh to recalculate with new fields
                    if (onRefresh) onRefresh();
                }}
            />

            {/* Milestone / Bookmark Modal */}
            {showMilestoneModal && pendingMilestoneDate && (
                <div
                    className="gantt-milestone-modal-overlay"
                    onClick={() => setShowMilestoneModal(false)}
                >
                    <div
                        className="gantt-milestone-modal"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="gantt-milestone-modal-header">
                            <span>📌 Add Milestone</span>
                            <button
                                className="gantt-milestone-modal-close"
                                onClick={() => setShowMilestoneModal(false)}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>
                        <div className="gantt-milestone-modal-body">
                            <div className="gantt-milestone-modal-date">
                                {pendingMilestoneDate.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </div>
                            <input
                                ref={milestoneInputRef}
                                type="text"
                                className="gantt-milestone-modal-input"
                                placeholder="Enter milestone name..."
                                value={milestoneInputLabel}
                                onChange={e => setMilestoneInputLabel(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddMilestone();
                                    if (e.key === 'Escape') setShowMilestoneModal(false);
                                }}
                            />
                        </div>
                        <div className="gantt-milestone-modal-actions">
                            <button
                                className="gantt-btn"
                                onClick={() => setShowMilestoneModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="gantt-btn gantt-btn-milestone-add"
                                onClick={handleAddMilestone}
                                disabled={!milestoneInputLabel.trim()}
                            >
                                Add Milestone
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GanttChart;
