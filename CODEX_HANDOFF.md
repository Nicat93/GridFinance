# GridFinance handoff

Read this before making changes to synchronization, persistence, importing, recurring plans, or financial dates. Current code and tests are authoritative if this document is stale.

## Current architecture

- `App.tsx` owns transaction, plan, category, billing-cycle, tombstone, sync configuration, and UI state. Most durable state is mirrored to `localStorage` by effects.
- Supabase access and merge behavior live in `services/supabaseService.ts`. Authenticated rows are owned by the Supabase Auth `owner_id` and partitioned within that account by `sync_id`; transactions, plans, categories, metadata, and tombstones are protected by RLS. The public anon key is not an identity credential.
- A sync pulls changed rows, merges against the latest local state, then pushes eligible local changes. Pull uses a five-minute buffer before the shared `lastSyncedAt` watermark. Push uses strict `>` timestamp comparisons, with explicit force-upload IDs for local edits that beat remote deletion tombstones.
- Transaction, plan, and category modifications use `lastModified` instants. Deletes use per-entity timestamp maps: `transactionDeletedIds`, `planDeletedIds`, and `deletedCategoryIds`. Ordinary category tombstones carry the deleted name to prevent category harvesting from recreating it from tags still in history/plans.
- Billing-cycle metadata has its own `cycleStartDayLastModified`; it is pulled independently and pushed independently of transaction/plan edits.
- A single sync runs at a time. A trigger received during it sets a pending flag; completion schedules at most one follow-up. Failed pull/push leaves the watermark unchanged and does not automatically spin in a retry loop.
- Recurring projections and occurrence dates are calculated from the plan anchor and `occurrencesGenerated`. Materialized occurrences use a deterministic ID derived from plan ID and due date.
- Backup import parses and validates the complete payload through `services/backupValidation.ts` before application state changes. Known legacy fields migrate there; invalid later records reject the whole backup.
- Financial dates are date-only `YYYY-MM-DD` calendar values handled by `services/dateOnly.ts`. Timestamps such as `lastModified` remain epoch instants and are not financial dates.

## Implemented behavior

- Failed pull or push does not advance `lastSyncedAt`. A successful sync only advances through just before its start time, leaving same-time and in-flight local edits eligible for another push.
- The sync reads current state after awaiting the pull. A newer local edit survives an older remote row or deletion; a newer remote tombstone removes an older local item. A local edit that beats a tombstone is force-uploaded even if it falls below the prior watermark.
- Sync-enabled Clear Data requires complete configuration and online access, refuses to run during an active sync, tombstones all rows in the selected cloud partition, and resets cloud cycle metadata. Local state clears only after all required cloud writes succeed and the sync target is still the same. Partial cloud writes can happen before a failure; local state remains available for retry.
- Recurring transaction IDs are deterministic across devices for the same plan and due date, so applying the same occurrence converges instead of duplicating it.
- Calculator input is evaluated by a bounded arithmetic parser in `services/safeArithmetic.ts`; expressions are not passed to dynamic JavaScript execution.
- Backup data is fully checked before import mutates state, including IDs, date validity, finite numeric amounts/timestamps, tags, plan fields, and deletion maps. Supported older fields migrate description/name, category/tags, missing creation time, paid state, occurrence count, and saved category names. Missing imported `lastModified` stays missing.
- Financial calendar dates preserve local calendar meaning. Monthly/yearly recurrence clamps short months from the original anchor without cumulative drift. Billing periods start on the configured day, clamp when a month is shorter, and end the day before the next clamped start.
- A record without `lastModified` is checked against its entity table by ID. It uploads with a fresh sync timestamp only if no cloud row has that ID. On collision, the cloud row wins; the un-timestamped import is not allowed to overwrite it.
- Ordinary category deletion writes a category-table tombstone. Pulling it removes that category and records its name so tag harvesting does not recreate it. Explicitly re-adding the name through the category manager clears the matching local suppression/tombstone. Clear Data continues to tombstone the category table too.
- Cycle-day changes stamp and upload independent metadata. Older cloud metadata cannot replace a newer local cycle-day change.
- Transaction and plan IDs may be equal without their deletion state crossing entity boundaries. Categories have their own tombstone namespace.
- Repeated sync triggers during a running sync collapse into one follow-up; sync operations do not overlap. A failed run does not itself cause an automatic retry loop.
- Cloud sync requires Supabase email/password authentication. All row writes include the current Auth user ID, while backend RLS independently checks `owner_id = auth.uid()` and prevents anonymous access. Same-user devices share the Auth account and sync group ID.
- The owner-isolation migration retains pre-auth rows with NULL `owner_id`, which RLS hides. An administrator must assign legacy partitions to verified Auth accounts after identity verification; `sync_id` alone is never sufficient proof.

## Important invariants

- Financial dates are `YYYY-MM-DD` calendar dates; sync timestamps are time instants.
- Do not advance the sync watermark after a failed pull or push, or past local edits that may have occurred during the run.
- Recurring occurrences for one plan/date must retain deterministic cross-device identity.
- Transaction, plan, and category deletion namespaces stay separate.
- Edit-versus-delete resolution stays timestamp-aware; a newer edit beats an older tombstone and vice versa.
- Sync-enabled Clear Data must not clear local state until required cloud operations succeed and the target is unchanged.
- Billing-cycle metadata synchronizes independently and uses its own modification timestamp.
- Never run overlapping syncs; coalesce active-run triggers into one follow-up.
- Validate a complete backup before applying any imported state.
- Calculator expressions must never use `eval`, `Function`, or equivalent dynamic execution.
- Do not assign an invented edit instant to a legacy record in a way that lets stale imported data beat a cloud record.
- Never use a client-provided `sync_id` as authentication. Supabase data access must stay behind owner-scoped RLS; never ship service-role credentials.

## Existing regression tests

- `tests/sync-regression.test.mjs` covers pull failure signaling, edit/delete timestamp conflicts, watermark-edge edits, force-upload after tombstones, safe legacy records, category tombstones and Clear Data, independent cycle metadata, entity-separated IDs, and the pending-sync gate.
- `tests/security-01.test.mjs` covers safe arithmetic, rejection of executable-looking IDs and invalid imported values, whole-backup validation, and supported legacy backup migration.
- `tests/date-only-regression.test.mjs` covers date-only parsing/formatting, recurrence month-end clamping, and billing-cycle boundaries.
- `tests/recurring-occurrence.test.mjs` covers deterministic occurrence IDs and convergence to one transaction across devices.

## Known limitations and risks

- Last-write-wins ordering depends on client clocks; skewed clocks can produce incorrect ordering.
- Cloud Clear Data spans multiple requests and is not transactionally atomic. A failed operation may already have tombstoned some tables, and another device can theoretically write during clearing.
- Historical `deletedIds` values do not identify whether a transaction or plan was deleted. They are not automatically migrated into typed tombstone maps, since guessing could delete a live row. Existing per-table cloud tombstones still merge by entity.
- An un-timestamped legacy record whose ID already exists remotely is skipped for upload. The cloud wins; local reconciliation depends on a normal pull returning that remote row.
- Sync stores deltas under one per-device watermark and queries by timestamp. Beyond the five-minute pull buffer, clock skew or a delayed write with an old timestamp can be missed. This is an architectural limitation; verify behavior before changing watermarks.
- Category harvesting is name-based because transactions/plans store tag names rather than category IDs. Deletion suppression is also by name; same-name category definitions represent the same harvested label.
- Clear Data cannot prevent a concurrent remote writer from recreating data after its table has been enumerated or tombstoned.

## Guidance for future Codex sessions

- Read this file before relevant work; current code wins if it becomes stale.
- Verify an old audit finding still exists before fixing it. Preserve these invariants unless asked to change them.
- Prefer targeted regression tests. Run relevant tests, `npm run build`, and `git diff --check`.
- Avoid broad or unrelated refactors. Do not commit or push unless requested.
- Update this handoff when work materially changes architecture, sync, financial-date, persistence, security behavior, or known limitations.
