-- Nomad Wealth v14 safe additive migration
-- Adds companion tables only. It does not alter or delete Global v7 data.
create extension if not exists pgcrypto;

create table if not exists public.profiles_v14 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_path text,
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_rules_v14 (
  budget_id uuid primary key,
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  period text not null check (period in ('weekly','monthly','yearly')),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.loans_v14 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  name text not null,
  lender text,
  account_id uuid references public.accounts(id) on delete set null,
  currency text not null,
  asset_price numeric(18,2),
  initial_deposit numeric(18,2) not null default 0,
  principal numeric(18,2) not null check (principal > 0),
  annual_rate numeric(8,4) not null default 0,
  term_months int not null check (term_months > 0),
  frequency text not null check (frequency in ('weekly','biweekly','monthly','quarterly')),
  installment numeric(18,2) not null,
  start_date date not null,
  next_payment_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_repayments_v14 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  loan_id uuid not null references public.loans_v14(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  payment_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  principal_paid numeric(18,2) not null default 0,
  interest_paid numeric(18,2) not null default 0,
  extra_principal numeric(18,2) not null default 0,
  note text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.travel_plans_v14 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  name text not null,
  destination_country text not null,
  account_id uuid references public.accounts(id) on delete set null,
  currency text not null,
  budget numeric(18,2) not null check (budget >= 0),
  start_date date not null,
  end_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles_v14 enable row level security;
alter table public.budget_rules_v14 enable row level security;
alter table public.loans_v14 enable row level security;
alter table public.loan_repayments_v14 enable row level security;
alter table public.travel_plans_v14 enable row level security;

drop policy if exists "users manage own profile v14" on public.profiles_v14;
create policy "users manage own profile v14" on public.profiles_v14 for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

do $$ declare t text; begin
  foreach t in array array['budget_rules_v14','loans_v14','loan_repayments_v14','travel_plans_v14'] loop
    execute format('drop policy if exists "members read %1$s" on public.%1$I',t);
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_workspace_member_v7(workspace_id))',t);
    execute format('drop policy if exists "editors write %1$s" on public.%1$I',t);
    execute format('create policy "editors write %1$s" on public.%1$I for all to authenticated using (public.can_edit_workspace_v7(workspace_id)) with check (public.can_edit_workspace_v7(workspace_id))',t);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-images','profile-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "users read own profile images v14" on storage.objects;
create policy "users read own profile images v14" on storage.objects for select to authenticated
using (bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users upload own profile images v14" on storage.objects;
create policy "users upload own profile images v14" on storage.objects for insert to authenticated
with check (bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users update own profile images v14" on storage.objects;
create policy "users update own profile images v14" on storage.objects for update to authenticated
using (bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users delete own profile images v14" on storage.objects;
create policy "users delete own profile images v14" on storage.objects for delete to authenticated
using (bucket_id='profile-images' and (storage.foldername(name))[1]=auth.uid()::text);
