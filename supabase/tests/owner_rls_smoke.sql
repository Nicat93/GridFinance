-- Run only on a disposable Supabase project or inside a transaction in the SQL
-- editor. Every inserted record uses synthetic UUIDs and this script rolls back.
begin;

insert into public.grid_transactions(owner_id, sync_id, id, data, updated_at, deleted) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-b', 'synthetic-tx', '{"amount":17}', 1, false),
('00000000-0000-4000-8000-000000000002', 'rls-smoke-a', 'synthetic-own-tx', '{"amount":9}', 1, false);
insert into public.grid_plans(owner_id, sync_id, id, data, updated_at, deleted) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-b', 'synthetic-plan', '{}', 1, false);
insert into public.grid_categories(owner_id, sync_id, id, data, updated_at, deleted) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-b', 'synthetic-category', '{}', 1, false);
insert into public.grid_metadata(owner_id, sync_id, cycle_start_day, updated_at) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-b', 1, 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.grid_transactions where sync_id = 'rls-smoke-b' and id = 'synthetic-tx') <> 1 then
    raise exception 'authenticated owner could not read own transaction';
  end if;
  if (select count(*) from public.grid_transactions where sync_id = 'rls-smoke-a') <> 0 then
    raise exception 'authenticated owner read another owner partition';
  end if;
  if (select count(*) from public.grid_plans where sync_id = 'rls-smoke-b') <> 1
     or (select count(*) from public.grid_categories where sync_id = 'rls-smoke-b') <> 1
     or (select count(*) from public.grid_metadata where sync_id = 'rls-smoke-b') <> 1 then
    raise exception 'owner access failed for plans, categories, or metadata';
  end if;
end $$;
-- A caller may name someone else's partition; RLS should make the target
-- invisible to update/delete. Forging owner_id on insert must raise 42501.
update public.grid_transactions set data = '{"amount":999}' where sync_id = 'rls-smoke-a';
delete from public.grid_transactions where sync_id = 'rls-smoke-a';
do $$
begin
  begin
    insert into public.grid_transactions(owner_id, sync_id, id, data, updated_at, deleted)
    values ('00000000-0000-4000-8000-000000000002', 'rls-smoke-forged', 'forged', '{}', 2, false);
    raise exception 'forged owner insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if (select data->>'amount' from public.grid_transactions where owner_id = '00000000-0000-4000-8000-000000000002' and sync_id = 'rls-smoke-a') <> '9' then
    raise exception 'cross-owner update/delete changed another owner row';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare visible_rows integer;
begin
  begin select count(*) into visible_rows from public.grid_transactions where sync_id = 'rls-smoke-b';
    if visible_rows <> 0 then raise exception 'anonymous role accessed transactions'; end if;
  exception when insufficient_privilege then null; end;
  begin select count(*) into visible_rows from public.grid_plans where sync_id = 'rls-smoke-b';
    if visible_rows <> 0 then raise exception 'anonymous role accessed plans'; end if;
  exception when insufficient_privilege then null; end;
  begin select count(*) into visible_rows from public.grid_categories where sync_id = 'rls-smoke-b';
    if visible_rows <> 0 then raise exception 'anonymous role accessed categories'; end if;
  exception when insufficient_privilege then null; end;
  begin select count(*) into visible_rows from public.grid_metadata where sync_id = 'rls-smoke-b';
    if visible_rows <> 0 then raise exception 'anonymous role accessed metadata'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.grid_transactions(owner_id, sync_id, id, data, updated_at, deleted)
    values ('00000000-0000-4000-8000-000000000001', 'rls-smoke-anon', 'anon', '{}', 2, false);
    raise exception 'anonymous insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
