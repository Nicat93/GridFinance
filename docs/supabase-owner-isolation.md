# GridFinance Supabase Auth setup

The app uses Supabase Auth for email/password and Google sign-in. Cloud rows are partitioned by `sync_id` within an account and are authorized only by `owner_id = auth.uid()` in RLS. A shared `sync_id` is safe across accounts. The browser contains only the project's public anon/publishable key; do not add a service-role key or Google client secret to the frontend.

## Production rollout

1. In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://nicat93.github.io/GridFinance/` and add that exact URL under **Redirect URLs**.
2. In **Authentication → Providers**, enable Email sign-ups and keep **Confirm email** enabled. For production email confirmation, configure your own SMTP credentials under **Authentication → Emails → SMTP Settings**; Supabase's built-in sender is restricted and best-effort. Enable Google and paste the Web Client ID and Client Secret into Supabase's Google provider settings.
3. In Google Cloud, configure the OAuth consent screen (app name, support email, and developer contact; audience External for general users; while in Testing, add test-user emails). Create a **Web application** OAuth client. Set the authorized JavaScript origin to `https://nicat93.github.io` (origin only, no `/GridFinance/` path). Add this exact URI as an authorized redirect URI: `https://svfcmefotkyphvzhrkfj.supabase.co/auth/v1/callback`. Set only the identity scopes `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`. This callback is Supabase's provider callback; the app then returns to the Site URL.
4. Review `supabase/migrations/20260929000000_owner_scoped_rls.sql`, then run it in the production project's SQL Editor. It deletes rows only from `grid_transactions`, `grid_plans`, `grid_categories`, and `grid_metadata`, then installs mandatory ownership, owner-scoped conflict keys, and RLS. It does not touch unrelated project data.
5. Push the frontend to `main` after the migration and provider settings are ready. GitHub Actions deploys it at `https://nicat93.github.io/GridFinance/`.
6. Open the app and use **Create account**; confirm the email from the message and then **Sign in**. Or choose **Continue with Google**. Once signed in, enable Cloud Sync and choose a sync group ID. On other devices, sign in to the same Auth account and use the same group ID.

The hard-coded project URL identifies project ref `svfcmefotkyphvzhrkfj`. Confirm the current anon/publishable key in **Project Settings → API Keys** if the project has rotated keys. The auth callback URI is derived from that project URL. Do not guess or expose a Google Client Secret; store it only in the Google Cloud OAuth client and Supabase Google provider form.

## Security smoke test

Run `supabase/tests/owner_rls_smoke.sql` only after the migration and only in a disposable Supabase project or a transaction-capable SQL editor. It uses synthetic owner IDs and rolls back. It checks owner access for all synchronized tables, cross-owner read/update/delete isolation, forged-owner rejection, anonymous denial, and independent rows for the same `sync_id` and entity ID. Do not run it in the production SQL editor if that editor does not preserve the transaction and rollback.
