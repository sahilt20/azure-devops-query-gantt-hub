/**
 * Export Service
 * Provides functionality to export Gantt chart data to Excel/CSV format
 * Includes visual Gantt bar representation using date columns
 */

import { IWorkItemNode } from '../models/WorkItemModels';
import { formatShortDate, addDays, diffInDays } from '../utils/DateUtils';

class ExportService {
    private static instance: ExportService;

    private constructor() { }

    public static getInstance(): ExportService {
        if (!ExportService.instance) {
            ExportService.instance = new ExportService();
        }
        return ExportService.instance;
    }

    /**
     * Export work items to CSV format and trigger download
     */
    public exportToCSV(
        workItems: IWorkItemNode[],
        filename: string = 'gantt-export'
    ): void {
        const flatItems = this.flattenHierarchy(workItems);
        const csvContent = this.generateCSV(flatItems);
        this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
    }

    /**
     * Export work items to Excel-compatible format with visual Gantt chart
     */
    public exportToExcel(
        workItems: IWorkItemNode[],
        filename: string = 'gantt-export',
        dateRange?: { start: Date; end: Date }
    ): void {
        const flatItems = this.flattenHierarchy(workItems);

        // Calculate date range from items if not provided
        const range = dateRange || this.calculateDateRange(flatItems);

        const csvContent = this.generateGanttCSV(flatItems, range);
        // Add BOM for Excel to recognize UTF-8
        const bom = '\uFEFF';
        this.downloadFile(bom + csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
    }

    /**
     * Calculate date range from work items
     */
    private calculateDateRange(items: IWorkItemNode[]): { start: Date; end: Date } {
        let minStart: Date | null = null;
        let maxEnd: Date | null = null;

        for (const item of items) {
            const start = item.calculatedStartDate || item.startDate;
            const end = item.calculatedEndDate || item.targetDate;

            if (start && (!minStart || start < minStart)) {
                minStart = start;
            }
            if (end && (!maxEnd || end > maxEnd)) {
                maxEnd = end;
            }
        }

        const today = new Date();
        return {
            start: minStart || addDays(today, -7),
            end: maxEnd || addDays(today, 30)
        };
    }

    /**
     * Flatten hierarchy to array for export
     */
    private flattenHierarchy(nodes: IWorkItemNode[]): IWorkItemNode[] {
        const result: IWorkItemNode[] = [];

        const traverse = (items: IWorkItemNode[], level: number) => {
            for (const node of items) {
                result.push({ ...node, level });
                if (node.children.length > 0) {
                    traverse(node.children, level + 1);
                }
            }
        };

        traverse(nodes, 0);
        return result;
    }

    /**
     * Generate CSV content with visual Gantt chart
     */
    private generateGanttCSV(items: IWorkItemNode[], dateRange: { start: Date; end: Date }): string {
        // Generate date columns (one per day)
        const days = diffInDays(dateRange.start, dateRange.end);
        const dateColumns: string[] = [];

        for (let i = 0; i <= days; i++) {
            const date = addDays(dateRange.start, i);
            dateColumns.push(this.formatDateColumn(date));
        }

        // CSV Headers - Data columns + Date columns for Gantt
        const headers = [
            'ID',
            'Level',
            'Type',
            'Title',
            'State',
            'Assigned To',
            'Start Date',
            'Target Date',
            'Effort (h)',
            'Remaining (h)',
            'Done %',
            '', // Separator
            ...dateColumns
        ];

        const rows: string[][] = [headers];

        // Generate data rows with Gantt bars
        for (const item of items) {
            const row = [
                item.id.toString(),
                item.level.toString(),
                item.workItemType,
                this.getIndentedTitle(item),
                item.state,
                item.assignedTo,
                item.calculatedStartDate ? formatShortDate(item.calculatedStartDate) : '',
                item.calculatedEndDate ? formatShortDate(item.calculatedEndDate) : '',
                item.rollupEffort.toString(),
                item.rollupRemainingWork.toString(),
                item.percentComplete.toString(),
                '', // Separator
                ...this.generateGanttBar(item, dateRange, days)
            ];
            rows.push(row);
        }

        // Convert to CSV string
        return rows.map(row =>
            row.map(cell => this.escapeCSVCell(cell)).join(',')
        ).join('\n');
    }

    /**
     * Generate simple CSV without Gantt chart
     */
    private generateCSV(items: IWorkItemNode[]): string {
        const headers = [
            'ID',
            'Level',
            'Type',
            'Title',
            'State',
            'Assigned To',
            'Start Date',
            'Target Date',
            'Effort (h)',
            'Remaining (h)',
            'Completed (h)',
            'Done %'
        ];

        const rows: string[][] = [headers];

        for (const item of items) {
            const row = [
                item.id.toString(),
                item.level.toString(),
                item.workItemType,
                item.title,
                item.state,
                item.assignedTo,
                item.calculatedStartDate ? formatShortDate(item.calculatedStartDate) : '',
                item.calculatedEndDate ? formatShortDate(item.calculatedEndDate) : '',
                item.rollupEffort.toString(),
                item.rollupRemainingWork.toString(),
                item.rollupCompletedWork.toString(),
                item.percentComplete.toString()
            ];
            rows.push(row);
        }

        return rows.map(row =>
            row.map(cell => this.escapeCSVCell(cell)).join(',')
        ).join('\n');
    }

    /**
     * Generate Gantt bar cells for a work item
     */
    private generateGanttBar(
        item: IWorkItemNode,
        dateRange: { start: Date; end: Date },
        totalDays: number
    ): string[] {
        const barCells: string[] = [];
        const start = item.calculatedStartDate || item.startDate;
        const end = item.calculatedEndDate || item.targetDate;

        for (let i = 0; i <= totalDays; i++) {
            const currentDate = addDays(dateRange.start, i);

            if (!start || !end) {
                barCells.push('');
                continue;
            }

            // Normalize dates for comparison (strip time)
            const currentDay = this.normalizeDate(currentDate);
            const startDay = this.normalizeDate(start);
            const endDay = this.normalizeDate(end);

            if (currentDay >= startDay && currentDay <= endDay) {
                // Use different symbols for different work item types
                const symbol = this.getBarSymbol(item.workItemType, item.percentComplete);
                barCells.push(symbol);
            } else {
                barCells.push('');
            }
        }

        return barCells;
    }

    /**
     * Get bar symbol based on work item type
     */
    private getBarSymbol(workItemType: string, percentComplete: number): string {
        // Use filled block for complete, half block for in-progress
        const baseSymbol = percentComplete === 100 ? '█' : percentComplete > 0 ? '▓' : '░';

        switch (workItemType) {
            case 'Epic': return `E${baseSymbol}`;
            case 'Feature': return `F${baseSymbol}`;
            case 'Product Backlog Item': return `P${baseSymbol}`;
            case 'Bug': return `B${baseSymbol}`;
            case 'Task': return `T${baseSymbol}`;
            case 'Release': return `R${baseSymbol}`;
            default: return baseSymbol;
        }
    }

    /**
     * Normalize date (strip time for comparison)
     */
    private normalizeDate(date: Date): number {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    /**
     * Format date for column header
     */
    private formatDateColumn(date: Date): string {
        const month = (date.getMonth() + 1).toString();
        const day = date.getDate().toString();
        return `${month}/${day}`;
    }

    /**
     * Get indented title based on level
     */
    private getIndentedTitle(item: IWorkItemNode): string {
        const indent = '  '.repeat(item.level);
        return `${indent}${item.title}`;
    }

    /**
     * Escape a CSV cell value
     */
    private escapeCSVCell(value: string): string {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    /**
     * Trigger file download
     */
    private downloadFile(content: string, filename: string, mimeType: string): void {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Get summary statistics for the export
     */
    public getExportSummary(workItems: IWorkItemNode[]): {
        totalItems: number;
        totalEffort: number;
        totalRemaining: number;
        overallProgress: number;
    } {
        const flatItems = this.flattenHierarchy(workItems);
        const rootItems = workItems;
        const totalEffort = rootItems.reduce((sum, item) => sum + item.rollupEffort, 0);
        const totalRemaining = rootItems.reduce((sum, item) => sum + item.rollupRemainingWork, 0);
        const totalCompleted = rootItems.reduce((sum, item) => sum + item.rollupCompletedWork, 0);

        return {
            totalItems: flatItems.length,
            totalEffort,
            totalRemaining,
            overallProgress: totalEffort > 0 ? Math.round((totalCompleted / totalEffort) * 100) : 0
        };
    }
}

export const exportService = ExportService.getInstance();
export default exportService;
