# Azure DevOps Query Gantt Chart Extension

A custom Azure DevOps extension that adds a Gantt hub and a Delivery Console for planning and tracking delivery from saved queries.

## Product Overview

The extension provides two working views:

1. `Gantt Chart`: timeline view with hierarchy, rollups, and configurable date/effort logic.
2. `Delivery Console`: combined delivery analytics and task-only resource allocation in one tab.

Work item hierarchy supported by default:

```text
Epic (Level 0)
└── Feature (Level 1)
    └── Product Backlog Item / Bug (Level 2)
        └── Task (Level 3)
```

## Screenshots

### Query Selector
![Query Selector](images/query-selector.png)

### Gantt Day View
![Day View](images/gantt-day-view.png)

### Gantt Month View
![Month View](images/gantt-month-view.png)

### Field Configuration
![Field Config](images/field-config.png)

## Core Features

### Gantt Chart
- Timeline bars for Epic, Feature, PBI, Bug, Task, and custom types.
- Day/Week/Month modes.
- Expand/collapse hierarchy.
- Today marker and date-range controls.
- Click rows/bars to open work items in Azure DevOps.

### Effort Rollup
- Task-level effort and remaining values roll up to parent levels.
- Done % calculation:
  - `Done % = 100 - (Remaining / Effort × 100)`
- Weighted percent logic is used for parent and overall percentages.

### Start Date Resolution
Start is resolved in this order:
1. Item `Start Date`
2. Parent chain `Start Date` (recursive)
3. Item `Created Date`

This keeps bars anchored even when direct start dates are missing.

### Delivery Console (Merged View)
Delivery Console combines:
1. Delivery Analysis
2. Task-only Resource Allocation

Resource allocation intentionally excludes parent rollup rows to avoid double-counting.

## Delivery Analytics Measures

All metrics are computed from open task items in the selected query.

### Core Scores
- `Completion (Gantt)`: same weighted overall percent shown in Gantt toolbar.
- `Delivery Health (0-100)`: penalty model over overdue/overrun/blocked/unassigned/no-estimate task ratios.
- `Delivery Confidence (0-100)`: weighted composite of completion, health, estimate coverage, assignment coverage, and load balance.

### Coverage and Pressure
- `Estimate Coverage % = tasks with estimate > 0 / open tasks × 100`
- `Assignment Coverage % = assigned open tasks / open tasks × 100`
- `Schedule Pressure % = open tasks due in next 7 days / open tasks × 100`
- `Risk Density % = at-risk open tasks / open tasks × 100`

### Effort Risk
- `Exposure Hours`: sum of remaining hours on tasks due in next 7 days.
- `Overrun Hours`: sum of `max(Remaining - Estimated, 0)` across overrun tasks.
- `Load Balance %`: normalized owner workload distribution score (higher means better balance).

### Risk Classification
- `Overdue`: end/due date is before today (schedule risk).
- `Overrun`: remaining effort is greater than estimated effort (effort risk).
- `Blocked`: state indicates blocked/impediment/on-hold.
- `No Estimate`: estimate is zero.
- `Unassigned`: no owner.
- `Risk Score (0-100)`: per-task risk ranking from flags, urgency, and remaining effort.

### Delivery Operations
- Risk filters (`All`, `Overdue`, `Overrun`, `Blocked`, `Unassigned`, `No Estimate`).
- Owner filter.
- At-risk list with clickable work item links.
- Owner risk matrix.
- Top bottlenecks.
- Due-next-7-days watchlist.
- Recommended actions.

## Query Integration
- Supports Flat, Tree, and One-Hop query results.
- Query selector with folder grouping and search.
- Works with saved queries in current Azure DevOps project context.

## Export
- Export to Excel.
- Export Gantt screenshot (PNG).

## Configuration

### Field Configuration
In Gantt Settings (`⚙`), configure:
- Effort field
- Remaining work field
- Delivery and date logic reference documentation

### Required Scopes
- `vso.work` (read work items and queries)

## Installation and Build

### Prerequisites
- Node.js 18+
- npm 9+
- Azure DevOps organization
- TFX CLI (`npm install -g tfx-cli`)

### Build

```bash
npm install
npm run build
```

### Package VSIX

```bash
npm run package
```

## Usage

1. Open Azure Boards in your project.
2. Open `Query Gantt Chart` hub.
3. Select a query.
4. Use tabs:
   - `Gantt Chart`
   - `Delivery Console` (analysis + resource allocation)
5. Use toolbar controls for date/view/export/settings.

## Toolbar Controls

| Control | Description |
| --- | --- |
| Day / Week / Month | Timeline mode |
| Expand All / Collapse All | Hierarchy visibility |
| Date Range Picker | Visible timeline window |
| Export | Excel / PNG export |
| Settings | Field mapping and logic docs |
| Refresh | Reload query data |

## Project Structure

```text
src/
  components/
    GanttChart/
    QuerySelector/
    FieldConfig/
    ResourceAllocation/
    DeliveryAnalysis/
    QueryGanttHub/
  services/
    AzureDevOpsService.ts
    WorkItemHierarchyService.ts
    EffortRollupService.ts
    FieldConfigService.ts
  models/
  utils/
```

## Version History

### v1.3.9 (Latest)
- Redesigned Delivery Console filter pipeline so visible row data and filter counts always come from the same query-scoped dataset.
- Added invariant diagnostics and active-filter row counters to detect and prevent count-vs-table drift.
- Hardened risk-table rendering path to guarantee rows populate only for the selected query and selected filter.

### v1.3.8
- Enforced strict query-scoped rendering: no selected/loaded query now shows empty-state instead of stale Delivery data.
- Added request race guards so old async query responses cannot overwrite current selection.
- Added clear-selection option in Query Selector and aligned refresh behavior with selected query context.

### v1.3.7
- Fixed Delivery Console filter/table mismatch where counts showed but rows did not populate.
- Aligned risk chip counts with owner-scoped table results and auto-reset invalid owner selections.

### v1.3.6
- Reworked Delivery Console data pipeline so all filters and counters use one consistent task-facts model.
- Fixed Overrun calculations using forecast effort (`Completed + Remaining`) and added explicit overrun hours.
- Improved Delivery Console views: richer at-risk table, owner risk matrix consistency, and clearer risk breakdown.

### v1.3.5
- Merged Delivery Analysis and Resource Allocation into one Delivery Console tab.
- Added advanced delivery analytics: confidence, risk density, pressure, exposure, overrun hours, load balance, owner risk matrix, bottleneck ranking.
- Added Overrun filter and clarified Overdue vs Overrun logic.
- Expanded Settings documentation with metric formulas and definitions.
- Consolidated documentation so README is the primary full reference.

### v1.3.4
- Added deeper delivery analytics and action-center improvements.
- Updated extension package to 1.3.4.

### v1.3.3
- Added clickable work item links in Delivery Analysis.
- Aligned completion % with Gantt overall percent calculation.

## Troubleshooting

### No project context
Ensure the hub is opened inside a project URL like:
`https://dev.azure.com/{org}/{project}/_apps/hub/...`

### Slow or failed data load
- Check browser console for service logs.
- Confirm access to `dev.azure.com`.

## License

MIT
