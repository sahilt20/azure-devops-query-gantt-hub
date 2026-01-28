/**
 * Query Gantt Hub Component
 * Main hub component that integrates with Azure DevOps Queries
 */

import React, { useState, useEffect, useCallback } from 'react';
import { IWorkItemNode, IQueryInfo } from '../../models/WorkItemModels';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { workItemHierarchyService } from '../../services/WorkItemHierarchyService';
import { effortRollupService } from '../../services/EffortRollupService';
import { GanttChart } from '../GanttChart/GanttChart';
import './QueryGanttHub.css';

export const QueryGanttHub: React.FC = () => {
    const [queries, setQueries] = useState<IQueryInfo[]>([]);
    const [selectedQueryId, setSelectedQueryId] = useState<string>('');
    const [workItems, setWorkItems] = useState<IWorkItemNode[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingQueries, setIsLoadingQueries] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>('');

    // Initialize SDK and load queries
    useEffect(() => {
        const init = async () => {
            try {
                await azureDevOpsService.initialize();
                setProjectName(azureDevOpsService.getProjectName() || '');

                const loadedQueries = await azureDevOpsService.getQueries(3);
                setQueries(loadedQueries);
            } catch (err) {
                console.error('Failed to initialize:', err);
                setError('Failed to initialize Azure DevOps SDK');
            } finally {
                setIsLoadingQueries(false);
            }
        };

        init();
    }, []);

    // Execute selected query
    const executeQuery = useCallback(async (queryId: string) => {
        if (!queryId) return;

        setIsLoading(true);
        setError(null);

        try {
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
    }, []);

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
    const handleWorkItemClick = useCallback((workItem: IWorkItemNode) => {
        const url = `${window.location.origin}/${projectName}/_workitems/edit/${workItem.id}`;
        window.open(url, '_blank');
    }, [projectName]);

    // Load all hierarchical items
    const loadAllHierarchical = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSelectedQueryId('');

        try {
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
    }, []);

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
                    </span>
                </div>
                <div className="hub-header-right">
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
                        Load All Work Items
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
