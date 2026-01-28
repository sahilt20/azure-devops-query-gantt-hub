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
    const [projectName, setProjectName] = React.useState<string>('');
    const [useMockData, setUseMockData] = React.useState(isDevelopment);

    // Initialize SDK and load queries
    React.useEffect(() => {
        const init = async () => {
            if (useMockData) {
                // Use mock data for local development
                setQueries(sampleQueries);
                setProjectName('SampleProject');
                setIsLoadingQueries(false);
                return;
            }

            try {
                await azureDevOpsService.initialize();
                setProjectName(azureDevOpsService.getProjectName() || '');

                const loadedQueries = await azureDevOpsService.getQueries(3);
                setQueries(loadedQueries);
            } catch (err) {
                console.error('Failed to initialize:', err);
                setError('Failed to initialize Azure DevOps SDK. Running with sample data.');
                // Fallback to mock data
                setUseMockData(true);
                setQueries(sampleQueries);
                setProjectName('SampleProject');
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
                return;
            }

            // Execute the query
            const queryResult = await azureDevOpsService.executeQuery(queryId);

            // Get work item IDs from result
            let workItemIds: number[] = [];

            if (queryResult.workItems) {
                // Flat query
                workItemIds = queryResult.workItems.map(wi => wi.id);
            } else if (queryResult.workItemRelations) {
                // Tree/OneHop query
                const ids = new Set<number>();
                for (const relation of queryResult.workItemRelations) {
                    if (relation.source?.id) ids.add(relation.source.id);
                    if (relation.target?.id) ids.add(relation.target.id);
                }
                workItemIds = Array.from(ids);
            }

            if (workItemIds.length === 0) {
                setWorkItems([]);
                return;
            }

            // Fetch work items with details
            const rawWorkItems = await azureDevOpsService.getWorkItems(workItemIds);

            // Build hierarchy
            let hierarchy: IWorkItemNode[];

            if (queryResult.workItemRelations) {
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
        } catch (err) {
            console.error('Failed to execute query:', err);
            setError(`Failed to execute query: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
                return;
            }

            const rawWorkItems = await azureDevOpsService.getHierarchicalWorkItems();
            const hierarchy = workItemHierarchyService.buildHierarchy(rawWorkItems);
            effortRollupService.calculateRollup(hierarchy);
            setWorkItems(hierarchy);
        } catch (err) {
            console.error('Failed to load hierarchical items:', err);
            setError(`Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
    };

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
                        <label htmlFor="query-select">Select Query:</label>
                        <select
                            id="query-select"
                            value={selectedQueryId}
                            onChange={handleQueryChange}
                            disabled={isLoadingQueries || isLoading}
                        >
                            <option value="">-- Select a Query --</option>
                            {queries.map(q => (
                                <option key={q.id} value={q.id}>
                                    {q.path}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Load All Button */}
                    <button
                        className="hub-btn hub-btn-primary"
                        onClick={loadAllHierarchical}
                        disabled={isLoading}
                    >
                        {useMockData ? 'Load Sample Data' : 'Load All Work Items'}
                    </button>
                </div>
            </div>

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
                />
            </div>
        </div>
    );
};

export default QueryGanttHub;
