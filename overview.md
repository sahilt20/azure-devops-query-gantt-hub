# Query Gantt Chart for Azure DevOps

Query Gantt Chart adds two delivery views to Azure DevOps Boards queries:

1. `Gantt Chart`: hierarchy + timeline + effort rollup
2. `Delivery Console`: advanced delivery analytics + task-only resource allocation

## Highlights

- Supports Flat, Tree, and One-Hop queries.
- Hierarchy rollup from Task up to parent levels.
- Start date fallback chain: `Start Date -> Parent chain Start Date -> Created Date`.
- Done % and overall completion use consistent weighted rollup logic.
- Delivery Console includes risk filters and action-oriented analytics.

## Delivery Console Metrics

Computed from open task items in the selected query:

- Delivery Health (0-100)
- Delivery Confidence (0-100)
- Estimate Coverage %, Assignment Coverage %
- Risk Density %, Schedule Pressure %
- Exposure Hours, Overrun Hours
- Load Balance %
- Owner Risk Matrix and Top Bottlenecks

Risk logic includes distinct handling for:
- `Overdue` (schedule slippage)
- `Overrun` (effort slippage)
- `Blocked`, `Unassigned`, `No Estimate`

## Operational Notes

- Work items in Delivery views are clickable and open directly in Azure DevOps.
- Resource allocation is task-only to avoid parent rollup double counting.
- Export supports Excel and Gantt screenshot.

## Permissions

Required scope:
- `vso.work`

## Full Documentation

Detailed setup, formulas, architecture notes, and release history are consolidated in:
- `README.md`
