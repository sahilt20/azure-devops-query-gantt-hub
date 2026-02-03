/**
 * Query Selector Component
 * Enhanced dropdown with search, folder grouping, and favorites
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

const FAVORITES_STORAGE_KEY = 'gantt-favorite-queries';

export const QuerySelector: React.FC<IQuerySelectorProps> = ({
    queries,
    selectedQueryId,
    onQuerySelect,
    disabled = false,
    isLoading = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [favorites, setFavorites] = useState<string[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load favorites from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
            if (stored) {
                setFavorites(JSON.parse(stored));
            }
        } catch (e) {
            console.warn('Failed to load favorites:', e);
        }
    }, []);

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

    // Toggle favorite status
    const toggleFavorite = (queryId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const newFavorites = favorites.includes(queryId)
            ? favorites.filter(id => id !== queryId)
            : [...favorites, queryId];

        setFavorites(newFavorites);
        try {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
        } catch (e) {
            console.warn('Failed to save favorites:', e);
        }
    };

    // Filter and group queries
    const { favoriteQueries, folderGroups } = useMemo(() => {
        const searchLower = searchTerm.toLowerCase().trim();

        // Filter by search term
        const filtered = searchLower
            ? queries.filter(q =>
                q.name.toLowerCase().includes(searchLower) ||
                q.path.toLowerCase().includes(searchLower)
            )
            : queries;

        // Separate favorites
        const favQueries = filtered.filter(q => favorites.includes(q.id));

        // Group by folder
        const groups = new Map<string, IQueryInfo[]>();
        filtered.forEach(q => {
            const parts = q.path.split('/');
            const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
            if (!groups.has(folder)) {
                groups.set(folder, []);
            }
            groups.get(folder)!.push(q);
        });

        return {
            favoriteQueries: favQueries,
            folderGroups: Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
        };
    }, [queries, searchTerm, favorites]);

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
                                {/* Favorites Section */}
                                {favoriteQueries.length > 0 && (
                                    <div className="query-selector-section">
                                        <div className="query-selector-section-header">
                                            ⭐ Favorites
                                        </div>
                                        {favoriteQueries.map(query => (
                                            <div
                                                key={query.id}
                                                className={`query-selector-item ${query.id === selectedQueryId ? 'selected' : ''}`}
                                                onClick={() => handleSelect(query.id)}
                                            >
                                                <span className="query-item-name">{query.name}</span>
                                                <button
                                                    className="query-item-favorite active"
                                                    onClick={(e) => toggleFavorite(query.id, e)}
                                                    title="Remove from favorites"
                                                >
                                                    ⭐
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* All Queries by Folder */}
                                {folderGroups.map(([folder, groupQueries]) => (
                                    <div key={folder} className="query-selector-section">
                                        <div className="query-selector-section-header">
                                            📁 {folder}
                                        </div>
                                        {groupQueries.map(query => (
                                            <div
                                                key={query.id}
                                                className={`query-selector-item ${query.id === selectedQueryId ? 'selected' : ''}`}
                                                onClick={() => handleSelect(query.id)}
                                            >
                                                <span className="query-item-name">{query.name}</span>
                                                <button
                                                    className={`query-item-favorite ${favorites.includes(query.id) ? 'active' : ''}`}
                                                    onClick={(e) => toggleFavorite(query.id, e)}
                                                    title={favorites.includes(query.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    {favorites.includes(query.id) ? '⭐' : '☆'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                {folderGroups.length === 0 && favoriteQueries.length === 0 && (
                                    <div className="query-selector-empty">
                                        No queries found matching "{searchTerm}"
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
