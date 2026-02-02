/**
 * Date Range Picker Component
 * Allows users to select a date range for filtering the Gantt chart
 */

import React, { useState, useRef, useEffect } from 'react';
import { formatISODate, formatShortDate, addMonths, startOfMonth, addDays } from '../../utils/DateUtils';
import './DateRangePicker.css';

interface IDateRangePickerProps {
    startDate: Date;
    endDate: Date;
    onRangeChange: (start: Date, end: Date) => void;
}

export const DateRangePicker: React.FC<IDateRangePickerProps> = ({
    startDate,
    endDate,
    onRangeChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tempStart, setTempStart] = useState<Date>(startDate);
    const [tempEnd, setTempEnd] = useState<Date>(endDate);
    const [selectingStart, setSelectingStart] = useState(true);
    const [viewMonth, setViewMonth] = useState(startOfMonth(startDate));
    const containerRef = useRef<HTMLDivElement>(null);

    // Update temp dates when props change
    useEffect(() => {
        setTempStart(startDate);
        setTempEnd(endDate);
    }, [startDate, endDate]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            setTempStart(startDate);
            setTempEnd(endDate);
            setSelectingStart(true);
            setViewMonth(startOfMonth(startDate));
        }
    };

    const handleApply = () => {
        onRangeChange(tempStart, tempEnd);
        setIsOpen(false);
    };

    const handleCancel = () => {
        setTempStart(startDate);
        setTempEnd(endDate);
        setIsOpen(false);
    };

    const handleDateClick = (date: Date) => {
        if (selectingStart) {
            setTempStart(date);
            setSelectingStart(false);
            // If new start is after current end, reset end
            if (date > tempEnd) {
                setTempEnd(addDays(date, 7));
            }
        } else {
            if (date >= tempStart) {
                setTempEnd(date);
            } else {
                // If clicking before start, set as new start
                setTempStart(date);
            }
            setSelectingStart(true);
        }
    };

    const handlePrevMonth = () => {
        setViewMonth(addMonths(viewMonth, -1));
    };

    const handleNextMonth = () => {
        setViewMonth(addMonths(viewMonth, 1));
    };

    const generateCalendarDays = (monthStart: Date): Date[] => {
        const days: Date[] = [];
        const start = new Date(monthStart);

        // Start from the first day of the week containing the 1st
        start.setDate(1);
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);

        // Generate 42 days (6 weeks)
        for (let i = 0; i < 42; i++) {
            days.push(new Date(start));
            start.setDate(start.getDate() + 1);
        }

        return days;
    };

    const isInRange = (date: Date): boolean => {
        return date >= tempStart && date <= tempEnd;
    };

    const isSelected = (date: Date): boolean => {
        return formatISODate(date) === formatISODate(tempStart) ||
            formatISODate(date) === formatISODate(tempEnd);
    };

    const isCurrentMonth = (date: Date, monthStart: Date): boolean => {
        return date.getMonth() === monthStart.getMonth();
    };

    const renderCalendar = (monthOffset: number) => {
        const monthStart = addMonths(viewMonth, monthOffset);
        const days = generateCalendarDays(monthStart);
        const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        return (
            <div className="date-range-calendar">
                <div className="calendar-header">
                    {monthOffset === 0 && (
                        <button className="calendar-nav-btn" onClick={handlePrevMonth}>
                            ‹
                        </button>
                    )}
                    <span className="calendar-month-name">{monthName}</span>
                    {monthOffset === 1 && (
                        <button className="calendar-nav-btn" onClick={handleNextMonth}>
                            ›
                        </button>
                    )}
                </div>
                <div className="calendar-weekdays">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="calendar-weekday">{day}</div>
                    ))}
                </div>
                <div className="calendar-days">
                    {days.map((date, idx) => (
                        <button
                            key={idx}
                            className={`calendar-day 
                                ${isCurrentMonth(date, monthStart) ? '' : 'other-month'}
                                ${isInRange(date) ? 'in-range' : ''}
                                ${isSelected(date) ? 'selected' : ''}`}
                            onClick={() => handleDateClick(date)}
                        >
                            {date.getDate()}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="date-range-picker" ref={containerRef}>
            <button className="date-range-trigger" onClick={handleToggle}>
                <span className="date-range-icon">📅</span>
                <span className="date-range-text">
                    {formatShortDate(startDate)} — {formatShortDate(endDate)}
                </span>
                <span className="date-range-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="date-range-dropdown">
                    <div className="date-range-selection-info">
                        <div className={`date-selection ${selectingStart ? 'active' : ''}`}>
                            <label>From:</label>
                            <span>{formatShortDate(tempStart)}</span>
                        </div>
                        <div className={`date-selection ${!selectingStart ? 'active' : ''}`}>
                            <label>To:</label>
                            <span>{formatShortDate(tempEnd)}</span>
                        </div>
                    </div>

                    <div className="date-range-calendars">
                        {renderCalendar(0)}
                        {renderCalendar(1)}
                    </div>

                    <div className="date-range-actions">
                        <button className="date-range-btn cancel" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button className="date-range-btn apply" onClick={handleApply}>
                            Apply
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
