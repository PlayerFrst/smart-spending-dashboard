# Smart Spending Dashboard

A client-side expense tracker built with HTML, CSS, and Vanilla JavaScript.

## Features
- Add, edit, delete expenses
- Keyword-based auto-categorization with persistent learning
- Category doughnut and 30-day time-series charts (Chart.js)
- LocalStorage persistence (`expenses`, `keywordMap`)
- Export expenses as CSV or JSON
- Accessible, responsive UI

## Run
1. Open `index.html` in your browser.

## Tests
- Node logic tests: `node test-logic.js`
- Browser E2E: Manual or use Playwright scripts (not included). The project was validated with Playwright during development.

## Packaging
A ZIP of the project can be created with a command like (PowerShell):

Compress-Archive -Path .\* -DestinationPath ..\smart-spending-dashboard.zip

## Notes
- Works fully client-side; no server required.
- For CI, consider converting Playwright flows into a dedicated test suite.

---
Generated on June 11, 2026.
