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
import { GanttChart } from '../GanttChart/GanttChart';
import { QuerySelector } from '../QuerySelector/QuerySelector';
import './QueryGanttHub.css';

// Check if running in development mode (localhost)
const isDevelopment = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const QueryGanttHub: React.FC = () => {
    const [queries, setQueries] = React.useState<IQueryInfo[]>([]);
    const [selectedQueryId, setSelectedQueryId] = React.useState<string>('');
    const [workItems, setWorkItems] = React.useState<IWorkItemNode[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingQueries, setIsLoadingQueries] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [debugInfo, setDebugInfo] = React.useState<string>('');
    const [projectName, setProjectName] = React.useState<string>('');
    const [useMockData, setUseMockData] = React.useState(isDevelopment);

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

        setIsLoading(true);
        setError(null);

        try {
            if (useMockData) {
                // Simulate loading delay
                await new Promise(resolve => setTimeout(resolve, 500));
                const mockData = generateSampleWorkItems();
                effortRollupService.calculateRollup(mockData);
                setWorkItems(mockData);
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
                return;
            }

            if (workItemIds.length === 0) {
                setWorkItems([]);
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

            setWorkItems(hierarchy);
            setDebugInfo(`Displaying ${hierarchy.length} root items with ${rawWorkItems.length} total work items`);
        } catch (err) {
            console.error('Failed to execute query:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Failed to execute query: ${errorMessage}`);
            setDebugInfo(`Query error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [useMockData]);

    // Handle query selection
    const handleQueryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const queryId = e.target.value;
        setSelectedQueryId(queryId);
        if (queryId) {
            executeQuery(queryId);
        } else {
            setWorkItems([]);
        }
    };

    // Handle work item click - open in Azure DevOps
    const handleWorkItemClick = React.useCallback((workItem: IWorkItemNode) => {
        if (useMockData) {
            alert(`Work Item #${workItem.id}: ${workItem.title}\n\nType: ${workItem.workItemType}\nState: ${workItem.state}\nEffort: ${workItem.rollupEffort}h\nComplete: ${workItem.percentComplete}%`);
            return;
        }
        const url = `${window.location.origin}/${projectName}/_workitems/edit/${workItem.id}`;
        window.open(url, '_blank');
    }, [projectName, useMockData]);

    // Load all hierarchical items or sample data
    const loadAllHierarchical = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSelectedQueryId('');

        try {
            if (useMockData) {
                // Simulate loading delay
                await new Promise(resolve => setTimeout(resolve, 500));
                const mockData = generateSampleWorkItems();
                effortRollupService.calculateRollup(mockData);
                setWorkItems(mockData);
                setDebugInfo(`Loaded ${mockData.length} sample work items`);
                return;
            }

            setDebugInfo('Loading all work items...');
            const rawWorkItems = await azureDevOpsService.getHierarchicalWorkItems();
            setDebugInfo(`Found ${rawWorkItems.length} work items, building hierarchy...`);

            const hierarchy = workItemHierarchyService.buildHierarchy(rawWorkItems);
            effortRollupService.calculateRollup(hierarchy);
            setWorkItems(hierarchy);
            setDebugInfo(`Displaying ${hierarchy.length} root items with ${rawWorkItems.length} total work items`);
        } catch (err) {
            console.error('Failed to load hierarchical items:', err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Failed to load: ${errorMessage}`);
            setDebugInfo(`Error: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    }, [useMockData]);

    // Toggle mock data mode
    const toggleMockData = () => {
        setUseMockData(!useMockData);
        setWorkItems([]);
        setSelectedQueryId('');
        setError(null);
        setDebugInfo('');
    };

    // Refresh data
    const handleRefresh = React.useCallback(() => {
        if (selectedQueryId) {
            executeQuery(selectedQueryId);
        } else {
            // If no query selected, assume "Load All" or just refresh whatever is there if we have items
            if (workItems.length > 0) {
                loadAllHierarchical();
            }
        }
    }, [selectedQueryId, executeQuery, loadAllHierarchical, workItems.length]);

    return (
        <div className="query-gantt-hub">
            {/* Header */}
            <div className="hub-header">
                <div className="hub-header-left">
                    <h1 className="hub-title">
                        <span className="hub-icon">📊</span>
                        Query Gantt Chart
                    </h1>
                    <span className="hub-subtitle">
                        Visualize work items from Epic → Feature → PBI → Task with effort rollup
                        {useMockData && <span className="mock-badge"> (Sample Data)</span>}
                    </span>
                </div>
                <div className="hub-header-right">
                    {/* Mock Data Toggle - only in dev mode */}
                    {isDevelopment && (
                        <button
                            className={`hub-btn ${useMockData ? 'hub-btn-active' : 'hub-btn-secondary'}`}
                            onClick={toggleMockData}
                        >
                            {useMockData ? '🎭 Using Sample Data' : '🔗 Connect to Azure'}
                        </button>
                    )}

                    {/* Query Selector */}
                    <div className="query-selector">
                        <label>Select Query:</label>
                        <QuerySelector
                            queries={queries}
                            selectedQueryId={selectedQueryId}
                            onQuerySelect={(id) => {
                                setSelectedQueryId(id);
                                if (id) executeQuery(id);
                            }}
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

            {/* Gantt Chart */}
            <div className="hub-content">
                <GanttChart
                    workItems={workItems}
                    isLoading={isLoading || isLoadingQueries}
                    onWorkItemClick={handleWorkItemClick}
                    onRefresh={handleRefresh}
                />
            </div>
        </div>
    );
};

export default QueryGanttHub;
