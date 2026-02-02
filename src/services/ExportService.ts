/**
 * Export Service
 * Provides functionality to export Gantt chart data to Excel/CSV format
 */

import { IWorkItemNode } from '../models/WorkItemModels';
import { formatShortDate } from '../utils/DateUtils';

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
     * Export work items to Excel-compatible format (CSV with BOM for proper Excel handling)
     */
    public exportToExcel(
        workItems: IWorkItemNode[],
        filename: string = 'gantt-export'
    ): void {
        const flatItems = this.flattenHierarchy(workItems);
        const csvContent = this.generateCSV(flatItems);
        // Add BOM for Excel to recognize UTF-8
        const bom = '\uFEFF';
        this.downloadFile(bom + csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
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
     * Generate CSV content from work items
     */
    private generateCSV(items: IWorkItemNode[]): string {
        // CSV Headers
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

        // Generate data rows
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

        // Convert to CSV string
        return rows.map(row =>
            row.map(cell => this.escapeCSVCell(cell)).join(',')
        ).join('\n');
    }

    /**
     * Escape a CSV cell value
     */
    private escapeCSVCell(value: string): string {
        // If value contains comma, quote, or newline, wrap in quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            // Double any quotes
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

        // Clean up the URL object
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

        // Only count root-level items for totals to avoid double counting
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
