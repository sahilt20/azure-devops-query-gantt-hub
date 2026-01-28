/**
 * Mock Data Service
 * Provides sample work items for local UI testing without Azure DevOps connection
 */

import { IWorkItemNode, createEmptyWorkItemNode } from '../models/WorkItemModels';

/**
 * Generate sample work items with hierarchy: Epic → Feature → PBI → Task
 */
export function generateSampleWorkItems(): IWorkItemNode[] {
    const today = new Date();
    const addDays = (date: Date, days: number): Date => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    // Epic 1: Platform Modernization
    const epic1: IWorkItemNode = createEmptyWorkItemNode({
        id: 1001,
        title: 'Platform Modernization',
        workItemType: 'Epic',
        state: 'Active',
        assignedTo: 'Sarah Johnson',
        startDate: addDays(today, -30),
        targetDate: addDays(today, 60),
        level: 0,
        isExpanded: true,
        children: []
    });

    // Feature 1.1: Authentication System
    const feature1_1: IWorkItemNode = createEmptyWorkItemNode({
        id: 2001,
        title: 'Authentication System Upgrade',
        workItemType: 'Feature',
        state: 'Active',
        assignedTo: 'Mike Chen',
        startDate: addDays(today, -25),
        targetDate: addDays(today, 20),
        parentId: 1001,
        level: 1,
        isExpanded: true,
        children: []
    });

    // PBI 1.1.1: Login Page Redesign
    const pbi1_1_1: IWorkItemNode = createEmptyWorkItemNode({
        id: 3001,
        title: 'Login Page Redesign',
        workItemType: 'Product Backlog Item',
        state: 'Active',
        assignedTo: 'Emily Davis',
        effort: 13,
        startDate: addDays(today, -20),
        targetDate: addDays(today, -5),
        parentId: 2001,
        level: 2,
        isExpanded: true,
        children: []
    });

    // Tasks for PBI 1.1.1
    const task1: IWorkItemNode = createEmptyWorkItemNode({
        id: 4001,
        title: 'Create UI mockups',
        workItemType: 'Task',
        state: 'Closed',
        assignedTo: 'Emily Davis',
        originalEstimate: 8,
        completedWork: 8,
        remainingWork: 0,
        startDate: addDays(today, -20),
        targetDate: addDays(today, -15),
        parentId: 3001,
        level: 3,
        isExpanded: false,
        children: []
    });

    const task2: IWorkItemNode = createEmptyWorkItemNode({
        id: 4002,
        title: 'Implement login form',
        workItemType: 'Task',
        state: 'Closed',
        assignedTo: 'Alex Kim',
        originalEstimate: 16,
        completedWork: 16,
        remainingWork: 0,
        startDate: addDays(today, -15),
        targetDate: addDays(today, -8),
        parentId: 3001,
        level: 3,
        isExpanded: false,
        children: []
    });

    const task3: IWorkItemNode = createEmptyWorkItemNode({
        id: 4003,
        title: 'Add OAuth integration',
        workItemType: 'Task',
        state: 'Active',
        assignedTo: 'Alex Kim',
        originalEstimate: 12,
        completedWork: 6,
        remainingWork: 6,
        startDate: addDays(today, -8),
        targetDate: addDays(today, -2),
        parentId: 3001,
        level: 3,
        isExpanded: false,
        children: []
    });

    // PBI 1.1.2: Password Reset Flow
    const pbi1_1_2: IWorkItemNode = createEmptyWorkItemNode({
        id: 3002,
        title: 'Password Reset Flow',
        workItemType: 'Product Backlog Item',
        state: 'Active',
        assignedTo: 'Mike Chen',
        effort: 8,
        startDate: addDays(today, -5),
        targetDate: addDays(today, 10),
        parentId: 2001,
        level: 2,
        isExpanded: true,
        children: []
    });

    const task4: IWorkItemNode = createEmptyWorkItemNode({
        id: 4004,
        title: 'Design reset email template',
        workItemType: 'Task',
        state: 'Closed',
        assignedTo: 'Emily Davis',
        originalEstimate: 4,
        completedWork: 4,
        remainingWork: 0,
        startDate: addDays(today, -5),
        targetDate: addDays(today, -3),
        parentId: 3002,
        level: 3,
        isExpanded: false,
        children: []
    });

    const task5: IWorkItemNode = createEmptyWorkItemNode({
        id: 4005,
        title: 'Implement reset API',
        workItemType: 'Task',
        state: 'Active',
        assignedTo: 'Mike Chen',
        originalEstimate: 8,
        completedWork: 2,
        remainingWork: 6,
        startDate: addDays(today, -2),
        targetDate: addDays(today, 5),
        parentId: 3002,
        level: 3,
        isExpanded: false,
        children: []
    });

    // Feature 1.2: Dashboard Redesign
    const feature1_2: IWorkItemNode = createEmptyWorkItemNode({
        id: 2002,
        title: 'Dashboard Redesign',
        workItemType: 'Feature',
        state: 'New',
        assignedTo: 'Sarah Johnson',
        startDate: addDays(today, 5),
        targetDate: addDays(today, 45),
        parentId: 1001,
        level: 1,
        isExpanded: true,
        children: []
    });

    // PBI 1.2.1: Widget Framework
    const pbi1_2_1: IWorkItemNode = createEmptyWorkItemNode({
        id: 3003,
        title: 'Widget Framework',
        workItemType: 'Product Backlog Item',
        state: 'New',
        assignedTo: 'Alex Kim',
        effort: 21,
        startDate: addDays(today, 5),
        targetDate: addDays(today, 25),
        parentId: 2002,
        level: 2,
        isExpanded: true,
        children: []
    });

    const task6: IWorkItemNode = createEmptyWorkItemNode({
        id: 4006,
        title: 'Design widget API',
        workItemType: 'Task',
        state: 'New',
        assignedTo: 'Alex Kim',
        originalEstimate: 16,
        completedWork: 0,
        remainingWork: 16,
        startDate: addDays(today, 5),
        targetDate: addDays(today, 12),
        parentId: 3003,
        level: 3,
        isExpanded: false,
        children: []
    });

    const task7: IWorkItemNode = createEmptyWorkItemNode({
        id: 4007,
        title: 'Implement base components',
        workItemType: 'Task',
        state: 'New',
        assignedTo: 'Mike Chen',
        originalEstimate: 24,
        completedWork: 0,
        remainingWork: 24,
        startDate: addDays(today, 12),
        targetDate: addDays(today, 22),
        parentId: 3003,
        level: 3,
        isExpanded: false,
        children: []
    });

    // Bug in Feature 1.1
    const bug1: IWorkItemNode = createEmptyWorkItemNode({
        id: 5001,
        title: 'Login fails on Safari',
        workItemType: 'Bug',
        state: 'Active',
        assignedTo: 'Emily Davis',
        originalEstimate: 4,
        completedWork: 1,
        remainingWork: 3,
        startDate: addDays(today, -3),
        targetDate: addDays(today, 2),
        parentId: 2001,
        level: 2,
        isExpanded: false,
        children: []
    });

    // Build hierarchy
    pbi1_1_1.children = [task1, task2, task3];
    pbi1_1_2.children = [task4, task5];
    pbi1_2_1.children = [task6, task7];

    feature1_1.children = [pbi1_1_1, pbi1_1_2, bug1];
    feature1_2.children = [pbi1_2_1];

    epic1.children = [feature1_1, feature1_2];

    // Epic 2: Mobile App
    const epic2: IWorkItemNode = createEmptyWorkItemNode({
        id: 1002,
        title: 'Mobile App Development',
        workItemType: 'Epic',
        state: 'Active',
        assignedTo: 'David Wilson',
        startDate: addDays(today, -15),
        targetDate: addDays(today, 75),
        level: 0,
        isExpanded: true,
        children: []
    });

    const feature2_1: IWorkItemNode = createEmptyWorkItemNode({
        id: 2003,
        title: 'iOS App Core',
        workItemType: 'Feature',
        state: 'Active',
        assignedTo: 'Lisa Park',
        startDate: addDays(today, -10),
        targetDate: addDays(today, 30),
        parentId: 1002,
        level: 1,
        isExpanded: true,
        children: []
    });

    const pbi2_1_1: IWorkItemNode = createEmptyWorkItemNode({
        id: 3004,
        title: 'Navigation Framework',
        workItemType: 'Product Backlog Item',
        state: 'Active',
        assignedTo: 'Lisa Park',
        effort: 13,
        startDate: addDays(today, -10),
        targetDate: addDays(today, 5),
        parentId: 2003,
        level: 2,
        isExpanded: true,
        children: []
    });

    const task8: IWorkItemNode = createEmptyWorkItemNode({
        id: 4008,
        title: 'Setup React Navigation',
        workItemType: 'Task',
        state: 'Closed',
        assignedTo: 'Lisa Park',
        originalEstimate: 8,
        completedWork: 8,
        remainingWork: 0,
        startDate: addDays(today, -10),
        targetDate: addDays(today, -5),
        parentId: 3004,
        level: 3,
        isExpanded: false,
        children: []
    });

    const task9: IWorkItemNode = createEmptyWorkItemNode({
        id: 4009,
        title: 'Implement tab navigation',
        workItemType: 'Task',
        state: 'Active',
        assignedTo: 'David Wilson',
        originalEstimate: 12,
        completedWork: 8,
        remainingWork: 4,
        startDate: addDays(today, -5),
        targetDate: addDays(today, 2),
        parentId: 3004,
        level: 3,
        isExpanded: false,
        children: []
    });

    pbi2_1_1.children = [task8, task9];
    feature2_1.children = [pbi2_1_1];
    epic2.children = [feature2_1];

    return [epic1, epic2];
}

/**
 * Sample queries for the dropdown
 */
export const sampleQueries = [
    { id: 'sample-1', name: 'All Active Work Items', path: 'Shared Queries/All Active Work Items', queryType: 'tree' as const, isFolder: false },
    { id: 'sample-2', name: 'Sprint Backlog', path: 'Shared Queries/Sprint Backlog', queryType: 'flat' as const, isFolder: false },
    { id: 'sample-3', name: 'My Tasks', path: 'My Queries/My Tasks', queryType: 'flat' as const, isFolder: false },
];

export default generateSampleWorkItems;
