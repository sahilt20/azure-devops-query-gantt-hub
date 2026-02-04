/**
 * Export Service
 * Provides functionality to export Gantt chart data to Excel format
 * Includes well-formatted table and full screenshot of Gantt chart
 */

import { IWorkItemNode } from '../models/WorkItemModels';
import { formatShortDate, addDays, diffInDays } from '../utils/DateUtils';
import html2canvas from 'html2canvas';

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
     * Export to Excel with formatted table and full Gantt chart screenshot
     */
    public async exportToExcelWithScreenshot(
        workItems: IWorkItemNode[],
        ganttElement: HTMLElement | null,
        filename: string = 'gantt-export'
    ): Promise<void> {
        const flatItems = this.flattenHierarchy(workItems);

        // Capture full Gantt chart screenshot
        let screenshotDataUrl: string | null = null;
        if (ganttElement) {
            screenshotDataUrl = await this.captureFullGanttScreenshot(ganttElement);
        }

        // Generate Excel HTML
        const excelHtml = this.generateExcelHtml(flatItems, screenshotDataUrl);

        // Download as .xls (Excel will open HTML files)
        const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.xls`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    /**
     * Capture full screenshot of Gantt chart (including off-screen content)
     */
    private async captureFullGanttScreenshot(element: HTMLElement): Promise<string | null> {
        try {
            // Find the scroll container and timeline body
            const scrollContainer = element.querySelector('.gantt-scroll-container') as HTMLElement || element;
            const timelineBody = element.querySelector('.gantt-timeline-body') as HTMLElement;

            // Store original dimensions
            const originalScrollLeft = scrollContainer.scrollLeft;
            const originalScrollTop = scrollContainer.scrollTop;
            const originalWidth = element.style.width;
            const originalHeight = element.style.height;
            const originalOverflow = element.style.overflow;

            // Temporarily expand to show full content
            if (timelineBody) {
                const fullWidth = Math.max(timelineBody.scrollWidth, scrollContainer.scrollWidth);
                const fullHeight = Math.max(element.scrollHeight, 800);
                element.style.overflow = 'visible';
                element.style.width = fullWidth + 'px';
                element.style.height = fullHeight + 'px';
            }

            // Scroll to beginning
            scrollContainer.scrollLeft = 0;
            scrollContainer.scrollTop = 0;

            // Wait for repaint
            await new Promise(resolve => setTimeout(resolve, 100));

            // Capture the full element
            const canvas = await html2canvas(element, {
                scale: 1.5, // Higher quality
                useCORS: true,
                logging: false,
                backgroundColor: '#0d0d15',
                windowWidth: element.scrollWidth + 100,
                windowHeight: element.scrollHeight + 100,
                width: element.scrollWidth,
                height: element.scrollHeight
            });

            // Restore original dimensions
            element.style.width = originalWidth;
            element.style.height = originalHeight;
            element.style.overflow = originalOverflow;
            scrollContainer.scrollLeft = originalScrollLeft;
            scrollContainer.scrollTop = originalScrollTop;

            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error('Failed to capture Gantt screenshot:', error);
            return null;
        }
    }

    /**
     * Generate Excel-compatible HTML with formatted table and embedded image
     */
    private generateExcelHtml(items: IWorkItemNode[], screenshotDataUrl: string | null): string {
        const today = new Date().toLocaleDateString();

        // Calculate summary stats
        const stats = this.calculateStats(items);

        return `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:x="urn:schemas-microsoft-com:office:excel" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="ProgId" content="Excel.Sheet">
    <!--[if gte mso 9]>
    <xml>
        <x:ExcelWorkbook>
            <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                    <x:Name>Gantt Chart Export</x:Name>
                    <x:WorksheetOptions>
                        <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                </x:ExcelWorksheet>
            </x:ExcelWorksheets>
        </x:ExcelWorkbook>
    </xml>
    <![endif]-->
    <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
        h1 { color: #2b5797; margin-bottom: 5px; }
        h2 { color: #444; font-size: 14pt; margin: 20px 0 10px 0; }
        .meta { color: #666; font-size: 10pt; margin-bottom: 15px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th { 
            background-color: #2b5797; 
            color: white; 
            font-weight: bold; 
            padding: 8px 12px; 
            text-align: left;
            border: 1px solid #1a3a5c;
        }
        td { 
            padding: 6px 12px; 
            border: 1px solid #ddd; 
            vertical-align: top;
        }
        tr:nth-child(even) { background-color: #f8f9fa; }
        tr:hover { background-color: #e8f4fd; }
        .level-0 { font-weight: bold; background-color: #e8f4fd; }
        .level-1 { padding-left: 20px; }
        .level-2 { padding-left: 40px; }
        .level-3 { padding-left: 60px; }
        .epic { color: #6b3fa0; }
        .feature { color: #2b5797; }
        .pbi { color: #107c10; }
        .bug { color: #d13438; }
        .task { color: #ffc000; }
        .number { text-align: right; }
        .percent { text-align: center; }
        .done { color: #107c10; font-weight: bold; }
        .in-progress { color: #ff8c00; }
        .not-started { color: #999; }
        .summary-table { width: auto; margin-bottom: 25px; }
        .summary-table th { background-color: #444; padding: 6px 15px; }
        .summary-table td { padding: 6px 15px; font-weight: bold; }
        .screenshot-container { margin: 25px 0; page-break-inside: avoid; }
        .screenshot { max-width: 100%; border: 1px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <h1>📊 Gantt Chart Export</h1>
    <div class="meta">Exported on ${today} | Total Items: ${items.length}</div>
    
    <!-- Summary Statistics -->
    <h2>📈 Summary</h2>
    <table class="summary-table">
        <tr>
            <th>Total Effort</th>
            <th>Remaining</th>
            <th>Completed</th>
            <th>Overall Progress</th>
        </tr>
        <tr>
            <td>${stats.totalEffort}h</td>
            <td>${stats.totalRemaining}h</td>
            <td>${stats.totalCompleted}h</td>
            <td class="${stats.overallProgress >= 75 ? 'done' : stats.overallProgress > 0 ? 'in-progress' : 'not-started'}">${stats.overallProgress}%</td>
        </tr>
    </table>
    
    <!-- Gantt Chart Screenshot -->
    ${screenshotDataUrl ? `
    <h2>📅 Gantt Chart Visual</h2>
    <div class="screenshot-container">
        <img class="screenshot" src="${screenshotDataUrl}" alt="Gantt Chart">
    </div>
    ` : ''}
    
    <!-- Work Items Table -->
    <h2>📋 Work Items Detail</h2>
    <table>
        <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Title</th>
            <th>State</th>
            <th>Assigned To</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Effort (h)</th>
            <th>Remaining (h)</th>
            <th>Done %</th>
        </tr>
        ${items.map(item => this.generateTableRow(item)).join('')}
    </table>
</body>
</html>`;
    }

    /**
     * Generate a table row for a work item
     */
    private generateTableRow(item: IWorkItemNode): string {
        const typeClass = this.getTypeClass(item.workItemType);
        const progressClass = item.percentComplete >= 100 ? 'done' :
            item.percentComplete > 0 ? 'in-progress' : 'not-started';
        const levelClass = `level-${Math.min(item.level, 3)}`;

        return `
        <tr class="${levelClass}">
            <td class="number">${item.id}</td>
            <td class="${typeClass}">${this.getTypeIcon(item.workItemType)} ${item.workItemType}</td>
            <td>${'&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(item.level)}${this.escapeHtml(item.title)}</td>
            <td>${item.state}</td>
            <td>${this.escapeHtml(item.assignedTo)}</td>
            <td>${item.calculatedStartDate ? formatShortDate(item.calculatedStartDate) : '-'}</td>
            <td>${item.calculatedEndDate ? formatShortDate(item.calculatedEndDate) : '-'}</td>
            <td class="number">${item.rollupEffort || 0}</td>
            <td class="number">${item.rollupRemainingWork || 0}</td>
            <td class="percent ${progressClass}">${item.percentComplete}%</td>
        </tr>`;
    }

    /**
     * Get CSS class for work item type
     */
    private getTypeClass(type: string): string {
        switch (type) {
            case 'Epic': return 'epic';
            case 'Feature': return 'feature';
            case 'Product Backlog Item': return 'pbi';
            case 'Bug': return 'bug';
            case 'Task': return 'task';
            default: return '';
        }
    }

    /**
     * Get icon for work item type
     */
    private getTypeIcon(type: string): string {
        switch (type) {
            case 'Epic': return '👑';
            case 'Feature': return '⭐';
            case 'Product Backlog Item': return '📋';
            case 'Bug': return '🐛';
            case 'Task': return '✅';
            case 'Release': return '🚀';
            default: return '📌';
        }
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
     * Escape HTML entities
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
     * Export work items to CSV format
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
     * Generate simple CSV
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
}

export const exportService = ExportService.getInstance();
export default exportService;
