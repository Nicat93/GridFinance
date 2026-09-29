-- Run only on a disposable Supabase project or a transaction-capable SQL editor.
-- This verifies the intentionally weak sync-ID/header compatibility behavior.
begin;

insert into public.grid_transactions(sync_id, id, data, updated_at, deleted) values
('rls-smoke-a', 'synthetic-a', '{"amount":9}', 1, false),
('rls-smoke-b', 'synthetic-b', '{"amount":17}', 1, false);
insert into public.grid_plans(sync_id, id, data, updated_at, deleted) values
('rls-smoke-a', 'synthetic-plan-a', '{}', 1, false),
('rls-smoke-b', 'synthetic-plan-b', '{}', 1, false);
insert into public.grid_categories(sync_id, id, data, updated_at, deleted) values
('rls-smoke-a', 'synthetic-category-a', '{}', 1, false),
('rls-smoke-b', 'synthetic-category-b', '{}', 1, false);
insert into public.grid_metadata(sync_id, cycle_start_day, updated_at) values
('rls-smoke-a', 1, 1), ('rls-smoke-b', 1, 1);

set local role anon;
select set_config('request.headers', '{"x-gridfinance-sync-id":"rls-smoke-a"}', true);
do $$
begin
  if (select count(*) from public.grid_transactions where sync_id = 'rls-smoke-a') <> 1
     or (select count(*) from public.grid_transactions where sync_id = 'rls-smoke-b') <> 0
     or (select count(*) from public.grid_plans where sync_id = 'rls-smoke-a') <> 1
     or (select count(*) from public.grid_categories where sync_id = 'rls-smoke-a') <> 1
     or (select count(*) from public.grid_metadata where sync_id = 'rls-smoke-a') <> 1 then
    raise exception 'anonymous header partition filter failed';
  end if;
  begin
    insert into public.grid_transactions(sync_id, id, data, updated_at, deleted)
    values ('rls-smoke-b', 'forged-partition', '{}', 2, false);
    raise exception 'write to a mismatched header partition unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
-- A caller can simply guess another ID and change the header. This access is
-- expected by the requested compatibility mode and documents its limitation.
select set_config('request.headers', '{"x-gridfinance-sync-id":"rls-smoke-b"}', true);
do $$
begin
  if (select count(*) from public.grid_transactions where sync_id = 'rls-smoke-b') <> 1 then
    raise exception 'a caller-selected sync ID did not expose its partition';
  end if;
end $$;
rollback;
