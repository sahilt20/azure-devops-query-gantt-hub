/**
 * Export Service
 * Provides functionality to export Gantt chart data to Excel format
 * Creates proper Excel file with formatted table + separate PNG screenshot
 */

import { IWorkItemNode } from '../models/WorkItemModels';
import { formatShortDate } from '../utils/DateUtils';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

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
     * Export to Excel with formatted table + separate PNG screenshot
     */
    public async exportToExcelWithScreenshot(
        workItems: IWorkItemNode[],
        ganttElement: HTMLElement | null,
        filename: string = 'gantt-export'
    ): Promise<void> {
        const flatItems = this.flattenHierarchy(workItems);

        // Create Excel workbook with formatted data
        this.exportToExcel(flatItems, filename);

        // Capture and download Gantt chart screenshot separately
        if (ganttElement) {
            await this.captureAndDownloadScreenshot(ganttElement, `${filename}-chart`);
        }
    }

    /**
     * Create and download proper Excel file with formatted data
     */
    private exportToExcel(items: IWorkItemNode[], filename: string): void {
        // Calculate summary stats
        const stats = this.calculateStats(items);

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Sheet 1: Summary
        const summaryData = [
            ['📊 Gantt Chart Export Summary'],
            [''],
            ['Metric', 'Value'],
            ['Total Work Items', items.length],
            ['Total Effort (hours)', stats.totalEffort],
            ['Remaining Work (hours)', stats.totalRemaining],
            ['Completed Work (hours)', stats.totalCompleted],
            ['Overall Progress', `${stats.overallProgress}%`],
            ['Export Date', new Date().toLocaleDateString()]
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

        // Set column widths for summary
        summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

        // Sheet 2: Work Items Detail
        const headers = [
            'ID',
            'Level',
            'Type',
            'Title',
            'State',
            'Assigned To',
            'Start Date',
            'End Date',
            'Effort (h)',
            'Remaining (h)',
            'Done %'
        ];

        const rows: (string | number)[][] = [headers];

        for (const item of items) {
            const indent = '  '.repeat(item.level);
            rows.push([
                item.id,
                item.level,
                item.workItemType,
                indent + item.title,
                item.state,
                item.assignedTo,
                item.calculatedStartDate ? formatShortDate(item.calculatedStartDate) : '',
                item.calculatedEndDate ? formatShortDate(item.calculatedEndDate) : '',
                item.rollupEffort || 0,
                item.rollupRemainingWork || 0,
                item.percentComplete
            ]);
        }

        const detailSheet = XLSX.utils.aoa_to_sheet(rows);

        // Set column widths
        detailSheet['!cols'] = [
            { wch: 8 },   // ID
            { wch: 6 },   // Level
            { wch: 20 },  // Type
            { wch: 50 },  // Title
            { wch: 12 },  // State
            { wch: 20 },  // Assigned To
            { wch: 12 },  // Start Date
            { wch: 12 },  // End Date
            { wch: 10 },  // Effort
            { wch: 12 },  // Remaining
            { wch: 8 }    // Done %
        ];

        XLSX.utils.book_append_sheet(wb, detailSheet, 'Work Items');

        // Sheet 3: By Type Summary
        const typeStats = this.getStatsByType(items);
        const typeData: (string | number)[][] = [
            ['Work Item Type', 'Count', 'Total Effort (h)', 'Remaining (h)', 'Avg Progress']
        ];

        for (const [type, stats] of Object.entries(typeStats)) {
            typeData.push([
                type,
                stats.count,
                Math.round(stats.effort * 10) / 10,
                Math.round(stats.remaining * 10) / 10,
                `${Math.round(stats.avgProgress)}%`
            ]);
        }

        const typeSheet = XLSX.utils.aoa_to_sheet(typeData);
        typeSheet['!cols'] = [
            { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 15 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(wb, typeSheet, 'By Type');

        // Generate Excel file and download
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        this.downloadBlob(blob, `${filename}.xlsx`);
    }

    /**
     * Capture full Gantt screenshot (including all scrollable content) and download as PNG
     */
    private async captureAndDownloadScreenshot(element: HTMLElement, filename: string): Promise<void> {
        try {
            // Find the scroll container and content
            const scrollContainer = element.closest('.gantt-scroll-container') as HTMLElement;
            const ganttContent = element;

            if (!scrollContainer) {
                console.warn('Could not find scroll container');
                return;
            }

            // Store original styles and scroll positions
            const originalStyles = {
                scrollContainerHeight: scrollContainer.style.height,
                scrollContainerMaxHeight: scrollContainer.style.maxHeight,
                scrollContainerOverflow: scrollContainer.style.overflow,
                elementWidth: ganttContent.style.width,
                elementHeight: ganttContent.style.height,
                scrollLeft: scrollContainer.scrollLeft,
                scrollTop: scrollContainer.scrollTop
            };

            // Calculate full content dimensions
            const fullWidth = Math.max(ganttContent.scrollWidth, scrollContainer.scrollWidth, 1200);
            const fullHeight = Math.max(ganttContent.scrollHeight, scrollContainer.scrollHeight, 600);

            // Temporarily expand the container to show ALL content
            scrollContainer.style.height = `${fullHeight + 50}px`;
            scrollContainer.style.maxHeight = 'none';
            scrollContainer.style.overflow = 'visible';
            ganttContent.style.width = `${fullWidth}px`;
            ganttContent.style.height = `${fullHeight}px`;

            // Scroll to beginning
            scrollContainer.scrollLeft = 0;
            scrollContainer.scrollTop = 0;

            // Wait for layout to update
            await new Promise(resolve => setTimeout(resolve, 300));

            // Capture the FULL content
            const canvas = await html2canvas(ganttContent, {
                scale: 2, // High quality
                useCORS: true,
                logging: false,
                backgroundColor: '#0d0d15',
                width: fullWidth,
                height: fullHeight,
                windowWidth: fullWidth + 100,
                windowHeight: fullHeight + 100,
                scrollX: 0,
                scrollY: 0
            });

            // Restore original styles
            scrollContainer.style.height = originalStyles.scrollContainerHeight;
            scrollContainer.style.maxHeight = originalStyles.scrollContainerMaxHeight;
            scrollContainer.style.overflow = originalStyles.scrollContainerOverflow;
            ganttContent.style.width = originalStyles.elementWidth;
            ganttContent.style.height = originalStyles.elementHeight;
            scrollContainer.scrollLeft = originalStyles.scrollLeft;
            scrollContainer.scrollTop = originalStyles.scrollTop;

            // Convert to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    this.downloadBlob(blob, `${filename}.png`);
                }
            }, 'image/png');

        } catch (error) {
            console.error('Failed to capture Gantt screenshot:', error);
        }
    }

    /**
     * Get statistics grouped by work item type
     */
    private getStatsByType(items: IWorkItemNode[]): Record<string, { count: number; effort: number; remaining: number; avgProgress: number }> {
        const stats: Record<string, { count: number; effort: number; remaining: number; totalProgress: number }> = {};

        for (const item of items) {
            if (!stats[item.workItemType]) {
                stats[item.workItemType] = { count: 0, effort: 0, remaining: 0, totalProgress: 0 };
            }
            stats[item.workItemType].count++;
            stats[item.workItemType].effort += item.rollupEffort || 0;
            stats[item.workItemType].remaining += item.rollupRemainingWork || 0;
            stats[item.workItemType].totalProgress += item.percentComplete || 0;
        }

        // Calculate averages
        const result: Record<string, { count: number; effort: number; remaining: number; avgProgress: number }> = {};
        for (const [type, data] of Object.entries(stats)) {
            result[type] = {
                count: data.count,
                effort: data.effort,
                remaining: data.remaining,
                avgProgress: data.count > 0 ? data.totalProgress / data.count : 0
            };
        }

        return result;
    }

    /**
     * Calculate summary statistics
     */
    private calculateStats(items: IWorkItemNode[]): {
        totalEffort: number;
        totalRemaining: number;
        totalCompleted: number;
        overallProgress: number;
    } {
        // Only sum root-level items to avoid double-counting
        const rootItems = items.filter(i => i.level === 0);
        const totalEffort = rootItems.reduce((sum, item) => sum + item.rollupEffort, 0);
        const totalRemaining = rootItems.reduce((sum, item) => sum + item.rollupRemainingWork, 0);
        const totalCompleted = totalEffort - totalRemaining;
        const overallProgress = totalEffort > 0 ? Math.round(100 - (totalRemaining / totalEffort * 100)) : 0;

        return {
            totalEffort: Math.round(totalEffort * 10) / 10,
            totalRemaining: Math.round(totalRemaining * 10) / 10,
            totalCompleted: Math.round(totalCompleted * 10) / 10,
            overallProgress: Math.max(0, Math.min(100, overallProgress))
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
     * Download a blob as a file
     */
    private downloadBlob(blob: Blob, filename: string): void {
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
     * Export work items to CSV format
     */
    public exportToCSV(
        workItems: IWorkItemNode[],
        filename: string = 'gantt-export'
    ): void {
        const flatItems = this.flattenHierarchy(workItems);
        const csvContent = this.generateCSV(flatItems);
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        this.downloadBlob(blob, `${filename}.csv`);
    }

    /**
     * Generate CSV content
     */
    private generateCSV(items: IWorkItemNode[]): string {
        const headers = [
            'ID', 'Level', 'Type', 'Title', 'State', 'Assigned To',
            'Start Date', 'Target Date', 'Effort (h)', 'Remaining (h)', 'Done %'
        ];

        const rows: string[][] = [headers];

        for (const item of items) {
            rows.push([
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
                item.percentComplete.toString()
            ]);
        }

        return rows.map(row =>
            row.map(cell => this.escapeCSVCell(cell)).join(',')
        ).join('\n');
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
}

export const exportService = ExportService.getInstance();
export default exportService;
