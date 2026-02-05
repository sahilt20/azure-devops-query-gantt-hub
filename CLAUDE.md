# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An Azure DevOps extension that adds a Gantt Chart hub to visualize work items with automatic effort rollup and percent complete calculations. The extension renders a hierarchical view (Epic → Feature → PBI → Task) with timeline visualization.

## Development Commands

```bash
# Install dependencies
npm install

# Development server (runs on https://localhost:3001)
npm run start:dev

# Production build
npm run build

# Development build (faster, includes source maps)
npm run build:dev

# Package extension (.vsix file for Azure DevOps Marketplace)
npm run package

# Clean build artifacts
npm run clean
```

## Extension Configuration

The extension manifest is in `vss-extension.json`:
- Update `version` field before packaging new releases
- `publisher` field must match your Azure DevOps Marketplace publisher ID
- Extension runs as a hub in the Azure Boards work-hub-group

## Architecture

### Service Layer (Singleton Pattern)

All services use singleton pattern via `getInstance()`:

- **AzureDevOpsService**: Azure DevOps REST API integration, initializes SDK, fetches queries and work items
- **WorkItemHierarchyService**: Converts flat work items to hierarchical tree, handles parent-child relationships
- **EffortRollupService**: Calculates effort rollup from bottom-up (Task → PBI → Feature → Epic)
- **FieldConfigService**: Manages user field configuration (effort field, remaining work field)
- **ThemeService**: Handles light/dark theme switching
- **ExportService**: Exports Gantt chart as PNG with proper theme support using html2canvas
- **MockDataService**: Provides sample data for localhost development

### Work Item Hierarchy

The extension enforces this 4-level hierarchy:

```
Level 0: Epic
Level 1: Feature
Level 2: Product Backlog Item / User Story / Bug / Requirement / Issue
Level 3: Task / Test Case
```

Work item type mappings are in `src/models/WorkItemModels.ts` in `WorkItemTypeLevel` constant. The extension supports custom process templates by mapping similar types to the same level.

### Data Flow

1. User selects query → `AzureDevOpsService.executeQuery()`
2. Fetch work items → `AzureDevOpsService.getWorkItems()`
3. Convert to nodes → `WorkItemHierarchyService.convertToNode()`
4. Build hierarchy → `WorkItemHierarchyService.buildHierarchy()`
5. Calculate rollup → `EffortRollupService.calculateRollup()`
6. Render → `GanttChart` component

### Effort Calculation Rules

**Effort (Planned Hours):**
- Task: Uses configured effort field (default: Original Estimate)
- Parent items: Sum of all descendant effort values

**Remaining Work:**
- Task: Uses configured remaining field (default: Remaining Work)
- Parent items: Sum of all descendant remaining values

**Done %:**
- Calculated as: `100 - (Remaining Work / Effort × 100)`
- Automatically rolls up from children to parents

### Date/Bar Calculation Rules

Defined in `WorkItemHierarchyService.ts` header comments:
- **Feature/Epic**: Start Date → Target Date; fallback to child date range
- **PBI/Bug**: Start Date → Dev/QA Completion Date; fallback to child task dates + Planned Hours
- **Task**: Start Date + Planned Hours (7h working day); fallback to Iteration Path start + Planned Hours
- **Default**: 2 days with empty bar if no dates/children

## Component Structure

```
QueryGanttHub (main container)
├── QuerySelector (enhanced dropdown with search)
├── GanttChart (main visualization)
│   ├── DateRangePicker (timeline filter)
│   ├── GanttTimeline (header with dates)
│   ├── GanttRow (each work item row)
│   │   └── GanttBar (progress bar)
│   └── FieldConfigModal (field settings)
└── SettingsPanel (theme and configuration)
```

All components use React Hooks (functional components, no class components).

## Path Aliases

Configured in both `tsconfig.json` and `webpack.config.js`:

```typescript
import { GanttChart } from '@components/GanttChart/GanttChart';
import { azureDevOpsService } from '@services/AzureDevOpsService';
import { IWorkItemNode } from '@models/WorkItemModels';
import { parseAzureDate } from '@utils/DateUtils';
```

## CSS & Styling

- Each component has its own `.css` file co-located with the `.tsx` file
- Dark theme with glassmorphism effects is the default
- Light theme support added in v1.2.9+
- Theme switching handled by `ThemeService`

## Local Development Mode

The extension detects localhost and automatically uses mock data:

```typescript
const isDevelopment = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
```

Mock data is in `MockDataService.ts` with sample queries and work items.

## Azure DevOps SDK Integration

The extension uses `azure-devops-extension-sdk` and `azure-devops-extension-api`:

1. Initialize SDK: `SDK.init()` in `AzureDevOpsService.initialize()`
2. Get project context: `SDK.getService<IProjectPageService>()`
3. Fetch data via REST API using native `fetch()` with SDK token authentication
4. Required scopes in manifest: `vso.work`, `vso.work_full`

## Known Issues & Workarounds

### Content Security Policy
Webpack source maps cause CSP `unsafe-eval` errors. **Solution**: `devtool: false` in `webpack.config.js` (already configured).

### Export/Screenshot Theme Issues
Light theme screenshots previously showed dark theme. **Solution**: Use html2canvas `onclone` callback to inject inline styles and theme classes (implemented in `ExportService.ts`).

## Version Bumping

Before packaging:
1. Update `version` in `vss-extension.json`
2. Update `version` in `package.json`
3. Run `npm run build && npm run package`
4. Generated `.vsix` file can be uploaded to Azure DevOps Marketplace
