/**
 * Field Configuration Modal
 * Allows users to configure which fields to use for effort calculations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { azureDevOpsService } from '../../services/AzureDevOpsService';
import { fieldConfigService, IFieldConfig, IWorkItemField } from '../../services/FieldConfigService';
import './FieldConfigModal.css';

interface IFieldConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

export const FieldConfigModal: React.FC<IFieldConfigModalProps> = ({ isOpen, onClose, onSave }) => {
    const [fields, setFields] = useState<IWorkItemField[]>([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<IFieldConfig>(fieldConfigService.getConfig());
    const sortedFields = useMemo(
        () => [...fields].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
        [fields]
    );

    useEffect(() => {
        if (isOpen) {
            loadFields();
            setConfig(fieldConfigService.getConfig());
        }
    }, [isOpen]);

    const loadFields = async () => {
        setLoading(true);
        try {
            const availableFields = await azureDevOpsService.getWorkItemFields();
            // Filter to only numeric fields
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

    if (!isOpen) return null;

    return (
        <div className="field-config-overlay" onClick={onClose}>
            <div className="field-config-modal" onClick={e => e.stopPropagation()}>
                <div className="field-config-header">
                    <h2>⚙️ Configure Effort Fields</h2>
                    <button className="field-config-close" onClick={onClose}>×</button>
                </div>

                <div className="field-config-body">
                    <p className="field-config-description">
                        Select which Azure DevOps fields to use for effort calculations.
                        Only numeric fields are shown.
                    </p>

                    {loading ? (
                        <div className="field-config-loading">Loading fields...</div>
                    ) : (
                        <div className="field-config-form">
                            <div className="field-config-row">
                                <label htmlFor="effort-field">
                                    <span className="field-label">Effort (Total Hours)</span>
                                    <span className="field-hint">Field used for planned/estimated work</span>
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

                            <div className="field-config-row">
                                <label htmlFor="remaining-field">
                                    <span className="field-label">Remaining Work</span>
                                    <span className="field-hint">Field used for remaining hours</span>
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

                            <div className="field-config-row">
                                <label>
                                    <span className="field-label">Done %</span>
                                    <span className="field-hint">Automatically calculated from Effort and Remaining</span>
                                </label>
                                <div className="field-config-calculated">
                                    🔢 <strong>Auto-Calculated:</strong> 100 - (Remaining ÷ Effort × 100)
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="field-config-footer">
                    <button className="field-config-btn field-config-btn-reset" onClick={handleReset}>
                        Reset to Defaults
                    </button>
                    <div className="field-config-footer-right">
                        <button className="field-config-btn field-config-btn-cancel" onClick={onClose}>
                            Cancel
                        </button>
                        <button className="field-config-btn field-config-btn-save" onClick={handleSave}>
                            Save Configuration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FieldConfigModal;
