/**
 * Query Gantt Hub - Entry Point
 * This is the main entry point for the Azure DevOps extension hub
 */

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { QueryGanttHub } from './components/QueryGanttHub/QueryGanttHub';

// Render the application
const container = document.getElementById('root');
if (container) {
    ReactDOM.render(
        React.createElement(QueryGanttHub),
        container
    );
}
