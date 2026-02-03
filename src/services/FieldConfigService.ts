/**
 * Field Configuration Service
 * Manages user's field mapping preferences for effort calculations
 * Stores configuration in localStorage
 */

export interface IFieldConfig {
    effortField: string;        // Field for total effort/planned hours
    remainingField: string;     // Field for remaining work
    doneField: string;          // Field for done % (or 'calculated' to compute from effort/remaining)
}

export interface IWorkItemField {
    referenceName: string;      // e.g., 'Microsoft.VSTS.Scheduling.OriginalEstimate'
    name: string;               // e.g., 'Original Estimate'
    type: string;               // e.g., 'double', 'integer'
    isNumeric: boolean;
}

const STORAGE_KEY = 'gantt-field-config';

// Default field mappings (Azure DevOps standard fields)
const DEFAULT_CONFIG: IFieldConfig = {
    effortField: 'Microsoft.VSTS.Scheduling.OriginalEstimate',
    remainingField: 'Microsoft.VSTS.Scheduling.RemainingWork',
    doneField: 'calculated' // Special value meaning "calculate from effort and remaining"
};

class FieldConfigService {
    private static instance: FieldConfigService;
    private config: IFieldConfig;

    private constructor() {
        this.config = this.loadConfig();
    }

    public static getInstance(): FieldConfigService {
        if (!FieldConfigService.instance) {
            FieldConfigService.instance = new FieldConfigService();
        }
        return FieldConfigService.instance;
    }

    /**
     * Load configuration from localStorage
     */
    private loadConfig(): IFieldConfig {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load field config:', e);
        }
        return { ...DEFAULT_CONFIG };
    }

    /**
     * Save configuration to localStorage
     */
    private saveConfig(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.warn('Failed to save field config:', e);
        }
    }

    /**
     * Get current configuration
     */
    public getConfig(): IFieldConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public setConfig(config: Partial<IFieldConfig>): void {
        this.config = { ...this.config, ...config };
        this.saveConfig();
    }

    /**
     * Reset to default configuration
     */
    public resetConfig(): void {
        this.config = { ...DEFAULT_CONFIG };
        this.saveConfig();
    }

    /**
     * Get the short name of a field (without namespace)
     */
    public getFieldShortName(referenceName: string): string {
        const parts = referenceName.split('.');
        return parts[parts.length - 1];
    }

    /**
     * Get value from work item using configured field
     */
    public getFieldValue(workItem: any, fieldType: 'effort' | 'remaining' | 'done'): number {
        const fieldName = this.config[`${fieldType}Field` as keyof IFieldConfig];

        if (fieldType === 'done' && fieldName === 'calculated') {
            // Calculate from effort and remaining
            const effort = this.getFieldValue(workItem, 'effort');
            const remaining = this.getFieldValue(workItem, 'remaining');
            if (effort > 0) {
                return Math.round(100 - ((remaining / effort) * 100));
            }
            return 0;
        }

        // Try to get value from work item fields
        if (workItem.fields && workItem.fields[fieldName] !== undefined) {
            return Number(workItem.fields[fieldName]) || 0;
        }

        // Try common field mappings
        const shortName = this.getFieldShortName(fieldName).toLowerCase();
        for (const [key, value] of Object.entries(workItem)) {
            if (key.toLowerCase().includes(shortName)) {
                return Number(value) || 0;
            }
        }

        return 0;
    }
}

export const fieldConfigService = FieldConfigService.getInstance();
export default fieldConfigService;
