# Supabase owner isolation rollout

Apply `supabase/migrations/20260929000000_owner_scoped_rls.sql` in the Supabase SQL editor (or through the project's migration runner) before distributing the new client. It installs `owner_id`, owner-scoped conflict keys, RLS for transactions, plans, categories, metadata, and their tombstones, and removes direct `anon` table grants. Authenticated clients can use only rows whose owner matches `auth.uid()`.

## Existing synchronized data

The migration preserves every existing row and leaves its `owner_id` NULL. RLS intentionally hides those rows until they are claimed. Do not claim by `sync_id` alone: the old app treated that user-entered value as a secret, so knowing it proves no ownership.

For each existing customer, verify their identity through a trusted channel, have them create/sign in to the intended Supabase Auth account, then have a project administrator assign that account's UUID to the verified old partition in all four tables. Example for one verified account (replace both literals only after verification):

```sql
begin;
update public.grid_transactions set owner_id = 'AUTH-USER-UUID' where sync_id = 'VERIFIED-OLD-SYNC-ID' and owner_id is null;
update public.grid_plans set owner_id = 'AUTH-USER-UUID' where sync_id = 'VERIFIED-OLD-SYNC-ID' and owner_id is null;
update public.grid_categories set owner_id = 'AUTH-USER-UUID' where sync_id = 'VERIFIED-OLD-SYNC-ID' and owner_id is null;
update public.grid_metadata set owner_id = 'AUTH-USER-UUID' where sync_id = 'VERIFIED-OLD-SYNC-ID' and owner_id is null;
commit;
```

Do not assign a partition with existing non-NULL ownership to a different account. If ownership cannot be established, keep the rows unclaimed and recover them through an authorized backup/account recovery process. After verified assignments, users sign into the app and keep their existing sync group ID; other devices sign into the same Auth account and group ID.

## Synthetic security check

Run `supabase/tests/owner_rls_smoke.sql` only in a disposable Supabase project or a transaction-capable SQL editor. It seeds synthetic rows for two synthetic Auth subjects, checks owner access and forged-owner denial, checks anonymous denial, and rolls back. No production/customer records or credentials are needed.

Dashboard setup: enable the Email provider under **Authentication → Providers**. Choose whether email confirmation is required and configure the site's allowed redirect URLs/email delivery as appropriate. No service-role key is used by the app. The bundled anon key is expected to remain public because RLS is the access boundary.
