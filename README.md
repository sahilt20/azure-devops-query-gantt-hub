# Azure DevOps Query Gantt Chart Extension

A custom Azure DevOps extension that adds a **Gantt Chart** hub to visualize work items from **Epic → Feature → PBI → Task** with automatic effort rollup and percent complete calculations.

## Screenshots

### Gantt Chart with Sample Data
![Gantt Chart with Data](docs/screenshots/gantt-with-data.png)

### Expanded Hierarchy View
![Expanded View](docs/screenshots/gantt-expanded.png)

### Week View Mode
![Week View](docs/screenshots/gantt-week-view.png)

## Features

- 📊 **Gantt Chart Visualization** - View work items on a timeline with progress bars
- 🔄 **Effort Rollup** - Automatically calculates effort from Task level up
- 📈 **Percent Complete** - Shows completion percentage at each level
- 🌳 **Hierarchical View** - Collapsible tree structure (Epic → Feature → PBI → Task)
- 🔍 **Query Integration** - Execute any Azure DevOps query and visualize results
- 🎨 **Modern UI** - Dark theme with smooth animations and glassmorphism effects
- 📅 **Multiple View Modes** - Day, Week, and Month timeline views

## Work Item Hierarchy

```
Epic (Level 0)
└── Feature (Level 1)
    └── Product Backlog Item (Level 2)
        └── Task (Level 3)
```

## Effort Rollup Logic

- **Tasks**: Use `Original Estimate`, `Remaining Work`, and `Completed Work` fields
- **Parent Items**: Sum of all descendant effort values
- **Percent Complete**: `(Completed Work / Total Effort) × 100`

## Installation

### Prerequisites

- Node.js 18+ 
- npm 9+
- Azure DevOps organization
- TFX CLI (`npm install -g tfx-cli`)

### Build & Package

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Package for distribution
npm run package
```

This creates a `.vsix` file that can be uploaded to the Azure DevOps Marketplace.

### Local Development

```bash
# Start development server
npm run start:dev
```

The dev server runs at `https://localhost:3001`. The extension automatically uses sample data when running locally.

## Configuration

### Update Publisher ID

Edit `vss-extension.json` and replace `your-publisher-id` with your Azure DevOps Marketplace publisher ID:

```json
{
    "publisher": "your-actual-publisher-id"
}
```

### Required Scopes

The extension requires the following Azure DevOps scopes:
- `vso.work` - Read work items and queries

## Usage

1. Navigate to **Azure Boards** in your Azure DevOps project
2. Click on **Query Gantt Chart** in the hub navigation
3. Select a query from the dropdown or click **Load All Work Items**
4. The Gantt chart displays with:
   - Work item hierarchy on the left
   - Timeline with progress bars on the right
   - Effort rollup and percent complete for each item

### Toolbar Controls

| Control            | Description                |
| ------------------ | -------------------------- |
| **Day/Week/Month** | Switch timeline view modes |
| **Expand All**     | Expand entire hierarchy    |
| **Collapse All**   | Collapse to top level      |

## Project Structure

```
azure-devops-query-ui-hub/
├── src/
│   ├── components/
│   │   ├── GanttChart/
│   │   │   ├── GanttChart.tsx     # Main Gantt component
│   │   │   ├── GanttRow.tsx       # Work item row
│   │   │   ├── GanttBar.tsx       # Progress bar
│   │   │   ├── GanttTimeline.tsx  # Timeline header
│   │   │   └── GanttChart.css     # Styles
│   │   └── QueryGanttHub/
│   │       ├── QueryGanttHub.tsx  # Main hub component
│   │       └── QueryGanttHub.css  # Hub styles
│   ├── services/
│   │   ├── AzureDevOpsService.ts     # API integration
│   │   ├── WorkItemHierarchyService.ts # Hierarchy building
│   │   ├── EffortRollupService.ts    # Effort calculations
│   │   └── MockDataService.ts        # Sample data for testing
│   ├── models/
│   │   └── WorkItemModels.ts      # TypeScript interfaces
│   ├── utils/
│   │   └── DateUtils.ts           # Date helpers
│   ├── QueryGanttHub.tsx          # Entry point
│   └── QueryGanttHub.html         # HTML template
├── docs/
│   └── screenshots/               # UI screenshots
├── static/
│   └── images/
│       └── gantt-icon.png         # Extension icon
├── vss-extension.json             # Extension manifest
├── package.json
├── tsconfig.json
└── webpack.config.js
```


## Troubleshooting & Known Issues

### "Content Security Policy" blocks 'eval'
If you see an error about `unsafe-eval` in the console:
- This is caused by webpack source maps.
- **Fix**: Build with `devtool: false` (already configured in v1.0.6+).

### Authentication Hanging
If the extension hangs on "Loading...":
- Check the console for `[AzureDevOpsService]` logs.
- Ensure your network allows access to `dev.azure.com`.
- The extension now uses native `fetch()` calls to bypass potential SDK client library issues.

### "No project context" Error
- Ensure you are viewing the hub within an active Azure DevOps project.
- The extension URL should look like: `https://dev.azure.com/{org}/{project}/_apps/hub/...`

## License

MIT
