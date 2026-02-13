# Query Gantt Chart for Azure DevOps

A Gantt Chart hub for Azure DevOps that visualizes work items from any saved query with automatic effort rollup, percent complete calculations, and timeline bars.

## Features

### Gantt Chart Visualization
- Timeline bars for all work item types: Epic, Feature, Product Backlog Item, User Story, Bug, Task, and custom types
- Day, Week, and Month view modes with dynamic scaling
- Today line indicator on the timeline
- Click any bar or title to open the work item directly in Azure DevOps

### Hierarchical View with Effort Rollup
- Collapsible tree structure: Epic > Feature > PBI/Bug > Task
- Automatic bottom-up effort rollup from tasks through the hierarchy
- Bugs and PBIs without child tasks use their own effort and remaining fields
- Configurable effort and remaining work fields via Settings

### Percent Complete (Done %)
- Automatically calculated: `Done % = 100 - (Remaining / Effort x 100)`
- Weighted rollup from children to parents based on effort
- Overall Done % displayed in the toolbar, consistent with individual item calculations
- Items without effort use state-based estimation (New = 0%, Active = 50%, Done = 100%)

### Smart Date Calculations
- Uses all available date fields: Start Date, Target Date, Finish Date, Dev Completion Date, QA Completion Date
- Inherits start dates from parent items when not set on the item itself
- Calculates end dates from planned hours using a 7-hour working day (skips weekends)
- Items without a start date show "No start date" on their bar

### Visual Indicators
- Remaining work shown in red when it exceeds planned effort
- Removed items appear grayed out with strikethrough text instead of showing as complete
- Color-coded bars per work item type (orange for Epic, purple for Feature, blue for PBI, red for Bug, yellow for Task)
- Progress fill with striped pattern shows completed vs remaining work

### Query Integration
- Works with Flat, Tree, and One-Hop query types
- Enhanced query selector with search and folder grouping (My Queries / Shared Queries)
- Supports any saved query in your Azure DevOps project

### Export
- Export to Excel with summary statistics, work item details, and by-type breakdown
- Export Gantt chart screenshot as PNG

### Theme Support
- Dark theme (default) with glassmorphism effects
- Light theme with clean, professional styling
- Toggle between themes with a single click

### Configurable Fields
- Choose which fields to use for effort (default: Original Estimate)
- Choose which fields to use for remaining work (default: Remaining Work)
- Settings persist per user

## Effort Rollup Rules

| Level                    | Effort (h)                        | Remaining (h)                        | Done %                               |
| ------------------------ | --------------------------------- | ------------------------------------ | ------------------------------------ |
| **Task**                 | Planned Hours (Original Estimate) | Remaining Work                       | 100 - (Remaining / Effort x 100)     |
| **Bug/PBI** (with tasks) | Sum of child task effort          | Sum of child task remaining          | Weighted average of child Done %     |
| **Bug/PBI** (no tasks)   | Own effort field                  | Own remaining or inferred from state | Calculated from effort and remaining |
| **Feature/Epic**         | Sum of child PBI/Bug effort       | Sum of child PBI/Bug remaining       | Weighted average of child Done %     |

## Date Bar Calculation Rules

| Level            | Start Date                                             | End Date                                              |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| **Task**         | Start Date or inherited from parent                    | Start + Planned Hours (7h/day) or Target/Finish Date  |
| **Bug/PBI**      | Start Date or inherited from parent                    | Dev Completion, QA Completion, Target, or Finish Date |
| **Feature/Epic** | Start Date or inherited from parent, or earliest child | Target Date, Finish Date, or latest child end date    |

## How to Use

1. Navigate to **Azure Boards** in your Azure DevOps project
2. Click **Query Gantt Chart** in the hub navigation
3. Select a saved query from the dropdown
4. Use the toolbar to switch view modes, expand/collapse, export, or adjust settings

## Toolbar Controls

| Control                   | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| Day / Week / Month        | Switch timeline view mode                                |
| Expand All / Collapse All | Toggle hierarchy visibility                              |
| Date Range Picker         | Filter the visible timeline range                        |
| Export                    | Export to Excel or PNG screenshot                        |
| Settings                  | Configure effort and remaining work fields, switch theme |
| Refresh                   | Reload data from Azure DevOps                            |

## Supported Work Item Types

- Epic, Feature, Product Backlog Item, User Story, Requirement, Bug, Issue, Task, Test Case, Release
- Custom work item types are displayed with a neutral color and mapped to the closest hierarchy level

## Required Scopes

- `vso.work` - Read work items and queries

## Extension Logic Flow

The following diagram illustrates the core data flow and logic of the extension, from initialization to rendering the Gantt chart and Resource view.

```mermaid
graph TD
    %% Nodes
    Init([Extension Initialization])
    SDK[Azure DevOps SDK]
    Query{Query Type?}
    
    subgraph Data Fetching
        GetQueries[Get Saved Queries]
        ExecQuery[Execute Selected Query]
        FetchWI[Fetch Work Items (Details)]
        FetchRel[Fetch Work Item Relations]
    end

    subgraph Hierarchy Builder
        BuildTree[Build Hierarchy Tree]
        RelLogic[Map Parent-Child Relations]
        Sort[Sort by Level & ID]
    end

    subgraph Logic Services
        DateCalc[Date Calculation Service]
        EffortCalc[Effort Rollup Service]
    end
    
    subgraph UI Rendering
        GanttView[Gantt Chart View]
        ResView[Resource Allocation View]
        Theme[Theme Service]
    end

    %% Flow
    Init --> SDK
    SDK --> GetQueries
    GetQueries -->|User Selects Query| ExecQuery
    
    ExecQuery -->|Flat Query| FetchWI
    ExecQuery -->|Tree/Link Query| FetchRel
    FetchRel --> FetchWI
    
    FetchWI --> BuildTree
    
    BuildTree --> Query
    Query -->|Tree| RelLogic
    Query -->|Flat| RelLogic
    RelLogic --> Sort
    
    Sort --> DateCalc
    DateCalc --> EffortCalc
    
    EffortCalc --> GanttView
    EffortCalc --> ResView
    
    %% Detailed Logic - Dates
    subgraph Date Rules
        D1[Start: Explicit -> Inherited -> Created]
        D2[End: Explicit -> Derived from Children -> Derived from Effort]
        D1 --> D2
    end
    
    DateCalc -.-> D1
    
    %% Detailed Logic - Effort
    subgraph Rollup Rules
        R1[Effort: Sum of Children]
        R2[Remaining: Sum of Children]
        R3[Done %: (1 - Remaining/Effort) * 100]
        R1 --> R2 --> R3
    end
    
    EffortCalc -.-> R1

    %% Styling
    Theme -.-> GanttView
    Theme -.-> ResView
```

### Key Logic Explanations

1.  **Hierarchy Generation**:
    *   The extension fetches work items based on the selected query.
    *   `WorkItemHierarchyService` constructs a tree structure (Epic -> Feature -> PBI -> Task) based on parent-child links.
    *   Orphan items in tree queries are placed at the root level.

2.  **Date Resolution**:
    *   **Start Date**: Uses `Start Date` field. If missing, it inherits from the parent. If still missing, falls back to `Created Date`.
    *   **End Date**: Uses `Target Date`, `Due Date`, or `Finish Date`.
    *   **Inference**: If dates are missing, the extension estimates duration based on `Original Estimate` (Planned Hours) or child item dates.
    *   **Dotted Bars**: If an item has no planned effort and no explicit dates, it renders as a dotted bar to indicate uncertainty.

3.  **Effort Rollup**:
    *   Values bubble up from **Task** level to **PBI**, **Feature**, and **Epic**.
    *   `Effort` (Planned) and `Remaining Work` are summed up the tree.
    *   `Done %` is calculated at each level based on the aggregated values: `100 - (Remaining / Effort * 100)`.

4.  **Resource Allocation**:
    *   The extension flattens the hierarchy and groups items by `Assigned To`.
    *   It aggregates Planned and Remaining effort per user to visualize workload.
