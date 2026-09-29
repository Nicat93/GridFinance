-- Clean-reset GridFinance cloud data, then enable Auth-owned rows.
-- This only clears the four GridFinance tables; it does not touch other project data.

create table if not exists public.grid_transactions (
    sync_id text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at bigint not null,
    deleted boolean not null default false,
    owner_id uuid not null
);
create table if not exists public.grid_plans (
    sync_id text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at bigint not null,
    deleted boolean not null default false,
    owner_id uuid not null
);
create table if not exists public.grid_categories (
    sync_id text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at bigint not null,
    deleted boolean not null default false,
    owner_id uuid not null
);
create table if not exists public.grid_metadata (
    sync_id text not null,
    cycle_start_day integer not null default 1,
    updated_at bigint not null default 0,
    owner_id uuid not null
);

alter table public.grid_transactions add column if not exists owner_id uuid;
alter table public.grid_plans add column if not exists owner_id uuid;
alter table public.grid_categories add column if not exists owner_id uuid;
alter table public.grid_metadata add column if not exists owner_id uuid;

-- All old GridFinance cloud rows are disposable. Clear only these app tables
-- before making owner_id mandatory and replacing old global conflict keys.
truncate table public.grid_transactions, public.grid_plans, public.grid_categories, public.grid_metadata;

do $$
declare tbl text; con record; idx record;
begin
  foreach tbl in array array['grid_transactions','grid_plans','grid_categories','grid_metadata'] loop
    execute format('alter table public.%I alter column owner_id set not null', tbl);
    for con in
      select conname from pg_constraint
      where conrelid = format('public.%I', tbl)::regclass and contype in ('p','u')
    loop
      execute format('alter table public.%I drop constraint %I', tbl, con.conname);
    end loop;
    for idx in
      select indexrelid::regclass as name
      from pg_index where indrelid = format('public.%I', tbl)::regclass
        and indisunique and not indisprimary
    loop
      execute format('drop index %s', idx.name);
    end loop;
  end loop;
end $$;

create unique index grid_transactions_owner_sync_id_uidx on public.grid_transactions(owner_id, sync_id, id);
create unique index grid_plans_owner_sync_id_uidx on public.grid_plans(owner_id, sync_id, id);
create unique index grid_categories_owner_sync_id_uidx on public.grid_categories(owner_id, sync_id, id);
create unique index grid_metadata_owner_sync_id_uidx on public.grid_metadata(owner_id, sync_id);

alter table public.grid_transactions enable row level security;
alter table public.grid_plans enable row level security;
alter table public.grid_categories enable row level security;
alter table public.grid_metadata enable row level security;
alter table public.grid_transactions force row level security;
alter table public.grid_plans force row level security;
alter table public.grid_categories force row level security;
alter table public.grid_metadata force row level security;

-- Remove every pre-existing policy so no permissive policy can OR around the
-- owner checks below.
do $$
declare tbl text; pol record;
begin
  foreach tbl in array array['grid_transactions','grid_plans','grid_categories','grid_metadata'] loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
      execute format('drop policy %I on public.%I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

create policy grid_transactions_owner_access on public.grid_transactions
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
create policy grid_plans_owner_access on public.grid_plans
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
create policy grid_categories_owner_access on public.grid_categories
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
create policy grid_metadata_owner_access on public.grid_metadata
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

revoke all on public.grid_transactions, public.grid_plans, public.grid_categories, public.grid_metadata from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.grid_transactions, public.grid_plans, public.grid_categories, public.grid_metadata to authenticated;

comment on column public.grid_transactions.owner_id is 'Supabase Auth user that owns this row; enforced by RLS.';
comment on column public.grid_plans.owner_id is 'Supabase Auth user that owns this row; enforced by RLS.';
comment on column public.grid_categories.owner_id is 'Supabase Auth user that owns this row; enforced by RLS.';
comment on column public.grid_metadata.owner_id is 'Supabase Auth user that owns this row; enforced by RLS.';
