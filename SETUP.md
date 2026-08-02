# Nomad Wealth — Setup Guide

A responsive multi-country and multi-currency personal finance dashboard designed and developed by **Hafizuddin**.

## Authentication features

- First-visit login screen
- Email and password registration
- Email OTP verification
- Google OAuth login
- Password reset email
- Persistent user sessions
- Logged-in user's name and email shown in the dashboard
- Logout
- Short onboarding questions:
  - Name
  - Current country
  - Main reporting currency
  - User type
- Separate browser finance data for each authenticated user

## Important: Supabase setup is required

Authentication cannot work until you create and configure a Supabase project.

### 1. Create a Supabase project

Create a project at Supabase and open:

`Project Settings → API`

Copy:

- Project URL
- Publishable key or anon key

Open `config.js` and replace:

```js
window.NOMAD_WEALTH_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_PROJECT_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY"
};
```

Never put a `service_role` or secret key in browser code.

### 2. Configure site and redirect URLs

In Supabase:

`Authentication → URL Configuration`

Set:

- Site URL: your Vercel production URL
- Redirect URL: your Vercel production URL
- For local testing, also add `http://localhost:8080`

### 3. Configure email OTP

Supabase can send either a confirmation link or a code depending on the email template.

In:

`Authentication → Email Templates → Confirm signup`

Use the token variable in the email body:

```html
<h2>Your Nomad Wealth verification code</h2>
<p>Enter this code in the app:</p>
<h1>{{ .Token }}</h1>
```

Do not use only `{{ .ConfirmationURL }}` when you want the six-digit OTP screen.

Keep email confirmation enabled.

For a real public app, configure custom SMTP under:

`Authentication → SMTP Settings`

This allows a branded sender address such as `no-reply@yourdomain.com`.

### 4. Configure Google login

Create a Google Cloud OAuth application, then in Supabase:

`Authentication → Providers → Google`

Enable Google and enter the Google Client ID and Client Secret.

Use the callback URL shown by Supabase in your Google OAuth configuration.

### 5. Deploy

Upload all files directly to the GitHub repository root:

- index.html
- styles.css
- app.js
- config.js
- manifest.json
- service-worker.js
- vercel.json

Vercel settings:

- Framework: Other
- Root directory: `./`
- Build command: empty
- Output directory: empty

## Security note

This edition uses Supabase Auth, but financial records are still stored in browser `localStorage`. Authentication is real after Supabase setup; cloud finance synchronization is not yet implemented. For a production application, move accounts and transactions to Supabase PostgreSQL tables with Row Level Security.

## Technology

HTML, CSS, JavaScript, Supabase Auth, localStorage, Service Worker, GitHub and Vercel.
