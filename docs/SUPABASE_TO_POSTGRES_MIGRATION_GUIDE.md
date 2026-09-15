# Supabase → Plain Postgres (VPS) — Upscale Vintage

Playbook for this store. No secrets in this file.

Public URL: `https://upscalevintage.shop` (`NEXT_PUBLIC_APP_URL`).

## Architecture

```
Browser → Next.js App Router
            ├── middleware: HMAC session cookie `upscale_session`
            ├── Route handlers / server actions
            └── lib/db: pg Pool (DATABASE_URL)

Postgres: store_upscalevintage on fleet-postgres (big-vps)
Uploads: UPLOAD_DIR=/var/www/upscalevintage/uploads → /uploads/
```

| Old (Supabase) | New |
|---|---|
| Hosted Postgres + PostgREST | Independent PostgreSQL `store_upscalevintage` |
| `@supabase/supabase-js` in browser | Server APIs + `lib/client/api.ts` |
| Supabase Auth JWTs | `public.users` + `public.sessions` + `AUTH_SECRET` |
| RLS + `auth.uid()` | Application authorization (`requireStaff` / `requireUser`) |
| Storage buckets | Local disk `UPLOAD_DIR` |
| RPCs | Kept as PostgreSQL functions (`mark_order_paid`, chat, etc.) |

## Environment mapping

| Removed | Replacement |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_APP_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(none — no browser DB key)* |
| `SUPABASE_SERVICE_ROLE_KEY` | `DATABASE_URL` (server only) |
| Storage public URLs | `/uploads/<bucket>/<file>` |
| Implicit JWT | `AUTH_SECRET` (≥ 32 chars) |

VPS secret file (keys only): `/data/fleet/secrets/store_upscalevintage.env`

Runtime `DATABASE_URL` (via PgBouncer, inside Docker):  
`postgres://store_upscalevintage:***@fleet-pgbouncer:6432/store_upscalevintage`

Direct (migrations):  
`postgres://store_upscalevintage:***@fleet-postgres:5432/store_upscalevintage`

## Schema

Migrations in `db/migrations/`:

1. `0001_plain_postgres.sql` — catalog, orders, users, sessions (no `auth.*`)
2. `0002_upscale_rpcs_chat_payments.sql` — chat, contact, payment inbox, RPCs
3. `0003_admin_payments_catalog.sql` — `partially_paid`, variant `sale_price`, default categories, payment RPCs
4. `0004_products_sale_price.sql` — `products.sale_price` for store-wide sales

Applied on `store_upscalevintage` (2026-09-15). 42 public tables.

```bash
npm run db:migrate          # apply pending
npm run db:status
node scripts/create-admin-user.mjs admin@example.com 'YourPassword1'
```

## Data / identity

This repo’s Supabase project ref was a placeholder (`YOUR_PROJECT_ID`). There was no authorized source dump, so the VPS database is an empty target schema. Customer passwords were not imported. New accounts use scrypt (`lib/password.ts`). Existing shoppers must register again or an admin can create accounts.

## Payments

Active gateway in code: **Moolre**. Hubtel and Paystack are not wired in this store.

Callback: `POST /api/payment/moolre/callback`  
Secret accepted from JSON body, query string, or `x-moolre-secret` header.  
Idempotent apply: `record_order_payment(order_ref, moolre_ref, amount)` → inbox `payment_events` + `mark_order_paid` (sets `partially_paid` when the charged amount is below the order total).

SMS: `MOOLRE_SMS_API_KEY` (optional). Email: `RESEND_API_KEY` (optional).

## Deploy (Coolify)

Production app: **upscalevintage-app** (`qfjf1dcflfxxbuacdq0psvjs`), port 3000, nixpacks, branch `main`.

FQDN: `https://upscalevintage.shop`, `https://www.upscalevintage.shop`, `https://upscalevintage.169-58-8-203.sslip.io`

Env (from `/data/fleet/secrets/store_upscalevintage.env`):

- `DATABASE_URL` (PgBouncer)
- `AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL=https://upscalevintage.shop`
- `UPLOAD_DIR=/var/www/upscalevintage/uploads`
- `MOOLRE_CALLBACK_URL=https://upscalevintage.shop/api/payment/moolre/callback`

Uploads volume: host `/data/fleet/uploads/upscalevintage` → `/var/www/upscalevintage/uploads`

```bash
sudo fleet deploy upscalevintage-app
```

Set Moolre live keys (`MOOLRE_API_USER`, `MOOLRE_API_PUBKEY`, `MOOLRE_ACCOUNT_NUMBER`, `MOOLRE_CALLBACK_SECRET`) in Coolify when ready. Dashboard callback URL: `https://upscalevintage.shop/api/payment/moolre/callback`.

## Independence check

Runtime `app/`, `components/`, `context/`, `hooks/`, `lib/` have **no** `@supabase/*` imports. Historical SQL and one-off scripts under `supabase/` and `scripts/apply-rls*.mjs` remain for audit only.

## Verification (this run)

| Check | Status |
|---|---|
| Schema applied on VPS | Pass |
| Grants to `store_upscalevintage` | Pass |
| Runtime Supabase SDK removed | Pass |
| Coolify app running | Pass — `upscalevintage-app` healthy |
| `https://upscalevintage.shop/api/health` | Pass — database up, config ok |
| Source data restore | N/A — no source dump |
