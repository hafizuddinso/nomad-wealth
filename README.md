# Nomad Wealth Global v5 — Correction Release

Developed by **Hafizuddin**.

## Major fixes

- `app.js` is now loaded with `type="module"`, which is required because it imports Supabase.
- Complete ISO country selector with localized country names.
- Automatic default currency by country.
- Curated major-bank suggestions for common countries.
- Users can always type a custom bank name.
- Working profile editor connected to Supabase user metadata.
- Light, dark and system appearance modes.
- Core interface translation for English, Bengali, Russian, Spanish, French, German, Arabic and Portuguese.
- RTL layout for Arabic.
- Google users receive an onboarding dialog when profile details are missing.
- Updated service worker with network-first refresh and a new cache version.

## Supabase

The included `config.js` uses your current Supabase project URL and browser-safe anon key.

In Supabase Authentication settings, verify:

1. **Site URL** is your exact Vercel production URL.
2. **Redirect URLs** include your exact Vercel URL and `http://localhost:8080/**`.
3. Google provider is enabled and its Google Cloud callback URL matches the callback displayed by Supabase.
4. Email confirmation is enabled.
5. The Confirm signup template uses `{{ .Token }}` if you want users to enter a six-digit OTP.

## Bank coverage

There is no single complete, free and reliable public list of every bank in every country. This project provides curated suggestions for major countries plus Wise, Revolut, PayPal, Payoneer, Cash and **Other / Custom bank**. Users can type any institution name.

## Deploy

Upload all files to the root of your GitHub repository. Vercel:

- Framework: Other
- Root directory: `./`
- Build command: empty
- Output directory: empty

After deployment, hard-refresh once or test in a private window because previous service-worker versions may remain cached.


## Global v5 corrections

- Organized transaction alignment with a dedicated amount and delete column
- High-contrast close and delete controls
- Real country dropdowns in transaction, account, travel, budget and profile forms
- New transactions sorted by creation time so the latest entry appears first
- Currency and country stored per budget
- Full supported currency list available for accounts, budgets and investments
- Manual exchange-rate editor replaced by a two-currency converter
- Optional online exchange-rate refresh with offline fallback
- Dark-theme contrast fixes for budget and calculator panels
- Existing browser data automatically migrated
