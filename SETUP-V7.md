# Nomad Wealth v7 — Simple Supabase Setup

## Part 1: Database

1. Open your Supabase project.
2. Click **SQL Editor**.
3. Click **New query**.
4. Open `supabase-schema-v7.sql`.
5. Copy everything.
6. Paste it into Supabase.
7. Click **Run**.
8. Wait for `Success. No rows returned`.

This creates real PostgreSQL tables for accounts, transactions, budgets, investments, savings goals, reminders, members and invitations.

## Part 2: Upload the website

Upload all project files to the root of GitHub. Vercel will deploy automatically.

## Part 3: Email invitations

The invitation is saved even before email delivery is configured. To send an actual email, deploy the included Edge Function:

`supabase/functions/send-workspace-invite/index.ts`

Required Supabase Function secrets:

- `RESEND_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `APP_URL`

Never put these secrets in GitHub.

## Part 4: Email reminders

Deploy:

`supabase/functions/send-due-reminders/index.ts`

Schedule it once per day from Supabase after your Resend email settings work.

## How sharing works

1. Create or select a shared workspace.
2. Choose who you want to share with.
3. Enter their email.
4. Choose Editor or Viewer.
5. Send the invitation.
6. The recipient creates an account or logs in with the same email.
7. The shared workspace appears automatically.

## First cloud login

When the app detects old browser-only data, it asks:

- Import existing data
- Start fresh

Choose Import existing data to move the current accounts, transactions, budgets, investments and goals into PostgreSQL.
