# Nomad Wealth Website v10.2 — Authentication Rebuilt

Fixes:
- Uses official Supabase ESM import
- Removes fragile global Supabase script
- Login errors can no longer fail silently
- Login button always recovers after an error
- Google button label is always visible
- Google OAuth errors are displayed
- Forms can never expose credentials in the URL
- Startup failures are shown directly on the login page
- New service-worker cache version
