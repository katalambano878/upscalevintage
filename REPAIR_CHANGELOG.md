# Repair changelog — Upscale Vintage Postgres cutover

- Added `lib/db.ts`, session auth (`lib/auth.ts`, `lib/session-token.ts`, `lib/password.ts`), uploads, env checks, client API helper.
- Replaced runtime `@supabase/supabase-js` with server SQL and `/api/*` routes.
- Middleware now checks `upscale_session` HMAC only; roles re-checked in layouts/APIs.
- Storefront, admin, payments, chat, and auth pages no longer import the Supabase SDK.
- Schema: `db/migrations/0001_plain_postgres.sql`, `0002_upscale_rpcs_chat_payments.sql` applied on VPS.
- Payment apply goes through `record_order_payment` + `payment_events`.
- Removed `@supabase/supabase-js` and `supabase` CLI from `package.json`.
- Admin bootstrap script: `scripts/create-admin-user.mjs` (Postgres + scrypt).

Manual: Coolify app creation, DNS, live payment keys, first admin password.
