/**
 * Date utility functions for Gantt chart calculations
 */

/**
 * Ensure a value is a Date object (converts strings if needed)
 * This is the core utility for handling dates that may be serialized as strings
 */
export function toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/**
 * Get the start of the day (midnight)
 */
export function startOfDay(date: Date | string): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Get the end of the day (23:59:59.999)
 */
export function endOfDay(date: Date | string): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * Get the start of the week (Sunday)
 */
export function startOfWeek(date: Date | string): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return startOfDay(result);
}

/**
 * Get the start of the month
 */
export function startOfMonth(date: Date | string): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    result.setDate(1);
    return startOfDay(result);
}

/**
 * Get the end of the month
 */
export function endOfMonth(date: Date | string): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    result.setMonth(result.getMonth() + 1, 0);
    return endOfDay(result);
}

/**
 * Add days to a date
 */
export function addDays(date: Date | string, days: number): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date | string, weeks: number): Date {
    return addDays(date, weeks * 7);
}

/**
 * Add months to a date
 */
export function addMonths(date: Date | string, months: number): Date {
    const d = toDate(date);
    if (!d) return new Date();
    const result = new Date(d);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Get the difference in days between two dates
 */
export function diffInDays(start: Date | string, end: Date | string): number {
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date | string): boolean {
    const d = toDate(date);
    if (!d) return false;
    const day = d.getDay();
    return day === 0 || day === 6;
}

/**
 * Format date as short string (Jan 15)
 */
export function formatShortDate(date: Date | string): string {
    const d = toDate(date);
    if (!d) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatISODate(date: Date | string): string {
    const d = toDate(date);
    if (!d) return '';
    return d.toISOString().split('T')[0];
}

/**
 * Parse a date string from Azure DevOps
 */
export function parseAzureDate(dateString: string | null | undefined): Date | null {
    return toDate(dateString);
}

/**
 * Get the minimum date from an array
 */
export function minDate(...dates: (Date | string | null | undefined)[]): Date | null {
    const validDates = dates
        .map(d => toDate(d))
        .filter((d): d is Date => d !== null);
    if (validDates.length === 0) return null;
    return new Date(Math.min(...validDates.map(d => d.getTime())));
}

/**
 * Get the maximum date from an array
 */
export function maxDate(...dates: (Date | string | null | undefined)[]): Date | null {
    const validDates = dates
        .map(d => toDate(d))
        .filter((d): d is Date => d !== null);
    if (validDates.length === 0) return null;
    return new Date(Math.max(...validDates.map(d => d.getTime())));
}

/**
 * Generate an array of dates between start and end
 */
export function generateDateRange(start: Date | string, end: Date | string, step: 'day' | 'week' | 'month' = 'day'): Date[] {
    const startDate = toDate(start);
    const endDate = toDate(end);
    if (!startDate || !endDate) return [];

    const dates: Date[] = [];
    let current = new Date(startDate);

    while (current <= endDate) {
        dates.push(new Date(current));

        switch (step) {
            case 'day':
                current = addDays(current, 1);
                break;
            case 'week':
                current = addWeeks(current, 1);
                break;
            case 'month':
                current = addMonths(current, 1);
                break;
        }
    }

    return dates;
}

/**
 * Calculate the position of a date within a range as a percentage
 */
export function getDatePositionPercent(date: Date | string, rangeStart: Date | string, rangeEnd: Date | string): number {
    const totalDays = diffInDays(rangeStart, rangeEnd);
    if (totalDays === 0) return 0;

    const daysFromStart = diffInDays(rangeStart, date);
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
}
