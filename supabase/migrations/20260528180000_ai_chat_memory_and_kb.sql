-- ============================================================================
-- AI CHAT — memory, conversation history, customer insights & knowledge base
--
-- Powers the in-app chat assistant (see /app/api/chat/route.ts):
--   * chat_conversations       — rolling per-session transcript + analytics
--   * ai_memory                — durable facts the AI remembers across chats
--   * customer_insights        — aggregate per-customer signals
--   * support_knowledge_base   — admin-curated articles surfaced in answers
--
-- Plus three SECURITY DEFINER RPCs the route calls:
--   * upsert_chat_conversation
--   * get_ai_memories
--   * upsert_customer_insight
--
-- All writes happen via the service-role key in API routes, so policies only
-- need to expose reads to staff (plus public read on published KB articles).
-- ============================================================================

-- ─── 1. chat_conversations ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  session_id        text NOT NULL UNIQUE,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  messages          jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment         text CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  category          text,
  intent            text,
  summary           text,
  message_count     integer NOT NULL DEFAULT 0,
  customer_email    text,
  customer_name     text,
  is_resolved       boolean NOT NULL DEFAULT false,
  is_escalated      boolean NOT NULL DEFAULT false,
  escalated_at      timestamptz,
  page_context      text,
  duration_seconds  integer,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_session ON public.chat_conversations USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user    ON public.chat_conversations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_email   ON public.chat_conversations USING btree (customer_email);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created ON public.chat_conversations USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_escalated ON public.chat_conversations USING btree (is_escalated) WHERE is_escalated = true;

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own chat conversations" ON public.chat_conversations;
CREATE POLICY "Users view own chat conversations"
  ON public.chat_conversations FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff manage chat conversations" ON public.chat_conversations;
CREATE POLICY "Staff manage chat conversations"
  ON public.chat_conversations FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ─── 2. ai_memory ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id                       uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  customer_id              uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email           text,
  memory_type              text NOT NULL DEFAULT 'note'
                            CHECK (memory_type IN ('preference', 'issue', 'fact', 'note', 'feedback')),
  content                  text NOT NULL,
  importance               text NOT NULL DEFAULT 'normal'
                            CHECK (importance IN ('low', 'normal', 'high')),
  source_conversation_id   uuid REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_id IS NOT NULL OR customer_email IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_ai_memory_customer       ON public.ai_memory USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_email          ON public.ai_memory USING btree (customer_email);
CREATE INDEX IF NOT EXISTS idx_ai_memory_importance     ON public.ai_memory USING btree (importance);
CREATE INDEX IF NOT EXISTS idx_ai_memory_created        ON public.ai_memory USING btree (created_at DESC);

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own memories" ON public.ai_memory;
CREATE POLICY "Users view own memories"
  ON public.ai_memory FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff manage ai memory" ON public.ai_memory;
CREATE POLICY "Staff manage ai memory"
  ON public.ai_memory FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ─── 3. customer_insights ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_insights (
  id              uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  customer_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email  text,
  customer_name   text,
  total_chats     integer NOT NULL DEFAULT 0,
  last_chat_at    timestamptz,
  tags            text[] NOT NULL DEFAULT '{}',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_id IS NOT NULL OR customer_email IS NOT NULL)
);

-- Each customer should have at most one insights row. We can't rely on a
-- single UNIQUE column (either id or email may be null), so we use two
-- partial-unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_insights_customer_id
  ON public.customer_insights (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_insights_email
  ON public.customer_insights (customer_email)
  WHERE customer_id IS NULL AND customer_email IS NOT NULL;

DROP TRIGGER IF EXISTS update_customer_insights_updated_at ON public.customer_insights;
CREATE TRIGGER update_customer_insights_updated_at
  BEFORE UPDATE ON public.customer_insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.customer_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own insights" ON public.customer_insights;
CREATE POLICY "Users view own insights"
  ON public.customer_insights FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff manage customer insights" ON public.customer_insights;
CREATE POLICY "Staff manage customer insights"
  ON public.customer_insights FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ─── 4. support_knowledge_base ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_knowledge_base (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  title         text NOT NULL,
  slug          text UNIQUE,
  content       text NOT NULL,
  category      text,
  tags          text[] NOT NULL DEFAULT '{}',
  is_published  boolean NOT NULL DEFAULT true,
  views_count   integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_kb_published ON public.support_knowledge_base USING btree (is_published);
CREATE INDEX IF NOT EXISTS idx_support_kb_category  ON public.support_knowledge_base USING btree (category);
CREATE INDEX IF NOT EXISTS idx_support_kb_tags      ON public.support_knowledge_base USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_support_kb_title_trgm
  ON public.support_knowledge_base USING gin (title gin_trgm_ops)
  WHERE is_published = true;

-- gin_trgm_ops requires the pg_trgm extension. Enable if absent.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS update_support_kb_updated_at ON public.support_knowledge_base;
CREATE TRIGGER update_support_kb_updated_at
  BEFORE UPDATE ON public.support_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.support_knowledge_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published KB" ON public.support_knowledge_base;
CREATE POLICY "Public read published KB"
  ON public.support_knowledge_base FOR SELECT
  USING (is_published = true OR is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage KB" ON public.support_knowledge_base;
CREATE POLICY "Staff manage KB"
  ON public.support_knowledge_base FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- ─── 5. RPCs called by /api/chat ───────────────────────────────────────────

-- 5a. upsert_chat_conversation(p_session_id, p_user_id, p_messages, p_metadata)
--     Used after every assistant reply to keep the rolling transcript in sync.
CREATE OR REPLACE FUNCTION public.upsert_chat_conversation(
  p_session_id text,
  p_user_id    uuid,
  p_messages   jsonb,
  p_metadata   jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.chat_conversations (session_id, user_id, messages, metadata, message_count)
  VALUES (
    p_session_id,
    p_user_id,
    COALESCE(p_messages, '[]'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(jsonb_array_length(p_messages), 0)
  )
  ON CONFLICT (session_id) DO UPDATE
  SET
    user_id       = COALESCE(EXCLUDED.user_id, public.chat_conversations.user_id),
    messages      = EXCLUDED.messages,
    metadata      = public.chat_conversations.metadata || EXCLUDED.metadata,
    message_count = EXCLUDED.message_count,
    updated_at    = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5b. get_ai_memories(p_customer_id, p_customer_email)
--     Returns memories ordered importance DESC, recency DESC. The chat route
--     reads the top 10 to include in the LLM context.
CREATE OR REPLACE FUNCTION public.get_ai_memories(
  p_customer_id    uuid,
  p_customer_email text
)
RETURNS TABLE (
  id          uuid,
  type        text,
  content     text,
  importance  text,
  created_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.memory_type AS type,
    m.content,
    m.importance,
    m.created_at
  FROM public.ai_memory m
  WHERE (p_customer_id IS NOT NULL AND m.customer_id = p_customer_id)
     OR (p_customer_id IS NULL AND p_customer_email IS NOT NULL AND lower(m.customer_email) = lower(p_customer_email))
  ORDER BY
    CASE m.importance WHEN 'high' THEN 0 WHEN 'normal' THEN 1 WHEN 'low' THEN 2 ELSE 3 END,
    m.created_at DESC
  LIMIT 25;
END;
$$;

-- 5c. upsert_customer_insight(p_customer_id, p_customer_email, p_customer_name)
--     Increments total_chats and refreshes last_chat_at after each
--     conversation, creating the row on first contact.
CREATE OR REPLACE FUNCTION public.upsert_customer_insight(
  p_customer_id    uuid,
  p_customer_email text,
  p_customer_name  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_customer_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.customer_insights WHERE customer_id = p_customer_id LIMIT 1;
  ELSIF p_customer_email IS NOT NULL THEN
    SELECT id INTO v_id FROM public.customer_insights WHERE customer_email = p_customer_email LIMIT 1;
  ELSE
    -- Nothing to identify the customer by — skip silently.
    RETURN NULL;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.customer_insights (customer_id, customer_email, customer_name, total_chats, last_chat_at)
    VALUES (p_customer_id, p_customer_email, p_customer_name, 1, now())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.customer_insights
    SET total_chats   = total_chats + 1,
        last_chat_at  = now(),
        customer_name = COALESCE(NULLIF(p_customer_name, ''), customer_name),
        customer_email = COALESCE(NULLIF(p_customer_email, ''), customer_email),
        customer_id    = COALESCE(p_customer_id, customer_id),
        updated_at     = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ─── 5d. Lock down RPCs to the service-role key only ──────────────────────
-- These three RPCs are only ever called from /api/chat with the service-role
-- key (supabaseAdmin). Revoke EXECUTE from anon / authenticated so they are
-- not reachable over /rest/v1/rpc by clients.

REVOKE EXECUTE ON FUNCTION public.upsert_chat_conversation(text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_ai_memories(uuid, text)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_insight(uuid, text, text)          FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_chat_conversation(text, uuid, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_memories(uuid, text)                        TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_customer_insight(uuid, text, text)          TO service_role;

-- ─── 6. Default knowledge base articles ────────────────────────────────────
-- A handful of seed answers so the AI has something useful to surface from
-- day one. Admins can edit / extend these later via the admin panel.

INSERT INTO public.support_knowledge_base (title, slug, content, category, tags, is_published)
VALUES
  (
    'How do I track my order?',
    'how-to-track-order',
    'You can track your order from /order-tracking using your order number (e.g. ORD-XXXX) and the email used at checkout. Logged-in customers can also see all orders under /account. If you cannot find your order, contact us via WhatsApp or email and our team will assist.',
    'orders',
    ARRAY['track','order','tracking','status'],
    true
  ),
  (
    'What payment methods do you accept?',
    'payment-methods',
    'We accept secure Mobile Money (MoMo) checkout via Moolre in Ghana Cedis (GHS). Guest checkout is supported — no account needed. After placing an order in chat or on the website, you will receive a secure Moolre payment link.',
    'payment',
    ARRAY['pay','payment','momo','mobile money','moolre','checkout'],
    true
  ),
  (
    'Shipping & delivery times',
    'shipping-delivery-times',
    'We deliver across Ghana. Standard delivery is typically 1-3 business days within Accra and 3-7 days outside Accra. Express options are available in Accra for faster delivery. Final fees and timing are confirmed at checkout based on your region.',
    'shipping',
    ARRAY['shipping','delivery','dispatch','timeline','express'],
    true
  ),
  (
    'Returns, refunds & exchanges',
    'returns-refunds-exchanges',
    'A refund may be approved when there was a defective or damaged item, a mix up in your order, payment for a sold-out item, or a package misplaced in store. Exchanges must be completed within 24 hours of purchase and items must arrive unworn, undamaged, free from blemish, and in original packaging with tags still attached.',
    'returns',
    ARRAY['return','refund','exchange','damaged','wrong item'],
    true
  ),
  (
    'How do I reset my password?',
    'password-reset',
    'Visit /auth/login and click the "Forgot password" link. You will receive a reset email at the address tied to your account. If the email never arrives or you no longer have access to that address, contact our team and we will help you recover the account.',
    'account',
    ARRAY['password','reset','login','account','forgot'],
    true
  ),
  (
    'Can I cancel or modify my order?',
    'cancel-or-modify-order',
    'Orders that have not yet been processed can usually be cancelled or modified. Reach out via chat, WhatsApp or email with your order number as soon as possible. Once an order has shipped it can no longer be edited; you would need to refuse delivery or start a return after receiving it.',
    'orders',
    ARRAY['cancel','modify','change','update order'],
    true
  ),
  (
    'How do coupon codes work?',
    'how-coupons-work',
    'Apply your coupon code at checkout in the discount field. Some codes have a minimum purchase requirement or expiration date. If a code does not apply, this assistant can verify it for you — just paste the code in chat and we will check it.',
    'promotions',
    ARRAY['coupon','promo','discount','code','voucher'],
    true
  ),
  (
    'Is guest checkout supported?',
    'guest-checkout',
    'Yes. You can complete a purchase without creating an account. We will still email you the order confirmation and a tracking link. Creating an account later lets you see your full order history and save addresses.',
    'checkout',
    ARRAY['guest','checkout','no account'],
    true
  ),
  (
    'How do I contact a human agent?',
    'contact-human-agent',
    'You can ask in this chat to "speak to a human" and we will create a support ticket on your behalf. You can also reach us directly on WhatsApp, by phone, or by email — links are in the contact page footer.',
    'support',
    ARRAY['human','agent','speak','contact','support','help'],
    true
  ),
  (
    'Do you ship outside Ghana?',
    'international-shipping',
    'We currently ship within Ghana only. International shipping may be available on request for certain imported items — message our team and we will see what we can do.',
    'shipping',
    ARRAY['international','outside ghana','africa','export'],
    true
  )
ON CONFLICT (slug) DO NOTHING;
