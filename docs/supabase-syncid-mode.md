# Supabase sync-ID compatibility mode

Apply `supabase/migrations/20260929000000_owner_scoped_rls.sql` in Supabase before deploying this client. The public anon role can read/write rows only when their `sync_id` matches the `x-gridfinance-sync-id` request header. The app sets that header from its existing Sync ID setting. Transactions, plans, categories, metadata, and tombstones use the same policy.

This preserves anonymous and multi-device use without an account. The Sync ID is only a shared partition selector; a caller can send any known or guessed ID and access that partition. It is not authentication and does not meet user/account isolation. No email provider setup is required.

The migration retains the legacy row format and sync-ID upsert keys. If a prior owner-scoped migration was already run, the `owner_id` column remains as an unused compatibility column. Existing rows remain in place and become available through their configured Sync ID; no per-user ownership claim is required.

`supabase/tests/sync_id_partition_smoke.sql` uses synthetic IDs in a rollback transaction to verify that anonymous access works for the ID in the header and mismatched IDs are filtered. Changing the header to another guessed ID is expected to expose that partition in this compatibility mode.
