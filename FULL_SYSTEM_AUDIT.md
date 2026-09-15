# Full system audit — Upscale Vintage

## Starting state

Supabase was the only backend. No Coolify app. No `store_*` database until this run.

## Inventories (summary)

**Public:** `/`, shop, categories, product `[slug]`, about, contact, blog, FAQs, checkout, pay `[orderId]`, order-success, auth login/signup, account.

**Admin:** login, dashboard, products, categories, orders, customers, POS, reviews, coupons, blog, notifications, modules, test-sms.

**APIs:** storefront, catalog, orders, addresses, reviews, newsletter, settings, uploads, health, auth, chat, Moolre payment + callback + verify, cron reminders, admin CRUD.

**Database:** 42 public tables after migration (users, sessions, profiles, catalog, orders, CRM, CMS, chat, payment_events).

**Integrations:** Moolre payments (active in code), Moolre SMS (optional), Resend (optional), reCAPTCHA (optional), Groq chat (optional). Hubtel/Paystack: not present.

**Authorization:** session cookie + `profiles.role` in `admin`/`staff`. Public catalog is anonymous.

## Issue ledger

| ID | Severity | Issue | Status |
|---|---|---|---|
| M1 | High | Runtime depended on Supabase Auth/Storage/PostgREST | Fixed in code |
| M2 | High | No VPS database | Fixed — `store_upscalevintage` |
| M3 | High | No Coolify application | Open — owner UI |
| M4 | Medium | No source dump; cannot import live customers | Open — N/A until export exists |
| M5 | Medium | Browser verification not run (no URL) | Open |
| M6 | Low | Historical `scripts/apply-rls*.mjs` still mention Supabase | Left as non-runtime |

## Readiness

`Implemented; verification blocked` — code and empty schema are on the VPS; the web app is not deployed because Coolify cannot create apps from SSH.
