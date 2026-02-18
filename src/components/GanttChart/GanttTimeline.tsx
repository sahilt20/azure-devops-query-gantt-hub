/**
 * Gantt Timeline Component
 * Renders the timeline header with months and days
 * Supports click-to-add-milestone on date columns
 */

import React, { useMemo } from 'react';
import {
    generateDateRange,
    formatShortDate,
    isWeekend,
    getColumnWidth,
    addDays
} from '../../utils/DateUtils';
import { IGanttConfig } from '../../models/WorkItemModels';

export interface IMilestone {
    id: string;
    date: Date;
    label: string;
    color: string;
}

interface IGanttTimelineProps {
    config: IGanttConfig;
    onDateClick?: (date: Date) => void;
    milestones?: IMilestone[];
}

export const GanttTimeline: React.FC<IGanttTimelineProps> = ({ config, onDateClick, milestones = [] }) => {
    const { startDate, endDate, viewMode } = config;

    // Generate dates based on view mode
    const dates = useMemo(() => {
        return generateDateRange(startDate, endDate, viewMode);
    }, [startDate, endDate, viewMode]);

    // Group dates by month/year for header row
    const headerGroups = useMemo(() => {
        if (viewMode === 'month') {
            // For month view, group by year
            const yearMap = new Map<number, { name: string; count: number }>();
            dates.forEach(date => {
                const year = date.getFullYear();
                if (!yearMap.has(year)) {
                    yearMap.set(year, { name: year.toString(), count: 1 });
                } else {
                    yearMap.get(year)!.count++;
                }
            });
            return Array.from(yearMap.values());
        } else {
            // For day/week view, group by month
            const monthMap = new Map<string, { name: string; count: number }>();
            dates.forEach(date => {
                const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                if (!monthMap.has(monthKey)) {
                    monthMap.set(monthKey, { name: monthName, count: 1 });
                } else {
                    monthMap.get(monthKey)!.count++;
                }
            });
            return Array.from(monthMap.values());
        }
    }, [dates, viewMode]);

    const columnWidth = getColumnWidth(viewMode);
    const totalWidth = dates.length * columnWidth;

    // Get display label for each column based on view mode
    const getColumnLabel = (date: Date): string => {
        switch (viewMode) {
            case 'day':
                return date.getDate().toString();
            case 'week':
                return `W${getWeekNumber(date)}`;
            case 'month':
                return date.toLocaleDateString('en-US', { month: 'short' });
            default:
                return date.getDate().toString();
        }
    };

    // Get week number (ISO week)
    const getWeekNumber = (date: Date): number => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };

    // Check if date column represents today
    const isToday = (date: Date): boolean => {
        const today = new Date();
        switch (viewMode) {
            case 'day':
                return date.toDateString() === today.toDateString();
            case 'week':
                const weekStart = new Date(date);
                const weekEnd = new Date(date);
                weekEnd.setDate(weekEnd.getDate() + 6);
                return today >= weekStart && today <= weekEnd;
            case 'month':
                return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
            default:
                return false;
        }
    };

    // Find milestone(s) for a given column date
    const getMilestonesForDate = (columnDate: Date): IMilestone[] => {
        return milestones.filter(m => {
            const md = m.date;
            if (viewMode === 'day') {
                return md.toDateString() === columnDate.toDateString();
            } else if (viewMode === 'week') {
                const weekEnd = addDays(columnDate, 6);
                return md >= columnDate && md <= weekEnd;
            } else {
                // month view
                return md.getMonth() === columnDate.getMonth() && md.getFullYear() === columnDate.getFullYear();
            }
        });
    };

    const getClickTitle = (date: Date): string => {
        if (onDateClick) {
            const colMilestones = getMilestonesForDate(date);
            if (colMilestones.length > 0) {
                return `${colMilestones.map(m => `📌 ${m.label}`).join(', ')} — click to add another milestone`;
            }
            return `Click to add milestone: ${formatShortDate(date)}`;
        }
        return formatShortDate(date);
    };

    return (
        <div className="gantt-timeline-header" style={{ width: totalWidth }}>
            {/* Header row (Year for month view, Month for day/week view) */}
            <div className="gantt-timeline-months">
                {headerGroups.map((group, index) => (
                    <div
                        key={index}
                        className="gantt-timeline-month"
                        style={{ width: group.count * columnWidth }}
                    >
                        {group.name}
                    </div>
                ))}
            </div>

            {/* Date columns row */}
            <div className="gantt-timeline-days">
                {dates.map((date, index) => {
                    const colMilestones = getMilestonesForDate(date);
                    const hasMilestone = colMilestones.length > 0;
                    return (
                        <div
                            key={index}
                            className={[
                                'gantt-timeline-day',
                                viewMode === 'day' && isWeekend(date) ? 'weekend' : '',
                                isToday(date) ? 'today' : '',
                                onDateClick ? 'gantt-timeline-day-clickable' : '',
                                hasMilestone ? 'gantt-timeline-day-has-milestone' : ''
                            ].filter(Boolean).join(' ')}
                            style={{ width: columnWidth }}
                            title={getClickTitle(date)}
                            onClick={() => onDateClick && onDateClick(date)}
                        >
                            {getColumnLabel(date)}
                            {hasMilestone && (
                                <span
                                    className="gantt-timeline-milestone-dot"
                                    style={{ backgroundColor: colMilestones[0].color }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GanttTimeline;
