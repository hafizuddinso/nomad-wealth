-- Nomad Wealth Global v7 — normalized PostgreSQL cloud database
-- Run this entire file once in Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.finance_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_personal boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  email text not null,
  relationship text,
  role text not null check (role in ('editor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now()+interval '14 days',
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key,
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  name text not null,
  institution text,
  country_code text not null,
  currency text not null,
  account_type text not null,
  opening_balance numeric(18,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key,
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  transaction_type text not null check (transaction_type in ('income','expense')),
  amount numeric(18,2) not null check (amount>=0),
  currency text not null,
  category text not null,
  country_code text not null,
  transaction_date date not null,
  note text,
  frequency text not null default 'once',
  generated_from uuid,
  recurring_series_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key,
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  budget_group text not null,
  category text not null,
  amount_limit numeric(18,2) not null check (amount_limit>=0),
  currency text not null,
  country_code text not null,
  rollover boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.investments (
  id uuid primary key,
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  name text not null,
  investment_type text not null,
  currency text not null,
  cost numeric(18,2) not null default 0,
  current_value numeric(18,2) not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key,
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  name text not null,
  target_amount numeric(18,2) not null check (target_amount>0),
  current_amount numeric(18,2) not null default 0,
  currency text not null,
  target_date date,
  linked_account_id uuid references public.accounts(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  amount numeric(18,2) not null check (amount>0),
  currency text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  source_transaction_id uuid references public.transactions(id) on delete cascade,
  frequency text not null,
  next_run date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date not null,
  remind_days_before int not null default 1 check (remind_days_before in (0,1,3,7)),
  email_enabled boolean not null default true,
  status text not null default 'pending',
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  snapshot_month text not null,
  net_worth numeric(18,2) not null,
  created_at timestamptz not null default now(),
  unique(workspace_id,snapshot_month)
);

create table if not exists public.workspace_sync (
  workspace_id uuid primary key references public.finance_workspaces(id) on delete cascade,
  version bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists transactions_workspace_date_idx on public.transactions(workspace_id,transaction_date desc);
create index if not exists transactions_workspace_category_idx on public.transactions(workspace_id,category);
create index if not exists invitations_email_idx on public.workspace_invitations(lower(email),status);
create index if not exists reminders_due_idx on public.reminders(due_date,status);

create or replace function public.is_workspace_member_v7(p_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=auth.uid()); $$;

create or replace function public.can_edit_workspace_v7(p_workspace uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members where workspace_id=p_workspace and user_id=auth.uid() and role in ('owner','editor')); $$;

alter table public.finance_workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.investments enable row level security;
alter table public.savings_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.reminders enable row level security;
alter table public.net_worth_snapshots enable row level security;
alter table public.workspace_sync enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','budgets','investments','savings_goals','goal_contributions','recurring_rules','net_worth_snapshots','workspace_sync']
  loop
    execute format('drop policy if exists "members read %1$s" on public.%1$I',t);
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using (public.is_workspace_member_v7(workspace_id))',t);
    execute format('drop policy if exists "editors write %1$s" on public.%1$I',t);
    execute format('create policy "editors write %1$s" on public.%1$I for all to authenticated using (public.can_edit_workspace_v7(workspace_id)) with check (public.can_edit_workspace_v7(workspace_id))',t);
  end loop;
end $$;

drop policy if exists "members read workspaces v7" on public.finance_workspaces;
create policy "members read workspaces v7" on public.finance_workspaces for select to authenticated using (public.is_workspace_member_v7(id));
drop policy if exists "members read membership v7" on public.workspace_members;
create policy "members read membership v7" on public.workspace_members for select to authenticated using (public.is_workspace_member_v7(workspace_id));
drop policy if exists "owners manage membership v7" on public.workspace_members;
create policy "owners manage membership v7" on public.workspace_members for all to authenticated using (
 exists(select 1 from public.workspace_members me where me.workspace_id=workspace_members.workspace_id and me.user_id=auth.uid() and me.role='owner')
) with check (
 exists(select 1 from public.workspace_members me where me.workspace_id=workspace_members.workspace_id and me.user_id=auth.uid() and me.role='owner')
);
drop policy if exists "owners manage invitations v7" on public.workspace_invitations;
create policy "owners manage invitations v7" on public.workspace_invitations for all to authenticated using (
 exists(select 1 from public.workspace_members me where me.workspace_id=workspace_invitations.workspace_id and me.user_id=auth.uid() and me.role='owner')
) with check (
 exists(select 1 from public.workspace_members me where me.workspace_id=workspace_invitations.workspace_id and me.user_id=auth.uid() and me.role='owner')
);
drop policy if exists "users read own reminders v7" on public.reminders;
create policy "users read own reminders v7" on public.reminders for select to authenticated using (user_id=auth.uid());
drop policy if exists "users manage own reminders v7" on public.reminders;
create policy "users manage own reminders v7" on public.reminders for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.is_workspace_member_v7(workspace_id));

create or replace function public.ensure_personal_workspace_v7()
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  select w.id into v_id from public.finance_workspaces w
  join public.workspace_members m on m.workspace_id=w.id
  where w.is_personal and m.user_id=auth.uid() limit 1;
  if v_id is null then
    insert into public.finance_workspaces(owner_id,name,is_personal) values(auth.uid(),'Personal finances',true) returning id into v_id;
    insert into public.workspace_members(workspace_id,user_id,role) values(v_id,auth.uid(),'owner');
    insert into public.workspace_sync(workspace_id,updated_by) values(v_id,auth.uid());
  end if;
  return v_id;
end $$;

create or replace function public.create_workspace_v7(p_name text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  insert into public.finance_workspaces(owner_id,name,is_personal) values(auth.uid(),trim(p_name),false) returning id into v_id;
  insert into public.workspace_members(workspace_id,user_id,role) values(v_id,auth.uid(),'owner');
  insert into public.workspace_sync(workspace_id,updated_by) values(v_id,auth.uid());
  return v_id;
end $$;

create or replace function public.invite_workspace_member_by_email(p_workspace_id uuid,p_email text,p_relationship text,p_role text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role='owner') then
    raise exception 'Only the workspace owner can invite members';
  end if;
  if p_role not in ('editor','viewer') then raise exception 'Invalid permission'; end if;
  insert into public.workspace_invitations(workspace_id,email,relationship,role,invited_by)
  values(p_workspace_id,lower(trim(p_email)),p_relationship,p_role,auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_my_workspace_invitations()
returns integer language plpgsql security definer set search_path=public
as $$
declare v_count integer:=0; v_email text;
begin
  v_email:=lower(coalesce(auth.jwt()->>'email',''));
  insert into public.workspace_members(workspace_id,user_id,role)
  select i.workspace_id,auth.uid(),i.role from public.workspace_invitations i
  where lower(i.email)=v_email and i.status='pending' and i.expires_at>now()
  on conflict(workspace_id,user_id) do update set role=excluded.role;
  get diagnostics v_count=row_count;
  update public.workspace_invitations set status='accepted',accepted_by=auth.uid()
  where lower(email)=v_email and status='pending' and expires_at>now();
  return v_count;
end $$;

create or replace function public.replace_workspace_data(p_workspace_id uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if not public.can_edit_workspace_v7(p_workspace_id) then raise exception 'You do not have permission to edit this workspace'; end if;

  delete from public.goal_contributions where workspace_id=p_workspace_id;
  delete from public.recurring_rules where workspace_id=p_workspace_id;
  delete from public.reminders where workspace_id=p_workspace_id and user_id=auth.uid();
  delete from public.transactions where workspace_id=p_workspace_id;
  delete from public.budgets where workspace_id=p_workspace_id;
  delete from public.investments where workspace_id=p_workspace_id;
  delete from public.savings_goals where workspace_id=p_workspace_id;
  delete from public.accounts where workspace_id=p_workspace_id;
  delete from public.net_worth_snapshots where workspace_id=p_workspace_id;

  insert into public.accounts(id,workspace_id,name,institution,country_code,currency,account_type,opening_balance,created_by)
  select (x->>'id')::uuid,p_workspace_id,x->>'name',x->>'institution',x->>'country_code',x->>'currency',x->>'account_type',coalesce((x->>'opening_balance')::numeric,0),auth.uid()
  from jsonb_array_elements(coalesce(p_payload->'accounts','[]'::jsonb)) x;

  insert into public.transactions(id,workspace_id,account_id,transaction_type,amount,currency,category,country_code,transaction_date,note,frequency,created_at,generated_from,recurring_series_id,created_by)
  select (x->>'id')::uuid,p_workspace_id,nullif(x->>'account_id','')::uuid,x->>'transaction_type',(x->>'amount')::numeric,x->>'currency',x->>'category',x->>'country_code',(x->>'transaction_date')::date,x->>'note',coalesce(x->>'frequency','once'),coalesce((x->>'created_at')::timestamptz,now()),nullif(x->>'generated_from','')::uuid,nullif(x->>'recurring_series_id','')::uuid,auth.uid()
  from jsonb_array_elements(coalesce(p_payload->'transactions','[]'::jsonb)) x;

  insert into public.budgets(id,workspace_id,budget_group,category,amount_limit,currency,country_code,rollover,created_by)
  select (x->>'id')::uuid,p_workspace_id,x->>'budget_group',x->>'category',(x->>'amount_limit')::numeric,x->>'currency',x->>'country_code',coalesce((x->>'rollover')::boolean,false),auth.uid()
  from jsonb_array_elements(coalesce(p_payload->'budgets','[]'::jsonb)) x;

  insert into public.investments(id,workspace_id,name,investment_type,currency,cost,current_value,created_by)
  select (x->>'id')::uuid,p_workspace_id,x->>'name',x->>'investment_type',x->>'currency',(x->>'cost')::numeric,(x->>'current_value')::numeric,auth.uid()
  from jsonb_array_elements(coalesce(p_payload->'investments','[]'::jsonb)) x;

  insert into public.savings_goals(id,workspace_id,name,target_amount,current_amount,currency,target_date,linked_account_id,created_by)
  select (x->>'id')::uuid,p_workspace_id,x->>'name',(x->>'target_amount')::numeric,(x->>'current_amount')::numeric,x->>'currency',nullif(x->>'target_date','')::date,nullif(x->>'linked_account_id','')::uuid,auth.uid()
  from jsonb_array_elements(coalesce(p_payload->'savings_goals','[]'::jsonb)) x;

  insert into public.net_worth_snapshots(workspace_id,snapshot_month,net_worth)
  select p_workspace_id,x->>'snapshot_month',(x->>'net_worth')::numeric
  from jsonb_array_elements(coalesce(p_payload->'net_worth_snapshots','[]'::jsonb)) x;

  insert into public.workspace_sync(workspace_id,version,updated_by,updated_at)
  values(p_workspace_id,1,auth.uid(),now())
  on conflict(workspace_id) do update set version=public.workspace_sync.version+1,updated_by=auth.uid(),updated_at=now();
end $$;

grant execute on function public.ensure_personal_workspace_v7() to authenticated;
grant execute on function public.create_workspace_v7(text) to authenticated;
grant execute on function public.invite_workspace_member_by_email(uuid,text,text,text) to authenticated;
grant execute on function public.accept_my_workspace_invitations() to authenticated;
grant execute on function public.replace_workspace_data(uuid,jsonb) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.workspace_sync;
exception when duplicate_object then null;
end $$;
