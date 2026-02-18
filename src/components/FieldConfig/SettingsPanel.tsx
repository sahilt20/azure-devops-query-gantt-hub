/**
 * Settings Panel
 * Azure DevOps-style side panel with field configuration and documentation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { fieldConfigService, IFieldConfig, IWorkItemField } from '../../services/FieldConfigService';
import './SettingsPanel.css';

interface ISettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

type SectionId = 'fields' | 'how-it-works' | 'key-terms';

export const SettingsPanel: React.FC<ISettingsPanelProps> = ({ isOpen, onClose, onSave }) => {
    const [fields, setFields] = useState<IWorkItemField[]>([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<IFieldConfig>(fieldConfigService.getConfig());
    const [initialConfig, setInitialConfig] = useState<IFieldConfig>(fieldConfigService.getConfig());
    const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(new Set(['fields']));

    const hasChanges = JSON.stringify(config) !== JSON.stringify(initialConfig);
    const sortedFields = useMemo(
        () => [...fields].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        [fields]
    );
    const glossaryTerms = useMemo(() => ([
        {
            term: 'Assignment Coverage',
            description: 'Percentage of open tasks with a named owner. Example: 18 assigned out of 20 open tasks = 90%.'
        },
        {
            term: 'Completed Work',
            description: 'Hours already delivered for a work item. For tasks this comes from Completed Work; for parents it is rolled up from children.'
        },
        {
            term: 'Created Date',
            description: 'The date a work item was created. It is the final fallback start date when Start, Iteration Start, and parent Start are unavailable.'
        },
        {
            term: 'Delivery Confidence',
            description: 'Composite score based on completion, health, estimate coverage, assignment coverage, and balance. Higher is better for delivery risk.'
        },
        {
            term: 'Done %',
            description: 'Progress percentage. Formula: 100 - (Remaining / Effort x 100). Example: Effort=40h, Remaining=10h => 75% done.'
        },
        {
            term: 'Effort (Planned Hours)',
            description: 'Estimated total hours to complete scope. Tasks usually use Original Estimate; parents use rollup from child items.'
        },
        {
            term: 'Iteration Path',
            description: 'Sprint path assigned to an item. If item Start Date is empty, the iteration start date is used before parent inheritance.'
        },
        {
            term: 'Load Balance',
            description: 'How evenly remaining work is distributed across owners. Lower balance means concentration risk on a small number of owners.'
        },
        {
            term: 'Overrun',
            description: 'When forecast effort exceeds estimate. Forecast is Completed + Remaining. Example: estimate=16h, forecast=22h => 6h overrun.'
        },
        {
            term: 'Remaining Work',
            description: 'Hours left to complete a work item. This drives risk visibility and percent-complete calculations.'
        },
        {
            term: 'Removed State',
            description: 'Items in Removed state are visually muted and excluded from effort/remaining rollup totals to avoid false delivery load.'
        },
        {
            term: 'Rollup',
            description: 'Aggregation of child effort/remaining/completed into parent items (Task -> PBI/Bug -> Feature -> Epic).'
        },
        {
            term: 'Start Date Resolution',
            description: 'Order is fixed: Item Start Date -> Iteration Start Date -> Parent-chain Start Date -> Created Date.'
        },
        {
            term: 'Valid Dates',
            description: 'Indicates whether dates are explicitly available from fields. Even when explicit dates are missing, fallback logic still resolves timeline placement.'
        },
        {
            term: 'Working Day',
            description: 'Duration calculations use 7 working hours per day and skip weekends for working-hour based scheduling.'
        }
    ]).sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' })), []);

    useEffect(() => {
        if (isOpen) {
            loadFields();
            const currentConfig = fieldConfigService.getConfig();
            setConfig(currentConfig);
            setInitialConfig(currentConfig);
        }
    }, [isOpen]);

    const loadFields = async () => {
        setLoading(true);
        try {
            const availableFields = await azureDevOpsService.getWorkItemFields();
            const numericFields = availableFields.filter(f => f.isNumeric);

            // Ensure key effort-related fields are always present in the dropdown,
            // even if the Azure DevOps project doesn't expose them via the fields API.
            const pinnedFields: IWorkItemField[] = [
                { referenceName: 'Microsoft.VSTS.Scheduling.OriginalEstimate', name: 'Original Estimate', type: 'double', isNumeric: true },
                { referenceName: 'Microsoft.VSTS.Scheduling.PlannedHours', name: 'Planned Hours', type: 'double', isNumeric: true },
                { referenceName: 'Microsoft.VSTS.Scheduling.Effort', name: 'Effort (Story Points)', type: 'double', isNumeric: true },
                { referenceName: 'Microsoft.VSTS.Scheduling.RemainingWork', name: 'Remaining Work', type: 'double', isNumeric: true },
                { referenceName: 'Microsoft.VSTS.Scheduling.CompletedWork', name: 'Completed Work', type: 'double', isNumeric: true },
                { referenceName: 'Microsoft.VSTS.Scheduling.StoryPoints', name: 'Story Points', type: 'double', isNumeric: true },
            ];

            const merged = [...numericFields];
            for (const pinned of pinnedFields) {
                if (!merged.some(f => f.referenceName.toLowerCase() === pinned.referenceName.toLowerCase())) {
                    merged.push(pinned);
                }
            }

            setFields(merged);
        } catch (error) {
            console.error('Failed to load fields:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (fieldType: keyof IFieldConfig, value: string) => {
        setConfig(prev => ({ ...prev, [fieldType]: value }));
    };

    const handleSave = () => {
        fieldConfigService.setConfig(config);
        onSave();
        onClose();
    };

    const handleReset = () => {
        fieldConfigService.resetConfig();
        setConfig(fieldConfigService.getConfig());
    };

    const toggleSection = (sectionId: SectionId) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sectionId)) {
                newSet.delete(sectionId);
            } else {
                newSet.add(sectionId);
            }
            return newSet;
        });
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div className="settings-overlay" onClick={onClose} />

            {/* Side Panel */}
            <div className="settings-panel">
                {/* Header */}
                <div className="settings-header">
                    <h2>⚙️ Settings</h2>
                    <button className="settings-close" onClick={onClose}>×</button>
                </div>

                {/* Content */}
                <div className="settings-content">
                    {/* Field Configuration Section */}
                    <div className="settings-section">
                        <button
                            className="settings-section-header"
                            onClick={() => toggleSection('fields')}
                        >
                            <span className="settings-section-title">📊 Field Configuration</span>
                            <span className={`settings-section-arrow ${expandedSections.has('fields') ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </button>
                        {expandedSections.has('fields') && (
                            <div className="settings-section-body">
                                <p className="settings-description">
                                    Configure which Azure DevOps fields to use for effort calculations.
                                </p>

                                {loading ? (
                                    <div className="settings-loading">Loading fields...</div>
                                ) : (
                                    <div className="settings-form">
                                        <div className="settings-field">
                                            <label htmlFor="effort-field">
                                                <span className="field-label">Effort (Total Hours)</span>
                                                <span className="field-hint">Field for planned/estimated work</span>
                                            </label>
                                            <select
                                                id="effort-field"
                                                value={config.effortField}
                                                onChange={e => handleFieldChange('effortField', e.target.value)}
                                            >
                                                {sortedFields.map(field => (
                                                    <option key={field.referenceName} value={field.referenceName}>
                                                        {field.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="settings-field">
                                            <label htmlFor="remaining-field">
                                                <span className="field-label">Remaining Work</span>
                                                <span className="field-hint">Field for remaining hours</span>
                                            </label>
                                            <select
                                                id="remaining-field"
                                                value={config.remainingField}
                                                onChange={e => handleFieldChange('remainingField', e.target.value)}
                                            >
                                                {sortedFields.map(field => (
                                                    <option key={field.referenceName} value={field.referenceName}>
                                                        {field.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="settings-field">
                                            <label>
                                                <span className="field-label">Done %</span>
                                                <span className="field-hint">Auto-calculated from Effort and Remaining</span>
                                            </label>
                                            <div className="settings-calculated">
                                                🔢 <strong>Auto-Calculated:</strong> 100 - (Remaining ÷ Effort × 100)
                                            </div>
                                        </div>

                                        <button className="settings-reset-btn" onClick={handleReset}>
                                            Reset to Defaults
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* How It Works Section */}
                    <div className="settings-section">
                        <button
                            className="settings-section-header"
                            onClick={() => toggleSection('how-it-works')}
                        >
                            <span className="settings-section-title">💡 How It Works</span>
                            <span className={`settings-section-arrow ${expandedSections.has('how-it-works') ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </button>
                        {expandedSections.has('how-it-works') && (
                            <div className="settings-section-body">
                                <div className="settings-doc">
                                    <h4>Effort Rollup</h4>
                                    <p>
                                        Effort and remaining values roll up bottom-up through the hierarchy:
                                    </p>
                                    <ul>
                                        <li><strong>Tasks:</strong> Use their own Original Estimate (Planned Hours)</li>
                                        <li><strong>PBIs/Bugs:</strong> Sum of all child task hours</li>
                                        <li><strong>Features:</strong> Sum of all child PBI/Bug hours</li>
                                        <li><strong>Epics:</strong> Sum of all child Feature hours</li>
                                    </ul>
                                    <p>
                                        Removed items are excluded from rollup totals so they do not inflate overall effort or remaining work.
                                    </p>
                                    <p>
                                        Example: If Task A = 8h and Task B = 12h under one PBI, that PBI effort becomes 20h.
                                    </p>

                                    <h4>Done % Calculation</h4>
                                    <p>
                                        Progress percentage is automatically calculated using:
                                        <code>Done % = 100 - (Remaining Work ÷ Total Effort × 100)</code>
                                    </p>
                                    <p>
                                        Example: Effort 40h and Remaining 10h results in 75% Done. If effort is zero, the system derives progress from children or state.
                                    </p>

                                    <h4>Date Range Calculation</h4>
                                    <p>
                                        Start and end dates are resolved using deterministic rules per work item type.
                                    </p>

                                    <h5>Tasks</h5>
                                    <ul>
                                        <li>Uses Start Date + Planned Hours (7-hour working day)</li>
                                        <li>Falls back to Iteration Path start + Planned Hours</li>
                                        <li>Falls back to parent-chain Start Date + Planned Hours</li>
                                        <li>Falls back to work item's Created Date</li>
                                    </ul>

                                    <h5>PBIs & Bugs</h5>
                                    <ul>
                                        <li>Uses Start Date → Dev/QA Completion Date</li>
                                        <li>Falls back to Iteration Path start, then parent-chain Start Date</li>
                                        <li>Calculates end date from sum of child Planned Hours</li>
                                        <li>Falls back to work item's Created Date</li>
                                    </ul>

                                    <h5>Features & Epics</h5>
                                    <ul>
                                        <li>Uses Start Date → Target Date</li>
                                        <li>Falls back to Iteration Path start, then parent-chain Start Date</li>
                                        <li>Estimates duration based on children if no explicit dates</li>
                                        <li>Falls back to work item's Created Date</li>
                                    </ul>

                                    <h4>Start Date Resolution</h4>
                                    <p>
                                        Start date resolution always follows this strict order:
                                        work item Start Date → Iteration Start Date → parent-chain Start Date → work item Created Date.
                                    </p>
                                    <p>
                                        Example chain: Task (no Start Date) in Sprint 12 (has start) uses Sprint 12 start. If Sprint 12 has no dates, it checks PBI, then Feature, then Epic Start Date. If none exist, it uses the task Created Date.
                                    </p>
                                    <p>
                                        This ensures every work item has a start date and can always be rendered on the Gantt timeline.
                                    </p>

                                    <h4>Worked Examples</h4>
                                    <p>
                                        <strong>Example 1 (Task):</strong> Start Date empty, Iteration start = 2026-02-01, Planned = 14h.
                                        Result: Start = 2026-02-01, End calculated by working hours.
                                    </p>
                                    <p>
                                        <strong>Example 2 (PBI):</strong> Start empty, Iteration empty, parent Feature Start = 2026-03-10.
                                        Result: Start inherits 2026-03-10; end uses completion date or child-derived duration.
                                    </p>
                                    <p>
                                        <strong>Example 3 (Rollup):</strong> 3 tasks with remaining 5h, 3h, and 0h under one PBI.
                                        Result: PBI Remaining = 8h; parent Feature and Epic remaining values include this 8h.
                                    </p>

                                    <h4>Timeline Scaling</h4>
                                    <p>
                                        The timeline automatically adjusts to show all work items with appropriate spacing:
                                    </p>
                                    <ul>
                                        <li><strong>Day View:</strong> Each column represents one day</li>
                                        <li><strong>Week View:</strong> Each column represents one week</li>
                                        <li><strong>Month View:</strong> Each column represents one month</li>
                                    </ul>
                                    <p>
                                        Weekends are highlighted, and today's date is marked with a red line for easy reference.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Key Terms Section */}
                    <div className="settings-section">
                        <button
                            className="settings-section-header"
                            onClick={() => toggleSection('key-terms')}
                        >
                            <span className="settings-section-title">📖 Key Terms</span>
                            <span className={`settings-section-arrow ${expandedSections.has('key-terms') ? 'expanded' : ''}`}>
                                ▼
                            </span>
                        </button>
                        {expandedSections.has('key-terms') && (
                            <div className="settings-section-body">
                                <div className="settings-doc">
                                    <dl className="settings-glossary">
                                        {glossaryTerms.map(item => (
                                            <React.Fragment key={item.term}>
                                                <dt>{item.term}</dt>
                                                <dd>{item.description}</dd>
                                            </React.Fragment>
                                        ))}
                                    </dl>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="settings-footer">
                    <button className="settings-btn settings-btn-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className={`settings-btn settings-btn-save ${!hasChanges ? 'disabled' : ''}`}
                        onClick={handleSave}
                        disabled={!hasChanges}
                    >
                        Save Configuration
                    </button>
                </div>
            </div>
        </>
    );
};

export default SettingsPanel;
