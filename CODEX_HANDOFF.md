# GridFinance handoff

Read this before making changes to synchronization, persistence, importing, recurring plans, or financial dates. Current code and tests are authoritative if this document is stale.

## Current architecture

- The production app is deployed to GitHub Pages under `/GridFinance/`, and Vite's production base is `/GridFinance/`. The PWA manifest lives at `public/manifest.json`, is emitted as `dist/manifest.json`, and `index.html` references it using Vite's `%BASE_URL%`. In production, its relative start URL and scope resolve to `/GridFinance/`, and its icon resolves to `/GridFinance/icon.svg`. The service worker remains at `/GridFinance/sw.js` and retains its existing update and offline strategy.
- `App.tsx` owns transaction, plan, category, billing-cycle, tombstone, sync configuration, and UI state. Durable local snapshots are reconciled by existing modification timestamps and tombstones, and serialized across tabs with the Web Locks API before storage writes. `storage` events merge incoming snapshots into active tabs without writing unchanged data back. Explicit clear, sync-target reset, and backup overwrite operations advance a local reset marker so stale tabs cannot refill the cleared/replaced snapshot.
- Supabase access and merge behavior live in `services/supabaseService.ts`. Transactions, plans, categories, metadata, and tombstones are partitioned by caller-supplied `sync_id`; the client sends it in `x-gridfinance-sync-id`, and RLS filters to that header value. This is an accepted weak selector, not authentication: anyone who knows or guesses an ID can read and change that partition. The public anon key is not an identity credential. Do not recommend an Auth change unless requirements change.
- `services/supabaseService.ts` reuses one Supabase client for the configured URL/key; repeated service initialization updates the sync-ID header on that client. Auth session persistence, token refresh, and URL session detection are disabled because the app uses anonymous `sync_id` partitioning and no Supabase Auth.
- A sync pulls changed rows, merges against the latest local state, then pushes eligible local changes. Pull uses a five-minute buffer before the shared `lastSyncedAt` watermark. Push uses strict `>` timestamp comparisons, with explicit force-upload IDs for local edits that beat remote deletion tombstones.
- Transaction, plan, and category modifications use `lastModified` instants. Deletes use per-entity timestamp maps: `transactionDeletedIds`, `planDeletedIds`, and `deletedCategoryIds`. Ordinary category tombstones carry the deleted name to prevent category harvesting from recreating it from tags still in history/plans.
- Billing-cycle metadata has its own `cycleStartDayLastModified`; it is pulled independently and pushed independently of transaction/plan edits.
- A single sync runs at a time. A trigger received during it sets a pending flag; completion schedules at most one follow-up. Failed pull/push leaves the watermark unchanged and does not automatically spin in a retry loop.
- Recurring projections and occurrence dates are calculated from the plan anchor and `occurrencesGenerated`. Materialized occurrences use a deterministic ID derived from plan ID and due date.
- Backup import parses and validates the complete payload through `services/backupValidation.ts` before application state changes. Known legacy fields migrate there; invalid later records reject the whole backup.
- A cloud-enabled backup import reconciles the complete backup only inside the selected `sync_id`: imported records receive conflict-winning timestamps, omitted cloud IDs become typed tombstones, categories retain tombstone names, and billing metadata is replaced. Local state changes only after all cloud writes succeed; failed multi-table reconciliation can leave partial remote writes and must be retried.
- Financial dates are date-only `YYYY-MM-DD` calendar values handled by `services/dateOnly.ts`. Timestamps such as `lastModified` remain epoch instants and are not financial dates.

## Implemented behavior

- Failed pull or push does not advance `lastSyncedAt`. A successful sync only advances through just before its start time, leaving same-time and in-flight local edits eligible for another push.
- The sync reads current state after awaiting the pull. A newer local edit survives an older remote row or deletion; a newer remote tombstone removes an older local item. A local edit that beats a tombstone is force-uploaded even if it falls below the prior watermark.
- Sync-enabled Clear Data requires complete configuration and online access, refuses to run during an active sync, tombstones all rows in the selected cloud partition, and resets cloud cycle metadata. Local state clears only after all required cloud writes succeed and the sync target is still the same. Partial cloud writes can happen before a failure; local state remains available for retry.
- Recurring transaction IDs are deterministic across devices for the same plan and due date, so applying the same occurrence converges instead of duplicating it.
- Calculator input is evaluated by a bounded arithmetic parser in `services/safeArithmetic.ts`; expressions are not passed to dynamic JavaScript execution.
- Backup data is fully checked before import mutates state, including IDs, date validity, finite numeric amounts/timestamps, tags, plan fields, and deletion maps. Supported older fields migrate description/name, category/tags, missing creation time, paid state, occurrence count, and saved category names. Missing imported `lastModified` stays missing.
- Financial calendar dates preserve local calendar meaning. Monthly/yearly recurrence clamps short months from the original anchor without cumulative drift. Billing periods start on the configured day, clamp when a month is shorter, and end the day before the next clamped start.
- A record without `lastModified` is checked against its entity table by ID. It uploads with a fresh sync timestamp only if no cloud row has that ID. On collision, the cloud row wins; the un-timestamped import is not allowed to overwrite it. Timestamped local operations at or below the watermark are also checked against cloud timestamps and rebased for upload only when no newer cloud operation exists.
- Ordinary category deletion writes a category-table tombstone. Pulling it removes that category and records its name so tag harvesting does not recreate it. Explicitly re-adding the name through the category manager clears the matching local suppression/tombstone. Clear Data continues to tombstone the category table too.
- Cycle-day changes stamp and upload independent metadata. Older cloud metadata cannot replace a newer local cycle-day change.
- Current balance includes paid transactions only. A paid future-dated transaction retains its scheduled date, affects Current immediately, and displays a paid-early date pill until its scheduled local calendar day.
- Expense transactions and recurring plans may store an optional `approximateUpperAmount`; old records omit it. Projected plan occurrences and unpaid ranged expenses in the selected billing period project as a balance range by subtracting upper amounts for the lower balance and base amounts for the upper balance. The range applies independently to each recurring occurrence. Income is added to both ends. Current balance continues to use only each transaction's base `amount`; ordinary unpaid transactions retain existing projection behavior. The field lives in the existing transaction/plan JSON payloads, so no database migration is needed.
- Recurring period projections binary-search the anchor-based occurrence sequence to begin at the selected period, preserving weekly/monthly/yearly clamping and inclusive end dates without scanning old occurrences.
- Transaction and plan IDs may be equal without their deletion state crossing entity boundaries. Categories have their own tombstone namespace.
- Local snapshot merging retains records with no `lastModified` when no matching tombstone exists. When a tombstone exists, the established timestamp ordering applies; legacy timestamps are not invented during persistence.
- Repeated sync triggers during a running sync collapse into one follow-up; sync operations do not overlap. A failed run does not itself cause an automatic retry loop.
- Online/offline sync event listeners use stable callback references and remove those same references during effect cleanup, preventing stale or duplicate listeners after remount or sync re-enablement.
- Cloud sync works anonymously and preserves the existing sync-ID workflow across devices. The sync ID is deliberately accepted as the access selector, not proof of identity; there is no account-based isolation guarantee.

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
- Backup import is a full restore for the active sync partition; do not clear or mutate another `sync_id`, and do not apply local imported state after a failed cloud reconciliation.
- Paid state controls Current balance; transaction dates remain scheduled calendar dates even when paid early.
- Calculator expressions must never use `eval`, `Function`, or equivalent dynamic execution.
- Do not assign an invented edit instant to a legacy record in a way that lets stale imported data beat a cloud record.
- `sync_id` is not authentication. The current compatibility mode intentionally permits anonymous partition access through the client-supplied header; never describe it as secure isolation or ship service-role credentials.

## Existing regression tests

- `tests/sync-regression.test.mjs` covers pull failure signaling, edit/delete timestamp conflicts, watermark-edge edits, force-upload after tombstones, safe legacy records, category tombstones and Clear Data, independent cycle metadata, entity-separated IDs, and the pending-sync gate.
- `tests/local-state-regression.test.mjs` covers cross-tab reconciliation, reset markers, tombstones, and legacy transaction/plan/category persistence and reload.
- `tests/security-01.test.mjs` covers safe arithmetic, rejection of executable-looking IDs and invalid imported values, whole-backup validation, supported legacy backup migration, and approximate-amount backup compatibility.
- `tests/financial-state-regression.test.mjs`, `tests/local-state-regression.test.mjs`, and `tests/sync-regression.test.mjs` cover approximate projected ranges, recurring occurrences, persistence, and Supabase JSON payload compatibility.
- `tests/date-only-regression.test.mjs` covers date-only parsing/formatting, recurrence month-end clamping, and billing-cycle boundaries.
- `tests/recurring-occurrence.test.mjs` covers deterministic occurrence IDs and convergence to one transaction across devices.
- `tests/pwa-build.test.mjs` checks generated production PWA paths; `tests/sync-listener-cleanup.test.mjs` checks matching online/offline listener registration and cleanup callbacks.
- Latest verification: all 63 tests across the nine regression files passed by running each test file directly with TypeScript `transpileModule` (avoiding test-runner/esbuild child processes); no tests were skipped. `tsc --noEmit` and `git diff --check` passed. `npm run build` was attempted once but Vite could not spawn its esbuild helper (`spawn EPERM`).

## Known limitations and risks

- New local modifications use a logical clock seeded by the current watermark and known local timestamps, so local clock rollback does not strand new operations. Ordering across independent devices still depends on their client clocks.
- Cross-tab write serialization uses the browser Web Locks API. Browsers without Web Locks use merge-before-write and storage-event reconciliation without an atomic cross-tab lock.
- Cloud Clear Data spans multiple requests and is not transactionally atomic. A failed operation may already have tombstoned some tables, and a concurrent cloud writer can recreate data after enumeration/tombstoning. This is an accepted low-probability concurrency limitation.
- Historical `deletedIds` values do not identify whether a transaction or plan was deleted. They are not automatically migrated into typed tombstone maps, since guessing could delete a live row. Existing per-table cloud tombstones still merge by entity.
- An un-timestamped legacy record whose ID already exists remotely is skipped for upload. The cloud wins; local reconciliation depends on a normal pull returning that remote row.
- Sync stores deltas under one per-device watermark and queries by timestamp. Beyond the five-minute pull buffer, clock skew or a delayed write with an old timestamp can be missed. This is an architectural limitation; verify behavior before changing watermarks.
- Category harvesting is name-based because transactions/plans store tag names rather than category IDs. Deletion suppression is also by name; same-name category definitions represent the same harvested label.
- Tailwind CSS is loaded from a CDN and its service-worker caching is best-effort, so offline styling depends on that resource having been cached.

## Guidance for future Codex sessions

- Read this file before relevant work; current code wins if it becomes stale.
- Verify an old audit finding still exists before fixing it. Preserve these invariants unless asked to change them.
- Prefer targeted regression tests. Run relevant tests, `npm run build`, and `git diff --check`.
- Avoid broad or unrelated refactors. Do not commit or push unless requested.
- Update this handoff when work materially changes architecture, sync, financial-date, persistence, security behavior, or known limitations.
