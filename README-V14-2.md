# Nomad Wealth Website v14.2

Fixes:

- Loads v14 scripts after the main application modules.
- Connected budget form refreshes accounts whenever it opens.
- Budget cannot save without period, account, category, currency and a positive limit.
- Failed cloud rule saves are rolled back instead of leaving incomplete local budgets.
- Investment cards show an explicit Edit investment button.
- Investment editor is restored after app renders, cloud loads and page navigation.

No additional SQL migration is required after the v14 migration.
