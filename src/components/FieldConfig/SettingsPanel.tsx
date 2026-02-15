/**
 * Settings Panel
 * Azure DevOps-style side panel with field configuration and documentation
 */

import React, { useState, useEffect } from 'react';
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
            setFields(numericFields);
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
                                                {fields.map(field => (
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
                                                {fields.map(field => (
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
                                    <h4>Done % Calculation</h4>
                                    <p>
                                        Progress percentage is automatically calculated using the formula:
                                        <code>Done % = 100 - (Remaining Work ÷ Total Effort × 100)</code>
                                    </p>
                                    <p>
                                        For work items without effort values, the percentage is calculated based on child work items.
                                    </p>

                                    <h4>Effort Rollup</h4>
                                    <p>
                                        Effort values automatically roll up through the work item hierarchy:
                                    </p>
                                    <ul>
                                        <li><strong>Tasks:</strong> Use their own Original Estimate (Planned Hours)</li>
                                        <li><strong>PBIs/Bugs:</strong> Sum of all child task hours</li>
                                        <li><strong>Features:</strong> Sum of all child PBI/Bug hours</li>
                                        <li><strong>Epics:</strong> Sum of all child Feature hours</li>
                                    </ul>
                                    <p>
                                        This ensures parent work items always reflect the total effort of their children.
                                    </p>

                                    <h4>Date Range Calculation</h4>
                                    <p>
                                        The Gantt chart calculates start and end dates using different logic per work item type:
                                    </p>

                                    <h5>Tasks</h5>
                                    <ul>
                                        <li>Uses Start Date + Planned Hours (7-hour working day)</li>
                                        <li>Falls back to parent-chain start date + Planned Hours</li>
                                        <li>Falls back to Iteration Path start + Planned Hours</li>
                                        <li>Falls back to Created Date if no ancestor has a start date</li>
                                    </ul>

                                    <h5>PBIs & Bugs</h5>
                                    <ul>
                                        <li>Uses Start Date → Dev/QA Completion Date</li>
                                        <li>Falls back to inherited start date or earliest child start date</li>
                                        <li>Calculates end date from sum of child Planned Hours</li>
                                        <li>Falls back to Created Date</li>
                                    </ul>

                                    <h5>Features & Epics</h5>
                                    <ul>
                                        <li>Uses Start Date → Target Date</li>
                                        <li>Falls back to inherited start date or child date range</li>
                                        <li>Estimates duration based on children if no explicit dates</li>
                                        <li>Falls back to Created Date</li>
                                    </ul>

                                    <h4>Start Date Inheritance</h4>
                                    <p>
                                        <strong>Important:</strong> Start date resolution follows a strict chain:
                                        <code>Own Start Date → Parent Start Date (recursive) → Work Item Created Date</code>.
                                    </p>
                                    <p>
                                        For example: If a Task has no start date, it checks parent PBI, then Feature, then Epic.
                                        If no ancestor has a start date, the task's Created Date is used as the timeline start.
                                    </p>
                                    <p>
                                        This keeps bars anchored on the timeline even when Start Date is missing on the current item.
                                    </p>

                                    <h4>Operational Tabs</h4>
                                    <ul>
                                        <li><strong>Resource Allocation:</strong> Task-only workload view (parent items excluded)</li>
                                        <li><strong>Delivery Console:</strong> Combined delivery-manager view with analytics, risk filters, and task-only allocation</li>
                                    </ul>

                                    <h4>Delivery Console Metrics</h4>
                                    <p>
                                        Delivery Console is task-based. All measures below are calculated from open tasks in the selected query.
                                    </p>

                                    <h5>Core Health Metrics</h5>
                                    <ul>
                                        <li><strong>Completion (Gantt):</strong> Same weighted overall percent used in Gantt toolbar (from rollup totals)</li>
                                        <li><strong>Delivery Health (0-100):</strong> 100 minus weighted penalties for Overdue, Overrun, Blocked, Unassigned, and No Estimate tasks</li>
                                        <li><strong>Delivery Confidence (0-100):</strong> Weighted composite of Completion, Delivery Health, Estimate Coverage, Assignment Coverage, and Load Balance</li>
                                    </ul>

                                    <h5>Coverage & Pressure Metrics</h5>
                                    <ul>
                                        <li><strong>Estimate Coverage %:</strong> (Open tasks with estimate &gt; 0 / Total open tasks) × 100</li>
                                        <li><strong>Assignment Coverage %:</strong> (Open tasks with assigned owner / Total open tasks) × 100</li>
                                        <li><strong>Schedule Pressure %:</strong> (Open tasks due within next 7 days / Total open tasks) × 100</li>
                                        <li><strong>Risk Density %:</strong> (At-risk open tasks / Total open tasks) × 100</li>
                                    </ul>

                                    <h5>Effort Risk Metrics</h5>
                                    <ul>
                                        <li><strong>Exposure Hours:</strong> Sum of remaining hours for tasks due within 7 days</li>
                                        <li><strong>Overrun Hours:</strong> Sum of max(Remaining - Estimated, 0) for overrun tasks</li>
                                        <li><strong>Load Balance %:</strong> 100 - normalized workload variation across owners (higher is better balanced)</li>
                                    </ul>

                                    <h5>Risk Classification Logic</h5>
                                    <ul>
                                        <li><strong>Overdue:</strong> End/Due date is earlier than today (schedule risk)</li>
                                        <li><strong>Overrun:</strong> Remaining hours exceed estimated/planned hours (effort risk)</li>
                                        <li><strong>Blocked:</strong> State includes blocked/impediment/on hold</li>
                                        <li><strong>No Estimate:</strong> Estimated/planned effort is 0</li>
                                        <li><strong>Unassigned:</strong> Assigned To is empty or Unassigned</li>
                                        <li><strong>Risk Score (0-100):</strong> Aggregated per-task score from risk flags, due urgency, and remaining effort</li>
                                    </ul>

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
                                        <dt>Original Estimate / Planned Hours</dt>
                                        <dd>
                                            The initial estimate of how many hours a task will take to complete.
                                            Also called "Effort" for Product Backlog Items.
                                        </dd>

                                        <dt>Remaining Work</dt>
                                        <dd>
                                            The number of hours still needed to complete a work item.
                                            This value decreases as work progresses.
                                        </dd>

                                        <dt>Completed Work</dt>
                                        <dd>
                                            The number of hours already spent on a work item.
                                            Calculated as: Original Estimate - Remaining Work.
                                        </dd>

                                        <dt>Done %</dt>
                                        <dd>
                                            The percentage of work completed. Auto-calculated using the formula:
                                            100 - (Remaining ÷ Effort × 100).
                                        </dd>

                                        <dt>Rollup</dt>
                                        <dd>
                                            The process of summing child work item values up to parent work items.
                                            For example, a Feature's rollup effort is the sum of all its PBI efforts.
                                        </dd>

                                        <dt>Start Date</dt>
                                        <dd>
                                            The date when work on an item is scheduled to begin.
                                            Can be explicit or inherited from parent work items.
                                        </dd>

                                        <dt>Target Date</dt>
                                        <dd>
                                            The date when work on an item is scheduled to complete.
                                            Used primarily for Features and Epics.
                                        </dd>

                                        <dt>Dev/QA Completion Date</dt>
                                        <dd>
                                            Custom fields indicating when development or QA testing is expected to finish.
                                            Used to calculate end dates for PBIs and Bugs.
                                        </dd>

                                        <dt>Created Date</dt>
                                        <dd>
                                            The date when a work item was created in Azure DevOps.
                                            Used as the final fallback if no other start date is available.
                                        </dd>

                                        <dt>Working Day</dt>
                                        <dd>
                                            Defined as 7 hours for duration calculations.
                                            Weekends are excluded when calculating working hours.
                                        </dd>

                                        <dt>Iteration Path</dt>
                                        <dd>
                                            The sprint or iteration a work item is assigned to.
                                            Can provide start/end dates if explicit dates aren't set.
                                        </dd>

                                        <dt>Valid Dates</dt>
                                        <dd>
                                            Indicates whether a work item has real dates (explicit or inherited)
                                            or is using default estimated dates. Items without valid dates show a dashed border.
                                        </dd>

                                        <dt>Overdue vs Overrun</dt>
                                        <dd>
                                            Overdue means date slippage (due date already passed). Overrun means effort slippage
                                            (remaining hours are greater than estimated hours).
                                        </dd>

                                        <dt>Delivery Health</dt>
                                        <dd>
                                            A 0-100 risk score where higher is better. It decreases based on the proportion of
                                            overdue, overrun, blocked, unassigned, and no-estimate open tasks.
                                        </dd>

                                        <dt>Delivery Confidence</dt>
                                        <dd>
                                            A 0-100 composite indicator that combines completion progress, health score,
                                            estimate/assignment coverage, and workload balance.
                                        </dd>

                                        <dt>Exposure Hours</dt>
                                        <dd>
                                            Total remaining hours for tasks due in the next 7 days.
                                        </dd>

                                        <dt>Load Balance</dt>
                                        <dd>
                                            A 0-100 measure of how evenly remaining workload is distributed across owners.
                                            Higher values indicate better distribution.
                                        </dd>
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
