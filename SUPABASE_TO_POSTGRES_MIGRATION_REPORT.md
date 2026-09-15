# Capability matrix — Upscale Vintage

| Supabase capability | Used? | Replacement | Residual? |
|---|---|---|---|
| Hosted Postgres | Yes | `store_upscalevintage` | No |
| Browser client | Yes | `/api/*` + `lib/client/api.ts` | No |
| Auth | Yes | users/sessions + cookie | No |
| RLS | Yes | App-layer `requireStaff`/`requireUser` | No |
| Storage | Yes | `UPLOAD_DIR` disk | No |
| Realtime | No | — | No |
| RPC | Yes | PostgreSQL functions | No |
| Edge Functions | No | Next route handlers | No |

Independence: no `@supabase/*` in runtime TypeScript. Historical `supabase/` migrations kept.

Source data: not imported (placeholder project, no dump). Target is empty schema.

See `docs/SUPABASE_TO_POSTGRES_MIGRATION_GUIDE.md`.
