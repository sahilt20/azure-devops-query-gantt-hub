/**
 * Date utility functions for Gantt chart calculations
 */

/**
 * Get the start of the day (midnight)
 */
export function startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Get the end of the day (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * Get the start of the week (Sunday)
 */
export function startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    result.setDate(result.getDate() - day);
    return startOfDay(result);
}

/**
 * Get the start of the month
 */
export function startOfMonth(date: Date): Date {
    const result = new Date(date);
    result.setDate(1);
    return startOfDay(result);
}

/**
 * Get the end of the month
 */
export function endOfMonth(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1, 0);
    return endOfDay(result);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
    return addDays(date, weeks * 7);
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

/**
 * Get the difference in days between two dates
 */
export function diffInDays(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}

/**
 * Format date as short string (Jan 15)
 */
export function formatShortDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatISODate(date: Date): string {
    return date.toISOString().split('T')[0];
}

/**
 * Parse a date string from Azure DevOps
 */
export function parseAzureDate(dateString: string | null | undefined): Date | null {
    if (!dateString) return null;
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Get the minimum date from an array
 */
export function minDate(...dates: (Date | null)[]): Date | null {
    const validDates = dates.filter((d): d is Date => d !== null);
    if (validDates.length === 0) return null;
    return new Date(Math.min(...validDates.map(d => d.getTime())));
}

/**
 * Get the maximum date from an array
 */
export function maxDate(...dates: (Date | null)[]): Date | null {
    const validDates = dates.filter((d): d is Date => d !== null);
    if (validDates.length === 0) return null;
    return new Date(Math.max(...validDates.map(d => d.getTime())));
}

/**
 * Generate an array of dates between start and end
 */
export function generateDateRange(start: Date, end: Date, step: 'day' | 'week' | 'month' = 'day'): Date[] {
    const dates: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
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
export function getDatePositionPercent(date: Date, rangeStart: Date, rangeEnd: Date): number {
    const totalDays = diffInDays(rangeStart, rangeEnd);
    if (totalDays === 0) return 0;

    const daysFromStart = diffInDays(rangeStart, date);
    return Math.max(0, Math.min(100, (daysFromStart / totalDays) * 100));
}
