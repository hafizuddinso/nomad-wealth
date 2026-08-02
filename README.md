# Nomad Wealth Global v8 — Charts Everywhere

This release adds visible Chart.js analytics throughout the application.

## Chart locations

- Dashboard: six-month income vs expenses, current-month category doughnut
- Transactions: filtered category pie, daily-spending line
- Accounts: account-balance bar, currency-exposure doughnut
- Budgets: stacked used-vs-remaining progress chart
- Investments: cost-vs-value bar, portfolio-allocation doughnut
- Savings Goals: saved-vs-remaining progress chart
- Insights: 12-month income, expenses and net-savings line

Charts update when transactions, accounts, budgets, investments, goals, filters, cloud data or theme changes.

## Why no candlestick chart

Candlestick charts require real open, high, low and close market-price history. Nomad Wealth currently stores only investment cost and current value. A fake candlestick chart would be misleading. The app uses accurate portfolio performance and allocation charts instead.

## Deployment

Upload all files to GitHub root and run the existing `supabase-schema-v7.sql` only if it has not already been run.

The charts use Chart.js through the official jsDelivr CDN pattern.
