/**
 * Export Service
 * Provides functionality to export Gantt chart data to Excel format
 * Creates proper Excel file with formatted table + separate PNG screenshot
 */

import { IWorkItemNode } from '../models/WorkItemModels';
import { formatShortDate } from '../utils/DateUtils';
import * as SDK from 'azure-devops-extension-sdk';
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
     * Export only to Excel (no screenshot)
     */
    public exportToExcelOnly(
        workItems: IWorkItemNode[],
        filename: string = 'gantt-export'
    ): void {
        const flatItems = this.flattenHierarchy(workItems);
        this.exportToExcel(flatItems, filename);
    }

    /**
     * Export only Gantt chart screenshot (no Excel)
     */
    public async exportScreenshotOnly(
        ganttElement: HTMLElement | null,
        filename: string = 'gantt-export-chart'
    ): Promise<void> {
        if (ganttElement) {
            await this.captureAndDownloadScreenshot(ganttElement, filename);
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
            ['Overall Done', `${stats.overallProgress}%`],
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
     * Capture full Gantt screenshot (including headers, timeline, and all scrollable content) and download as PNG
     *
     * NEW STRATEGY: Inject styles into ORIGINAL DOM before capture, then remove after
     */
    public async captureAndDownloadScreenshot(element: HTMLElement, filename: string): Promise<void> {
        let injectedStyleElement: HTMLStyleElement | null = null;
        let originalInlineStyles: Map<HTMLElement, { background: string; backgroundColor: string }> | null = null;

        try {
            // Element should be .gantt-chart-content wrapper containing headers + scroll container
            const ganttChartContent = element;
            const scrollContainer = ganttChartContent.querySelector('.gantt-scroll-container') as HTMLElement;
            const ganttScrollContent = ganttChartContent.querySelector('.gantt-scroll-content') as HTMLElement;
            const timelineHeaderWrapper = ganttChartContent.querySelector('.gantt-timeline-header-wrapper') as HTMLElement;

            if (!scrollContainer || !ganttScrollContent) {
                console.warn('Could not find scroll container or content');
                return;
            }

            await this.inlineAvatarImagesForScreenshot(ganttChartContent);

            // Store original styles
            const originalStyles = {
                chartContentHeight: ganttChartContent.style.height,
                chartContentOverflow: ganttChartContent.style.overflow,
                scrollContainerHeight: scrollContainer.style.height,
                scrollContainerMaxHeight: scrollContainer.style.maxHeight,
                scrollContainerOverflow: scrollContainer.style.overflow,
                scrollContentWidth: ganttScrollContent.style.width,
                scrollContentHeight: ganttScrollContent.style.height,
                timelineHeaderOverflow: timelineHeaderWrapper ? timelineHeaderWrapper.style.overflow : '',
                scrollLeft: scrollContainer.scrollLeft,
                scrollTop: scrollContainer.scrollTop
            };

            // Calculate full content dimensions
            const fullWidth = Math.max(ganttScrollContent.scrollWidth, 1200);
            const fullHeight = Math.max(ganttScrollContent.scrollHeight, 600);

            // Get headers height
            const headersElement = ganttChartContent.querySelector('.gantt-headers') as HTMLElement;
            const headersHeight = headersElement ? headersElement.offsetHeight : 70;

            // Temporarily expand everything to show full content
            ganttChartContent.style.height = `${fullHeight + headersHeight + 50}px`;
            ganttChartContent.style.overflow = 'visible';
            scrollContainer.style.height = `${fullHeight + 50}px`;
            scrollContainer.style.maxHeight = 'none';
            scrollContainer.style.overflow = 'visible';
            ganttScrollContent.style.width = `${fullWidth}px`;
            ganttScrollContent.style.height = `${fullHeight}px`;

            if (timelineHeaderWrapper) {
                timelineHeaderWrapper.style.overflow = 'visible';
            }

            // Scroll to beginning
            scrollContainer.scrollLeft = 0;
            scrollContainer.scrollTop = 0;

            // Determine background color based on theme
            // FIXED: Theme class is on .query-gantt-hub, not body!
            const hubElement = document.querySelector('.query-gantt-hub') as HTMLElement;
            const isLightTheme = hubElement?.classList.contains('theme-light') ||
                                 document.body.classList.contains('theme-light') ||
                                 document.documentElement.classList.contains('theme-light');
            const backgroundColor = isLightTheme ? '#ffffff' : '#1e1e2e';
            console.log('[ExportService] Theme detection - isLightTheme:', isLightTheme);

            // NEW STRATEGY: Inject styles into ORIGINAL document BEFORE capture
            if (isLightTheme) {
                console.log('[ExportService] Light theme - injecting temporary styles into ORIGINAL DOM...');
                injectedStyleElement = document.createElement('style');
                injectedStyleElement.id = 'gantt-export-theme-override';
                injectedStyleElement.textContent = `
                    /* Temporary light theme override for screenshot export */
                    :root, body, html, .theme-light, .gantt-chart, .gantt-chart-content,
                    .gantt-scroll-container, .gantt-scroll-content {
                        --gantt-bg: #f8f9fa !important;
                        --gantt-header-bg: #ffffff !important;
                        --gantt-row-bg: #ffffff !important;
                        --gantt-row-hover: #f1f3f5 !important;
                        --gantt-border: #dee2e6 !important;
                        --gantt-text: #000000 !important;
                        --gantt-text-muted: #495057 !important;
                        --gantt-weekend-bg: rgba(0, 0, 0, 0.05) !important;
                        --gantt-grid-line: rgba(0, 0, 0, 0.1) !important;
                    }

                    /* Target ONLY container elements, NOT the bars or visual content */
                    .gantt-chart-content,
                    .gantt-chart,
                    .gantt-scroll-container,
                    .gantt-scroll-content,
                    .gantt-timeline,
                    .gantt-timeline-body,
                    .gantt-table-body {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                    }

                    .gantt-row,
                    .gantt-timeline-row {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        border-color: #dee2e6 !important;
                    }

                    .gantt-headers,
                    .gantt-table-header,
                    .gantt-timeline-header,
                    .gantt-timeline-header-wrapper {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        border-color: #dee2e6 !important;
                    }

                    /* Grid should be subtle, not white */
                    .gantt-timeline-grid {
                        background-color: transparent !important;
                        background: transparent !important;
                    }

                    .gantt-timeline-grid-line {
                        background-color: rgba(0, 0, 0, 0.1) !important;
                    }
                `;
                document.head.appendChild(injectedStyleElement);

                // CRITICAL: Wait for styles to be applied by browser
                await new Promise(resolve => setTimeout(resolve, 1000));
                console.log('[ExportService] Styles injected and reflow complete.');

                // DEBUG: Check if styles are actually applied
                const timelineBody = ganttChartContent.querySelector('.gantt-timeline-body') as HTMLElement;
                if (timelineBody) {
                    const computedBg = window.getComputedStyle(timelineBody).backgroundColor;
                    console.log('[ExportService] Timeline body computed background:', computedBg);
                }

                // CRITICAL: Store original inline styles before modifying
                originalInlineStyles = new Map();
                const timelineRows = ganttChartContent.querySelectorAll('.gantt-timeline-row');
                console.log('[ExportService] Found', timelineRows.length, 'timeline rows');

                // Store and set inline styles
                if (timelineBody) {
                    originalInlineStyles.set(timelineBody, {
                        background: timelineBody.style.background,
                        backgroundColor: timelineBody.style.backgroundColor
                    });
                    timelineBody.style.backgroundColor = '#ffffff';
                    timelineBody.style.background = '#ffffff';
                }

                timelineRows.forEach((row) => {
                    const el = row as HTMLElement;
                    originalInlineStyles!.set(el, {
                        background: el.style.background,
                        backgroundColor: el.style.backgroundColor
                    });
                    el.style.backgroundColor = '#ffffff';
                    el.style.background = '#ffffff';
                });

                // Additional wait to ensure inline styles are applied
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Capture the FULL chart including headers
            console.log('[ExportService] Starting html2canvas capture...');
            const canvas = await html2canvas(ganttChartContent, {
                scale: 2, // High quality
                useCORS: true,
                logging: false,
                backgroundColor: backgroundColor,
                width: fullWidth,
                height: fullHeight + headersHeight,
                windowWidth: fullWidth + 100,
                windowHeight: fullHeight + headersHeight + 100,
                scrollX: 0,
                scrollY: 0
            });

            // Restore original styles
            ganttChartContent.style.height = originalStyles.chartContentHeight;
            ganttChartContent.style.overflow = originalStyles.chartContentOverflow;
            scrollContainer.style.height = originalStyles.scrollContainerHeight;
            scrollContainer.style.maxHeight = originalStyles.scrollContainerMaxHeight;
            scrollContainer.style.overflow = originalStyles.scrollContainerOverflow;
            ganttScrollContent.style.width = originalStyles.scrollContentWidth;
            ganttScrollContent.style.height = originalStyles.scrollContentHeight;

            if (timelineHeaderWrapper) {
                timelineHeaderWrapper.style.overflow = originalStyles.timelineHeaderOverflow;
            }

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
        } finally {
            // CRITICAL: Remove injected style element from original DOM
            if (injectedStyleElement && injectedStyleElement.parentNode) {
                console.log('[ExportService] Removing injected style element...');
                injectedStyleElement.parentNode.removeChild(injectedStyleElement);
            }

            // CRITICAL: Restore original inline styles
            if (originalInlineStyles) {
                console.log('[ExportService] Restoring', originalInlineStyles.size, 'inline styles...');
                originalInlineStyles.forEach((styles, element) => {
                    // If original was empty, remove the property instead of setting to empty string
                    if (styles.background === '') {
                        element.style.removeProperty('background');
                    } else {
                        element.style.background = styles.background;
                    }
                    if (styles.backgroundColor === '') {
                        element.style.removeProperty('background-color');
                    } else {
                        element.style.backgroundColor = styles.backgroundColor;
                    }
                });
            }

        }
    }

    /**
     * Inline assignee avatar images as data URLs before screenshot capture.
     * This improves export reliability for authenticated image URLs.
     */
    private async inlineAvatarImagesForScreenshot(root: HTMLElement): Promise<void> {
        const avatarImages = Array.from(root.querySelectorAll('.gantt-assignee-avatar img')) as HTMLImageElement[];

        if (avatarImages.length === 0) {
            return;
        }

        let token: string | null = null;
        try {
            token = await SDK.getAccessToken();
        } catch (error) {
            console.warn('[ExportService] Could not get access token for avatar export:', error);
        }

        const dataUrlCache = new Map<string, string | null>();
        for (const image of avatarImages) {
            const originalSrc = image.getAttribute('src') || '';
            if (!originalSrc || originalSrc.startsWith('data:')) {
                continue;
            }

            let dataUrl = dataUrlCache.get(originalSrc);
            if (dataUrl === undefined) {
                dataUrl = await this.fetchAvatarAsDataUrl(originalSrc, token);
                dataUrlCache.set(originalSrc, dataUrl);
            }

            if (dataUrl) {
                image.src = dataUrl;
            }
        }
    }

    private async fetchAvatarAsDataUrl(src: string, token: string | null): Promise<string | null> {
        const withToken = token
            ? await this.fetchImageAsDataUrl(src, { Authorization: `Bearer ${token}` })
            : null;
        if (withToken) {
            return withToken;
        }

        return this.fetchImageAsDataUrl(src);
    }

    private async fetchImageAsDataUrl(src: string, extraHeaders?: Record<string, string>): Promise<string | null> {
        try {
            const response = await fetch(src, {
                method: 'GET',
                credentials: 'include',
                headers: extraHeaders
            });
            if (!response.ok) {
                return null;
            }

            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) {
                return null;
            }

            return await this.blobToDataUrl(blob);
        } catch (error) {
            console.warn('[ExportService] Failed to inline avatar image for screenshot:', error);
            return null;
        }
    }

    private blobToDataUrl(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                    return;
                }
                reject(new Error('Failed to convert blob to data URL'));
            };
            reader.onerror = () => reject(reader.error || new Error('Failed to read image blob'));
            reader.readAsDataURL(blob);
        });
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
