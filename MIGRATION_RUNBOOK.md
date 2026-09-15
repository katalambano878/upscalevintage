# Migration runbook — Upscale Vintage

## Authoritative targets (staging/VPS)

| Piece | Value |
|---|---|
| Database | `store_upscalevintage` on fleet-postgres |
| App | Coolify app **not created yet** |
| Files | `/var/www/upscalevintage/uploads` |
| Public URL | `https://upscalevintage.shop` |

## Already done

1. Provisioned `store_upscalevintage` (`sudo fleet db provision upscalevintage`).
2. Applied `db/migrations/0001_plain_postgres.sql` and `0002_upscale_rpcs_chat_payments.sql` as postgres superuser.
3. Granted schema privileges to role `store_upscalevintage`.
4. Created upload directory.
5. Stored `AUTH_SECRET` and URL/upload keys in `/data/fleet/secrets/store_upscalevintage.env`.

## Remaining — needs owner / Coolify UI

1. Create Coolify application (nixpacks, port 3000) for this GitHub repo.
2. Attach persistent volume to `UPLOAD_DIR`.
3. Copy env names from the secret file (do not paste secrets into git).
4. `sudo fleet deploy <app-name>`.
5. Create the first admin: `node scripts/create-admin-user.mjs <email> <password>` against `DIRECT_URL`.
6. Point DNS for `upscalevintage.shop` at the VPS when the app is healthy.
7. Set Moolre callback URL to `https://upscalevintage.shop/api/payment/moolre/callback`.

## Rollback

Before any customer writes: drop only an empty `store_upscalevintage` after a confirmed backup, or leave it unused.

After new orders exist: do **not** drop the database. Keep dumps in `/data/fleet/backups`. Switching the app back to Supabase would fork data.

## Abort

Stop if Coolify would overwrite another store’s env, or if `DATABASE_URL` does not point at `store_upscalevintage`.
