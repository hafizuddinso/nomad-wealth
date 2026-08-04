# Nomad Wealth Website v14 — setup

## Safety
This package keeps the Global v7 tables. The migration only adds companion v14 tables and a private profile-image bucket.

## 1. Back up
Supabase → Database → Backups. Confirm a recent backup exists.

## 2. Run one SQL migration
Supabase → SQL Editor → New query. Open `supabase-migration-v14-safe.sql`, copy all, paste, and click Run once.

## 3. Deploy
Upload all website files to the existing GitHub/Vercel website repository, replacing the old files. Keep `config.js` configured for the same Supabase project.

## 4. Test
1. Log in with an existing account.
2. Confirm the same workspace is selected.
3. Add an account if none exists.
4. Add a connected budget: period → account → category → limit.
5. Add a matching expense and confirm spent/remaining updates.
6. Add a profile picture.
7. Add a travel plan.
8. Add a loan, including deposit and previous installment count.
9. Record a repayment and confirm a `Loan Repayment` expense is created.
10. Open the site in another browser and confirm data loads from Supabase.

## Important
The current iOS app does not yet understand the new v14 companion tables. Existing v7 data remains compatible. iOS must be upgraded next to read these tables.
