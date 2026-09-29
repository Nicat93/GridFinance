-- Run only in a disposable Supabase project or a transaction-capable SQL editor.
-- Uses synthetic subjects/data and rolls all changes back.
begin;

insert into public.grid_transactions(owner_id, sync_id, id, data, updated_at, deleted) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-shared', 'same-id', '{"amount":17}', 1, false),
('00000000-0000-4000-8000-000000000002', 'rls-smoke-shared', 'same-id', '{"amount":9}', 1, false);
insert into public.grid_plans(owner_id, sync_id, id, data, updated_at, deleted) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-shared', 'same-id', '{}', 1, false),
('00000000-0000-4000-8000-000000000002', 'rls-smoke-shared', 'same-id', '{}', 1, false);
insert into public.grid_categories(owner_id, sync_id, id, data, updated_at, deleted) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-shared', 'same-id', '{}', 1, false),
('00000000-0000-4000-8000-000000000002', 'rls-smoke-shared', 'same-id', '{}', 1, false);
insert into public.grid_metadata(owner_id, sync_id, cycle_start_day, updated_at) values
('00000000-0000-4000-8000-000000000001', 'rls-smoke-shared', 17, 1),
('00000000-0000-4000-8000-000000000002', 'rls-smoke-shared', 9, 1);

-- User A can read each of their own entities, with the shared sync_id and IDs.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
begin
  if (select data->>'amount' from public.grid_transactions where sync_id = 'rls-smoke-shared' and id = 'same-id') <> '17'
     or (select count(*) from public.grid_plans where sync_id = 'rls-smoke-shared') <> 1
     or (select count(*) from public.grid_categories where sync_id = 'rls-smoke-shared') <> 1
     or (select cycle_start_day from public.grid_metadata where sync_id = 'rls-smoke-shared') <> 17 then
    raise exception 'User A could not access their own rows';
  end if;
end $$;
reset role;

-- User B sees only B's rows. Cross-owner update/delete affects zero rows and a
-- forged owner_id insert is rejected by WITH CHECK.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
begin
  if (select data->>'amount' from public.grid_transactions where sync_id = 'rls-smoke-shared' and id = 'same-id') <> '9'
     or (select count(*) from public.grid_plans where sync_id = 'rls-smoke-shared') <> 1
     or (select count(*) from public.grid_categories where sync_id = 'rls-smoke-shared') <> 1
     or (select cycle_start_day from public.grid_metadata where sync_id = 'rls-smoke-shared') <> 9 then
    raise exception 'User B could not access their own rows or shared sync_id collided';
  end if;
end $$;
update public.grid_transactions set data = '{"amount":999}' where owner_id = '00000000-0000-4000-8000-000000000001' and sync_id = 'rls-smoke-shared';
delete from public.grid_transactions where owner_id = '00000000-0000-4000-8000-000000000001' and sync_id = 'rls-smoke-shared';
do $$
begin
  begin
    insert into public.grid_transactions(owner_id, sync_id, id, data, updated_at, deleted)
    values ('00000000-0000-4000-8000-000000000001', 'rls-smoke-forged', 'forged', '{}', 2, false);
    raise exception 'forged owner insert unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- As the SQL editor role, verify B did not alter or delete A's row.
do $$
begin
  if (select data->>'amount' from public.grid_transactions where owner_id = '00000000-0000-4000-8000-000000000001' and sync_id = 'rls-smoke-shared') <> '17' then
    raise exception 'cross-owner update/delete changed User A data';
  end if;
end $$;

-- Anonymous SELECT is hidden or denied, and anonymous writes are denied.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare visible_rows integer;
begin
  begin
    select count(*) into visible_rows from public.grid_transactions where sync_id = 'rls-smoke-shared';
    if visible_rows <> 0 then raise exception 'anonymous role read transactions'; end if;
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into visible_rows from public.grid_plans where sync_id = 'rls-smoke-shared';
    if visible_rows <> 0 then raise exception 'anonymous role read plans'; end if;
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into visible_rows from public.grid_categories where sync_id = 'rls-smoke-shared';
    if visible_rows <> 0 then raise exception 'anonymous role read categories'; end if;
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into visible_rows from public.grid_metadata where sync_id = 'rls-smoke-shared';
    if visible_rows <> 0 then raise exception 'anonymous role read metadata'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.grid_transactions(owner_id, sync_id, id, data, updated_at, deleted)
    values ('00000000-0000-4000-8000-000000000001', 'rls-smoke-anon', 'anon', '{}', 2, false);
    raise exception 'anonymous insert unexpectedly succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
