/**
 * Work Item Type Utilities
 * Handles type classification, abbreviations, and color generation for custom work item types
 */

/**
 * Standard work item type mapping
 */
const STANDARD_TYPES = {
    epic: { class: 'epic', abbr: 'E' },
    feature: { class: 'feature', abbr: 'F' },
    pbi: { class: 'pbi', abbr: 'P' },
    userStory: { class: 'pbi', abbr: 'S' },
    requirement: { class: 'pbi', abbr: 'R' },
    task: { class: 'task', abbr: 'T' },
    testCase: { class: 'task', abbr: 'C' },
    bug: { class: 'bug', abbr: 'B' },
    issue: { class: 'bug', abbr: 'I' },
    release: { class: 'release', abbr: 'R' }
};

/**
 * Generate a hash from a string
 */
function stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

/**
 * Generate a consistent color for custom work item types using hash
 * @param typeName The work item type name
 * @returns HSL color string
 */
export const getCustomTypeColor = (typeName: string): string => {
    const hash = stringToHash(typeName.toLowerCase());
    // Generate hue from hash (0-360)
    const hue = Math.abs(hash % 360);
    // Use consistent saturation and lightness for visual harmony and good contrast
    const saturation = 65; // Vibrant but not overwhelming
    const lightness = 50;  // Good contrast with white text
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Get the CSS class name for a work item type
 * @param workItemType The work item type name
 * @returns CSS class name (e.g., 'epic', 'feature', 'custom')
 */
export const getWorkItemTypeClass = (workItemType: string): string => {
    const type = (workItemType || '').toLowerCase();

    if (type.includes('epic')) return STANDARD_TYPES.epic.class;
    if (type.includes('feature')) return STANDARD_TYPES.feature.class;
    if (type.includes('backlog') || type.includes('user story') || type.includes('requirement')) {
        return STANDARD_TYPES.pbi.class;
    }
    if (type.includes('task') || type.includes('test case')) return STANDARD_TYPES.task.class;
    if (type.includes('bug') || type.includes('issue')) return STANDARD_TYPES.bug.class;
    if (type.includes('release')) return STANDARD_TYPES.release.class;

    // Return 'custom' for unrecognized types
    return 'custom';
};

/**
 * Get the abbreviation for a work item type
 * @param workItemType The work item type name
 * @returns Single character abbreviation
 */
export const getWorkItemTypeAbbreviation = (workItemType: string): string => {
    const type = (workItemType || '').toLowerCase();

    if (type.includes('epic')) return STANDARD_TYPES.epic.abbr;
    if (type.includes('feature')) return STANDARD_TYPES.feature.abbr;
    if (type.includes('backlog')) return STANDARD_TYPES.pbi.abbr;
    if (type.includes('user story')) return STANDARD_TYPES.userStory.abbr;
    if (type.includes('requirement')) return STANDARD_TYPES.requirement.abbr;
    if (type.includes('task')) return STANDARD_TYPES.task.abbr;
    if (type.includes('test case')) return STANDARD_TYPES.testCase.abbr;
    if (type.includes('bug')) return STANDARD_TYPES.bug.abbr;
    if (type.includes('issue')) return STANDARD_TYPES.issue.abbr;
    if (type.includes('release')) return STANDARD_TYPES.release.abbr;

    // Use first character of the work item type for custom types
    return (workItemType || '?').charAt(0).toUpperCase();
};

/**
 * Check if a work item type is a custom type
 * @param workItemType The work item type name
 * @returns True if custom type, false if standard type
 */
export const isCustomType = (workItemType: string): boolean => {
    return getWorkItemTypeClass(workItemType) === 'custom';
};
