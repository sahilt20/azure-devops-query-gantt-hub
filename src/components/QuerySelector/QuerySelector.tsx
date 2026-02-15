/**
 * Query Selector Component
 * Enhanced dropdown with search and folder grouping
 * Shows Azure DevOps query folders: My Queries, Shared Queries
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IQueryInfo } from '../../models/WorkItemModels';
import './QuerySelector.css';

interface IQuerySelectorProps {
    queries: IQueryInfo[];
    selectedQueryId: string;
    onQuerySelect: (queryId: string) => void;
    disabled?: boolean;
    isLoading?: boolean;
}

export const QuerySelector: React.FC<IQuerySelectorProps> = ({
    queries,
    selectedQueryId,
    onQuerySelect,
    disabled = false,
    isLoading = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // Filter and group queries by Azure DevOps folders
    const folderGroups = useMemo(() => {
        const searchLower = searchTerm.toLowerCase().trim();

        // Filter by search term
        const filtered = searchLower
            ? queries.filter(q =>
                q.name.toLowerCase().includes(searchLower) ||
                q.path.toLowerCase().includes(searchLower)
            )
            : queries;

        // Group by top-level folder (My Queries, Shared Queries, etc.)
        const groups = new Map<string, IQueryInfo[]>();

        filtered.forEach(q => {
            const parts = q.path.split('/');
            // First part is the root folder (My Queries, Shared Queries)
            const rootFolder = parts[0] || 'Other';

            if (!groups.has(rootFolder)) {
                groups.set(rootFolder, []);
            }
            groups.get(rootFolder)!.push(q);
        });

        // Sort folders with "My Queries" first, then "Shared Queries", then others
        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
            const aLower = a[0].toLowerCase();
            const bLower = b[0].toLowerCase();
            if (aLower.includes('my')) return -1;
            if (bLower.includes('my')) return 1;
            if (aLower.includes('shared')) return -1;
            if (bLower.includes('shared')) return 1;
            return a[0].localeCompare(b[0]);
        });

        return sortedGroups;
    }, [queries, searchTerm]);

    // Get selected query name
    const selectedQuery = queries.find(q => q.id === selectedQueryId);
    const displayText = selectedQuery
        ? selectedQuery.name
        : `Select a Query (${queries.length} available)`;

    const handleSelect = (queryId: string) => {
        onQuerySelect(queryId);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Get folder icon based on folder name
    const getFolderIcon = (folderName: string): string => {
        const lower = folderName.toLowerCase();
        if (lower.includes('my')) return '👤';
        if (lower.includes('shared')) return '👥';
        if (lower.includes('favorite')) return '⭐';
        return '📁';
    };

    return (
        <div className={`query-selector-enhanced ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
            <div
                className={`query-selector-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span className="query-selector-text">{displayText}</span>
                <span className="query-selector-arrow">{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && !disabled && (
                <div className="query-selector-dropdown">
                    {/* Search Input */}
                    <div className="query-selector-search">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="🔍 Search queries..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>

                    <div className="query-selector-list">
                        {isLoading ? (
                            <div className="query-selector-loading">Loading queries...</div>
                        ) : (
                            <>
                                {/* Clear Selection */}
                                <div
                                    className={`query-selector-item query-selector-clear ${selectedQueryId === '' ? 'selected' : ''}`}
                                    onClick={() => handleSelect('')}
                                >
                                    <span className="query-item-name">⨯ Clear selection</span>
                                </div>

                                {/* Query Folders */}
                                {folderGroups.map(([folder, groupQueries]) => (
                                    <div key={folder} className="query-selector-section">
                                        <div className="query-selector-section-header">
                                            {getFolderIcon(folder)} {folder}
                                        </div>
                                        {groupQueries.map(query => (
                                            <div
                                                key={query.id}
                                                className={`query-selector-item ${query.id === selectedQueryId ? 'selected' : ''}`}
                                                onClick={() => handleSelect(query.id)}
                                                title={query.path}
                                            >
                                                <span className="query-item-name">{query.name}</span>
                                                <span className="query-item-type">
                                                    {query.queryType === 'tree' ? '🌳' : query.queryType === 'oneHop' ? '↔️' : '📋'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                {folderGroups.length === 0 && (
                                    <div className="query-selector-empty">
                                        {searchTerm
                                            ? `No queries found matching "${searchTerm}"`
                                            : 'No queries available'
                                        }
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuerySelector;
