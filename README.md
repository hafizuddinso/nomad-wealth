# Nomad Wealth v13.5 — Responsive Auth & Font Fix

Changes:
- Rebuilt the public front page from scratch
- Simple landing page with only Create Account and Log In actions
- Clean login, signup, password reset modal
- Responsive layout for Samsung Internet, Chrome Android, iPhone Safari, tablets and desktop
- Corrected corrupted authentication HTML from the previous build
- Font choices now apply to the entire interface
- Font applies to headings, buttons, forms, menus and numbers
- Font preference persists after refresh
- Existing dashboard, transactions, loan tracking and all finance features remain unchanged


## Market research

The Investments page provides search for Nasdaq-listed names through Nasdaq Trader and an indicative gold spot price from Gold API. Individual stock quote lookup requires an optional `FINNHUB_API_KEY` in the Vercel server environment; without it the feature clearly reports unavailable quotes rather than making up prices. Market results may be delayed. Bank lists are curated suggestions, and users may type unlisted institutions.


## Display currency and page layout

Choose the display currency in the top bar, including BDT. Account, transaction, budget, loan and investment values are shown in the selected display currency using available exchange rates, while records retain their original currency and amount. Reference exchange rates are refreshed automatically when possible and can be manually refreshed in Settings. If a rate is unavailable, do not interpret an unavailable conversion as a zero balance. The rate date is shown beside the currency selector.

Major pages now use one or two vertically scrollable sections with optional smooth scroll snapping on larger screens; mobile keeps natural page scrolling. The dashboard starts with current-month figures and six-month charts, then continues to accounts, recent transactions and related financial tools.

## World market directory

The country selector includes the available country list. Supported market directories include the Nasdaq public directory and optional Finnhub-backed regional lookups (for example Bangladesh/DSE, Russia/MOEX, UK, India and other markets). Provider support is not universal. Individual quotes and non-Nasdaq directories require `FINNHUB_API_KEY` on the Vercel server, and may be unavailable under a provider's plan. Market prices and FX conversions are informational rather than executable trading quotes.
