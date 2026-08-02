# Nomad Wealth Global v6 Pro

A responsive, multi-country personal finance application developed by **Hafizuddin**.

## v6 features

- Advanced transaction search, date/category/country/amount filters and sorting
- Friendly empty states
- Currency converter
- Spending-by-category pie chart
- Net-worth trend line chart
- Monthly comparison summary
- Currency-aware budget progress
- Automatic recurring transactions
- CSV export
- Printable PDF report export
- Savings goals and contributions
- Browser bill reminders
- Real Supabase cloud synchronization
- Multi-device data
- Shared family/couple workspaces with invite codes
- Realtime updates between connected devices

## Activate cloud sync

Open Supabase Dashboard → SQL Editor and run the complete contents of:

`supabase-schema.sql`

Refresh the app after the SQL finishes.

The app stores each workspace as a protected JSON document in Supabase. Row Level Security allows only workspace members to access it.

## Security

- Uses authenticated Supabase users
- Uses Row Level Security
- Never put a secret or service-role key in `config.js`
- Use a Supabase publishable browser key

## PDF export

The PDF button opens a printable report. In the browser print dialog choose **Save as PDF**.

## Notifications

Browser notifications require user permission and browser/PWA support. They are generated from recurring entries due within three days.
