-- Nomad Wealth Global v6
-- Run this entire file once in Supabase Dashboard → SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.finance_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_personal boolean not null default false,
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table if not exists public.workspace_state (
  workspace_id uuid primary key references public.finance_workspaces(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.finance_workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_state enable row level security;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=(select auth.uid())); $$;

drop policy if exists "Members can read workspaces" on public.finance_workspaces;
create policy "Members can read workspaces" on public.finance_workspaces
for select to authenticated using (public.is_workspace_member(id));

drop policy if exists "Owners can update workspaces" on public.finance_workspaces;
create policy "Owners can update workspaces" on public.finance_workspaces
for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));

drop policy if exists "Members can read memberships" on public.workspace_members;
create policy "Members can read memberships" on public.workspace_members
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can read workspace state" on public.workspace_state;
create policy "Members can read workspace state" on public.workspace_state
for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "Members can insert workspace state" on public.workspace_state;
create policy "Members can insert workspace state" on public.workspace_state
for insert to authenticated with check (public.is_workspace_member(workspace_id) and updated_by=(select auth.uid()));

drop policy if exists "Members can update workspace state" on public.workspace_state;
create policy "Members can update workspace state" on public.workspace_state
for update to authenticated using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id) and updated_by=(select auth.uid()));

create or replace function public.ensure_personal_workspace()
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_workspace uuid;
begin
  select id into v_workspace from public.finance_workspaces
  where owner_id=(select auth.uid()) and is_personal=true limit 1;
  if v_workspace is null then
    insert into public.finance_workspaces(owner_id,name,is_personal)
    values((select auth.uid()),'Personal finances',true) returning id into v_workspace;
    insert into public.workspace_members(workspace_id,user_id,role)
    values(v_workspace,(select auth.uid()),'owner') on conflict do nothing;
    insert into public.workspace_state(workspace_id,data,updated_by)
    values(v_workspace,'{}'::jsonb,(select auth.uid())) on conflict do nothing;
  end if;
  return v_workspace;
end; $$;

create or replace function public.create_shared_workspace(p_name text)
returns table(workspace_id uuid, invite_code text)
language plpgsql security definer set search_path=public
as $$
declare v_workspace uuid; v_code text;
begin
  insert into public.finance_workspaces(owner_id,name,is_personal)
  values((select auth.uid()),trim(p_name),false)
  returning id,finance_workspaces.invite_code into v_workspace,v_code;
  insert into public.workspace_members(workspace_id,user_id,role)
  values(v_workspace,(select auth.uid()),'owner');
  insert into public.workspace_state(workspace_id,data,updated_by)
  values(v_workspace,'{}'::jsonb,(select auth.uid()));
  return query select v_workspace,v_code;
end; $$;

create or replace function public.join_workspace_by_code(p_code text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_workspace uuid;
begin
  select id into v_workspace from public.finance_workspaces
  where upper(invite_code)=upper(trim(p_code)) and is_personal=false;
  if v_workspace is null then raise exception 'Invalid invite code'; end if;
  insert into public.workspace_members(workspace_id,user_id,role)
  values(v_workspace,(select auth.uid()),'member') on conflict do nothing;
  return v_workspace;
end; $$;

grant execute on function public.ensure_personal_workspace() to authenticated;
grant execute on function public.create_shared_workspace(text) to authenticated;
grant execute on function public.join_workspace_by_code(text) to authenticated;

-- Enable Realtime for workspace state. Ignore the duplicate-object message if already enabled.
do $$ begin
  alter publication supabase_realtime add table public.workspace_state;
exception when duplicate_object then null;
end $$;
