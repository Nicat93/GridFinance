-- GridFinance owner isolation. Existing partition data is kept with a NULL
-- owner_id and remains inaccessible until an administrator safely claims it.
-- Never assign ownership based only on sync_id: it is user supplied, not proof.

create table if not exists public.grid_transactions (
    sync_id text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at bigint not null,
    deleted boolean not null default false
);
create table if not exists public.grid_plans (
    sync_id text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at bigint not null,
    deleted boolean not null default false
);
create table if not exists public.grid_categories (
    sync_id text not null,
    id text not null,
    data jsonb not null default '{}'::jsonb,
    updated_at bigint not null,
    deleted boolean not null default false
);
create table if not exists public.grid_metadata (
    sync_id text not null,
    cycle_start_day integer not null default 1,
    updated_at bigint not null default 0
);

alter table public.grid_transactions add column if not exists owner_id uuid;
alter table public.grid_plans add column if not exists owner_id uuid;
alter table public.grid_categories add column if not exists owner_id uuid;
alter table public.grid_metadata add column if not exists owner_id uuid;

-- Replace legacy global uniqueness with owner-scoped upsert keys. This lets two
-- different authenticated users choose the same sync_id without collisions.
do $$
declare tbl text; con record;
begin
  foreach tbl in array array['grid_transactions','grid_plans','grid_categories','grid_metadata'] loop
    for con in
      select c.conname from pg_constraint c
      where c.conrelid = format('public.%I', tbl)::regclass
        and c.contype in ('p','u')
        and (select array_agg(a.attname::text order by a.attname::text)
             from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any(c.conkey))
            = case when tbl = 'grid_metadata' then array['sync_id']::text[] else array['id','sync_id']::text[] end
    loop
      execute format('alter table public.%I drop constraint %I', tbl, con.conname);
    end loop;
  end loop;
end $$;
create unique index if not exists grid_transactions_owner_sync_id_uidx on public.grid_transactions(owner_id, sync_id, id);
create unique index if not exists grid_plans_owner_sync_id_uidx on public.grid_plans(owner_id, sync_id, id);
create unique index if not exists grid_categories_owner_sync_id_uidx on public.grid_categories(owner_id, sync_id, id);
create unique index if not exists grid_metadata_owner_sync_id_uidx on public.grid_metadata(owner_id, sync_id);

alter table public.grid_transactions enable row level security;
alter table public.grid_plans enable row level security;
alter table public.grid_categories enable row level security;
alter table public.grid_metadata enable row level security;
alter table public.grid_transactions force row level security;
alter table public.grid_plans force row level security;
alter table public.grid_categories force row level security;
alter table public.grid_metadata force row level security;

drop policy if exists grid_transactions_owner_access on public.grid_transactions;
create policy grid_transactions_owner_access on public.grid_transactions
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
drop policy if exists grid_plans_owner_access on public.grid_plans;
create policy grid_plans_owner_access on public.grid_plans
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
drop policy if exists grid_categories_owner_access on public.grid_categories;
create policy grid_categories_owner_access on public.grid_categories
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));
drop policy if exists grid_metadata_owner_access on public.grid_metadata;
create policy grid_metadata_owner_access on public.grid_metadata
    for all to authenticated using (owner_id = (select auth.uid()))
    with check (owner_id = (select auth.uid()));

revoke all on public.grid_transactions, public.grid_plans, public.grid_categories, public.grid_metadata from public, anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.grid_transactions, public.grid_plans, public.grid_categories, public.grid_metadata to authenticated;

comment on column public.grid_transactions.owner_id is 'Supabase Auth user that owns this row; NULL legacy rows are inaccessible under RLS until safely assigned.';
comment on column public.grid_plans.owner_id is 'Supabase Auth user that owns this row; NULL legacy rows are inaccessible under RLS until safely assigned.';
comment on column public.grid_categories.owner_id is 'Supabase Auth user that owns this row; NULL legacy rows are inaccessible under RLS until safely assigned.';
comment on column public.grid_metadata.owner_id is 'Supabase Auth user that owns this row; NULL legacy rows are inaccessible under RLS until safely assigned.';
