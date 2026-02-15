/**
 * Query Gantt Hub Component
 * Main hub component that integrates with Azure DevOps Queries
 */

import * as React from 'react';
import { IWorkItemNode, IQueryInfo } from '../../models/WorkItemModels';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { workItemHierarchyService } from '../../services/WorkItemHierarchyService';
import { effortRollupService } from '../../services/EffortRollupService';
import { generateSampleWorkItems, sampleQueries } from '../../services/MockDataService';
import { themeService, Theme } from '../../services/ThemeService';
import { GanttChart } from '../GanttChart/GanttChart';
import { DeliveryAnalysis } from '../DeliveryAnalysis/DeliveryAnalysis';
import { QuerySelector } from '../QuerySelector/QuerySelector';
import './QueryGanttHub.css';

// Check if running in development mode (localhost)
const isDevelopment = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const QueryGanttHub: React.FC = () => {
    const [queries, setQueries] = React.useState<IQueryInfo[]>([]);
    const [selectedQueryId, setSelectedQueryId] = React.useState<string>('');
    const [loadedQueryId, setLoadedQueryId] = React.useState<string>('');
    const [workItems, setWorkItems] = React.useState<IWorkItemNode[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingQueries, setIsLoadingQueries] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [debugInfo, setDebugInfo] = React.useState<string>('');
    const [projectName, setProjectName] = React.useState<string>('');
    const [useMockData, setUseMockData] = React.useState(isDevelopment);
    const [theme, setTheme] = React.useState<Theme>(themeService.getTheme());
    const [activeTab, setActiveTab] = React.useState<'gantt' | 'delivery'>('gantt');
    const queryRequestRef = React.useRef(0);

    // Initialize SDK and load queries
    React.useEffect(() => {
        const init = async () => {
            if (useMockData) {
                // Use mock data for local development
                setQueries(sampleQueries);
                setProjectName('SampleProject');
                setDebugInfo('Using mock data (localhost detected)');
                setIsLoadingQueries(false);
                return;
            }

            try {
                setDebugInfo('Initializing Azure DevOps SDK...');
                await azureDevOpsService.initialize();

                const project = azureDevOpsService.getProjectName();
                setProjectName(project || '');
                setDebugInfo(`Connected to project: ${project || 'Unknown'}`);

                if (!project) {
                    const initError = azureDevOpsService.getInitError();
                    setError(initError || 'Could not determine project context');
                    setIsLoadingQueries(false);
                    return;
                }

                setDebugInfo('Loading queries...');
                const loadedQueries = await azureDevOpsService.getQueries();
                setQueries(loadedQueries);
                setDebugInfo(`Loaded ${loadedQueries.length} queries from ${project}`);
            } catch (err) {
                console.error('Failed to initialize:', err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(`Failed to initialize: ${errorMessage}`);
                setDebugInfo(`Error: ${errorMessage}`);
            } finally {
                setIsLoadingQueries(false);
            }
        };

        init();
    }, [useMockData]);

    // Execute selected query
    const executeQuery = React.useCallback(async (queryId: string) => {
        if (!queryId) return;

        const requestId = ++queryRequestRef.current;
        setIsLoading(true);
        setError(null);
        setLoadedQueryId('');
        setWorkItems([]);

        try {
            if (useMockData) {
                // Simulate loading delay
                await new Promise(resolve => setTimeout(resolve, 500));
                if (requestId !== queryRequestRef.current) return;
                const mockData = generateSampleWorkItems();
                effortRollupService.calculateRollup(mockData);
                setWorkItems(mockData);
                setLoadedQueryId(queryId);
                setDebugInfo(`Loaded ${mockData.length} sample work items`);
                return;
            }

            setDebugInfo('Executing query...');

            // Execute the query
            const queryResult = await azureDevOpsService.executeQuery(queryId);

            // Get work item IDs from result
            let workItemIds: number[] = [];

            if (queryResult.workItems && queryResult.workItems.length > 0) {
                // Flat query
                workItemIds = queryResult.workItems.map(wi => wi.id);
                setDebugInfo(`Query returned ${workItemIds.length} work items (flat query)`);
            } else if (queryResult.workItemRelations && queryResult.workItemRelations.length > 0) {
                // Tree/OneHop query
                const ids = new Set<number>();
                for (const relation of queryResult.workItemRelations) {
                    if (relation.source?.id) ids.add(relation.source.id);
                    if (relation.target?.id) ids.add(relation.target.id);
                }
                workItemIds = Array.from(ids);
                setDebugInfo(`Query returned ${workItemIds.length} work items (tree/link query with ${queryResult.workItemRelations.length} relations)`);
            } else {
                setDebugInfo('Query returned no results');
                setWorkItems([]);
                setLoadedQueryId(queryId);
                return;
            }

            if (workItemIds.length === 0) {
                setWorkItems([]);
                setLoadedQueryId(queryId);
                return;
            }

            setDebugInfo(`Fetching ${workItemIds.length} work items...`);

            // Fetch work items with details
            const rawWorkItems = await azureDevOpsService.getWorkItems(workItemIds);
            setDebugInfo(`Retrieved ${rawWorkItems.length} work items, building hierarchy...`);

            // Build hierarchy
            let hierarchy: IWorkItemNode[];

            if (queryResult.workItemRelations && queryResult.workItemRelations.length > 0) {
                // Use relations from query
                hierarchy = workItemHierarchyService.buildHierarchyFromRelations(
                    rawWorkItems,
                    queryResult.workItemRelations
                );
            } else {
                // Build from parent field
                hierarchy = workItemHierarchyService.buildHierarchy(rawWorkItems);
            }

            // Calculate effort rollup
            effortRollupService.calculateRollup(hierarchy);

            if (requestId !== queryRequestRef.current) return;
            setWorkItems(hierarchy);
            setLoadedQueryId(queryId);
            setDebugInfo(`Displaying ${hierarchy.length} root items with ${rawWorkItems.length} total work items`);
        } catch (err) {
            if (requestId !== queryRequestRef.current) return;
            console.error('Failed to execute query:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Failed to execute query: ${errorMessage}`);
            setDebugInfo(`Query error: ${errorMessage}`);
            setLoadedQueryId('');
        } finally {
            if (requestId === queryRequestRef.current) {
                setIsLoading(false);
            }
        }
    }, [useMockData]);

    // Handle query selection from custom selector
    const handleQuerySelect = React.useCallback((queryId: string) => {
        setSelectedQueryId(queryId);
        setError(null);

        if (queryId) {
            executeQuery(queryId);
            return;
        }

        // Clear selection: reset delivery/gantt data explicitly
        queryRequestRef.current += 1;
        setIsLoading(false);
        setLoadedQueryId('');
        setWorkItems([]);
        setDebugInfo('Select a query to load data.');
    }, [executeQuery]);

    // Handle work item click - open in Azure DevOps
    const handleWorkItemClick = React.useCallback((workItem: IWorkItemNode) => {
        if (useMockData) {
            alert(`Work Item #${workItem.id}: ${workItem.title}\n\nType: ${workItem.workItemType}\nState: ${workItem.state}\nEffort: ${workItem.rollupEffort}h\nComplete: ${workItem.percentComplete}%`);
            return;
        }
        const url = `${window.location.origin}/${projectName}/_workitems/edit/${workItem.id}`;
        window.open(url, '_blank');
    }, [projectName, useMockData]);

    // Refresh data
    const handleRefresh = React.useCallback(() => {
        if (selectedQueryId) {
            executeQuery(selectedQueryId);
        } else {
            setDebugInfo('Select a query before refreshing.');
        }
    }, [selectedQueryId, executeQuery]);

    // Theme toggle
    const handleThemeToggle = React.useCallback(() => {
        const newTheme = themeService.toggleTheme();
        setTheme(newTheme);
    }, []);

    const hasSelectedQuery = selectedQueryId.trim().length > 0;
    const hasLoadedSelectedQuery = hasSelectedQuery && loadedQueryId === selectedQueryId;

    return (
        <div className={`query-gantt-hub ${theme === 'light' ? 'theme-light' : ''}`}>
            {/* Header */}
            <div className="hub-header">
                <div className="hub-header-left">
                    <h1 className="hub-title">
                        <span className="hub-icon">📊</span>
                        Query Gantt Chart
                    </h1>
                    <span className="hub-subtitle">
                        Plan delivery with timeline, task allocation, and delivery-manager analysis
                    </span>
                </div>
                <div className="hub-header-right">
                    {/* Theme Toggle */}
                    <button
                        className="hub-theme-toggle"
                        onClick={handleThemeToggle}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    {/* Query Selector */}
                    <div className="query-selector">
                        <label>Select Query:</label>
                        <QuerySelector
                            queries={queries}
                            selectedQueryId={selectedQueryId}
                            onQuerySelect={handleQuerySelect}
                            disabled={isLoading}
                            isLoading={isLoadingQueries}
                        />
                    </div>
                </div>
            </div>

            {/* Debug Info */}
            {debugInfo && (
                <div className="hub-debug">
                    <span className="debug-icon">ℹ️</span>
                    {debugInfo}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="hub-error">
                    <span className="error-icon">⚠️</span>
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="hub-tabs">
                <button
                    className={`hub-tab ${activeTab === 'gantt' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gantt')}
                >
                    Gantt Chart
                </button>
                <button
                    className={`hub-tab ${activeTab === 'delivery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('delivery')}
                >
                    Delivery Console
                </button>
            </div>

            {/* Content Area */}
            <div className="hub-content">
                {activeTab === 'gantt' ? (
                    <GanttChart
                        workItems={hasLoadedSelectedQuery ? workItems : []}
                        isLoading={isLoading || isLoadingQueries}
                        onWorkItemClick={handleWorkItemClick}
                        onRefresh={handleRefresh}
                    />
                ) : (
                    hasLoadedSelectedQuery ? (
                        <div className="hub-delivery-console">
                            <div className="hub-delivery-analysis">
                                <DeliveryAnalysis workItems={workItems} />
                            </div>
                        </div>
                    ) : (
                        <div className="hub-delivery-empty">
                            Select a query to view Delivery Console analytics and allocation.
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default QueryGanttHub;
