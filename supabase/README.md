# Database migrations

SQL migrations for your Supabase project.

## Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Set `YOUR_PROJECT_ID` in `.env.local` and `package.json` scripts
3. Run migrations via Supabase CLI or SQL editor

## Commands

```bash
npm run supabase:link
npm run supabase:push
```

See [CUSTOMIZE.md](../CUSTOMIZE.md) for full setup.

## AI Chat Assistant migration

`20260528180000_ai_chat_memory_and_kb.sql` adds the four tables and three RPCs
that power the in-app AI chat (`/api/chat`):

| Table                     | Purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `chat_conversations`      | Rolling per-session transcript + sentiment/category/intent |
| `ai_memory`               | Durable customer-specific facts the AI recalls next time   |
| `customer_insights`       | Aggregate signals (total chats, last seen) per customer    |
| `support_knowledge_base`  | Admin-curated FAQ surfaced in AI answers                   |

| RPC                          | Caller                          |
| ---------------------------- | ------------------------------- |
| `upsert_chat_conversation`   | Saves each turn of the chat     |
| `get_ai_memories`            | Pulls top memories into prompt  |
| `upsert_customer_insight`    | Bumps total_chats / last seen   |

Apply it with `npm run supabase:push` (or paste the SQL into the dashboard's
SQL editor). The chat assistant degrades gracefully if the migration hasn't
been run yet — persistence is silently skipped instead of erroring.
