/**
 * Gantt Timeline Component
 * Renders the timeline header with months and days
 */

import React, { useMemo } from 'react';
import {
    generateDateRange,
    formatShortDate,
    isWeekend,
    addDays,
    startOfMonth,
    diffInDays
} from '../../utils/DateUtils';
import { IGanttConfig } from '../../models/WorkItemModels';

interface IGanttTimelineProps {
    config: IGanttConfig;
}

export const GanttTimeline: React.FC<IGanttTimelineProps> = ({ config }) => {
    const { startDate, endDate, viewMode } = config;

    // Generate dates for the timeline
    const dates = useMemo(() => {
        return generateDateRange(startDate, endDate, 'day');
    }, [startDate, endDate]);

    // Group dates by month for header
    const months = useMemo(() => {
        const monthMap = new Map<string, { name: string; days: number; startIndex: number }>();

        dates.forEach((date, index) => {
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, { name: monthName, days: 1, startIndex: index });
            } else {
                const month = monthMap.get(monthKey)!;
                month.days++;
            }
        });

        return Array.from(monthMap.values());
    }, [dates]);

    // Calculate column width based on view mode
    const getColumnWidth = (): number => {
        switch (viewMode) {
            case 'day': return 30;
            case 'week': return 100;
            case 'month': return 150;
            default: return 30;
        }
    };

    const columnWidth = getColumnWidth();
    const totalWidth = dates.length * columnWidth;

    // Get display label for a date based on view mode
    const getDayLabel = (date: Date): string => {
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

    // Get week number
    const getWeekNumber = (date: Date): number => {
        const start = new Date(date.getFullYear(), 0, 1);
        const diff = date.getTime() - start.getTime();
        const oneWeek = 604800000;
        return Math.ceil(diff / oneWeek);
    };

    // Check if date is today
    const isToday = (date: Date): boolean => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    return (
        <div className="gantt-timeline-header" style={{ width: totalWidth }}>
            {/* Month row */}
            <div className="gantt-timeline-months">
                {months.map((month, index) => (
                    <div
                        key={index}
                        className="gantt-timeline-month"
                        style={{ width: month.days * columnWidth }}
                    >
                        {month.name}
                    </div>
                ))}
            </div>

            {/* Days row */}
            <div className="gantt-timeline-days">
                {dates.map((date, index) => (
                    <div
                        key={index}
                        className={`gantt-timeline-day ${isWeekend(date) ? 'weekend' : ''} ${isToday(date) ? 'today' : ''}`}
                        style={{ width: columnWidth }}
                        title={formatShortDate(date)}
                    >
                        {getDayLabel(date)}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GanttTimeline;
