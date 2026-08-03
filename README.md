# Nomad Wealth Website v11 — Clean Authentication Repair

This release was rebuilt from the exact files uploaded from the deployed project.

## Authentication included

- Email/password signup
- Email confirmation link
- Email/password login
- Forgot-password email
- Password reset
- Persistent Supabase session
- Visible success and error messages
- Logout

## Temporarily removed

- Google login
- Six-digit OTP
- Multiple authentication helper scripts

These were removed so the core authentication flow has only one implementation.

## Deployment

Upload every file from this folder to the GitHub repository root and replace older files.

After Vercel deploys, clear the site's stored data once or open it in a private browser window.
