# Payments — Upscale Vintage

| Gateway | Status |
|---|---|
| Moolre | Implemented in code (`/api/payment/moolre/*`). Callback verifies shared secret, then `record_order_payment`. Not sandbox-tested this run. |
| Hubtel | Not in this codebase |
| Paystack | Not in this codebase |
| Moolre SMS | Optional env `MOOLRE_SMS_API_KEY` |

Inbox: `payment_events` unique on `(provider, event_key)`. Financial apply is `mark_order_paid` / `record_order_payment`.

Callback must stay public (no login redirect). Configure after Coolify + DNS: `https://upscalevintage.shop/api/payment/moolre/callback`.
