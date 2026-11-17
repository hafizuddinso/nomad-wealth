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
