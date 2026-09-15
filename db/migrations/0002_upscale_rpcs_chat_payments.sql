-- Upscale-specific functions, chat, contact form, and payment inbox.
-- Authorization is enforced in application code; no RLS / auth.uid().

ALTER TABLE public.order_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN variant_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_customer_from_order(
  p_email text,
  p_phone text,
  p_full_name text,
  p_first_name text,
  p_last_name text,
  p_user_id uuid DEFAULT NULL,
  p_address jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id UUID;
  v_existing_email TEXT;
  v_existing_phone TEXT;
  v_existing_secondary_email TEXT;
  v_existing_secondary_phone TEXT;
BEGIN
  SELECT id, email, phone, secondary_email, secondary_phone
  INTO v_customer_id, v_existing_email, v_existing_phone, v_existing_secondary_email, v_existing_secondary_phone
  FROM customers
  WHERE email = p_email OR secondary_email = p_email
  LIMIT 1;

  IF v_customer_id IS NULL AND p_phone IS NOT NULL AND p_phone != '' THEN
    SELECT id, email, phone, secondary_email, secondary_phone
    INTO v_customer_id, v_existing_email, v_existing_phone, v_existing_secondary_email, v_existing_secondary_phone
    FROM customers
    WHERE phone = p_phone OR secondary_phone = p_phone
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (email, phone, full_name, first_name, last_name, user_id, default_address)
    VALUES (p_email, p_phone, p_full_name, p_first_name, p_last_name, p_user_id, p_address)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE customers SET
      secondary_email = CASE
        WHEN p_email IS NOT NULL AND p_email != '' AND p_email != v_existing_email
             AND (v_existing_secondary_email IS NULL OR v_existing_secondary_email = '' OR v_existing_secondary_email != p_email)
        THEN p_email ELSE secondary_email END,
      secondary_phone = CASE
        WHEN p_phone IS NOT NULL AND p_phone != '' AND p_phone != v_existing_phone
             AND (v_existing_secondary_phone IS NULL OR v_existing_secondary_phone = '' OR v_existing_secondary_phone != p_phone)
        THEN p_phone ELSE secondary_phone END,
      full_name = COALESCE(NULLIF(p_full_name, ''), full_name),
      first_name = COALESCE(NULLIF(p_first_name, ''), first_name),
      last_name = COALESCE(NULLIF(p_last_name, ''), last_name),
      user_id = COALESCE(p_user_id, user_id),
      default_address = COALESCE(p_address, default_address),
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  RETURN v_customer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_customer_stats(p_customer_email text, p_order_total numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers
  SET total_orders = total_orders + 1,
      total_spent = total_spent + p_order_total,
      last_order_at = NOW(),
      updated_at = NOW()
  WHERE email = p_customer_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.reduce_stock_on_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE products p
  SET quantity = GREATEST(p.quantity - oi.quantity, 0),
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.product_id = p.id;

  UPDATE product_variants pv
  SET quantity = GREATEST(pv.quantity - oi.quantity, 0),
      updated_at = now()
  FROM order_items oi
  WHERE oi.order_id = p_order_id
    AND oi.product_id = pv.product_id
    AND oi.variant_name IS NOT NULL
    AND oi.variant_name = pv.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET
    payment_status = 'paid',
    status = CASE
        WHEN status = 'pending' THEN 'processing'::order_status
        WHEN status = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL THEN
      IF (updated_order.metadata->>'stock_reduced') IS NULL THEN
          UPDATE products p
          SET quantity = GREATEST(0, p.quantity - oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND oi.product_id = p.id;

          UPDATE product_variants pv
          SET quantity = GREATEST(0, pv.quantity - oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND oi.product_id = pv.product_id
            AND oi.variant_name IS NOT NULL
            AND oi.variant_name = pv.name;

          UPDATE orders
          SET metadata = metadata || '{"stock_reduced": true}'::jsonb
          WHERE id = updated_order.id;
      END IF;
  ELSE
      SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        text NOT NULL UNIQUE,
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_chat_conversations_session ON public.chat_conversations (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON public.chat_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_email ON public.chat_conversations (customer_email);

CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id              uuid REFERENCES public.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.customer_insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_insights_customer_id
  ON public.customer_insights (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_insights_email
  ON public.customer_insights (customer_email)
  WHERE customer_id IS NULL AND customer_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_knowledge_base (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  slug        text UNIQUE,
  content     text NOT NULL,
  category    text,
  tags        text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT true,
  views_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.upsert_chat_conversation(
  p_session_id text,
  p_user_id uuid DEFAULT NULL,
  p_messages jsonb DEFAULT '[]'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_sentiment text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_intent text DEFAULT NULL,
  p_summary text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_page_context text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO chat_conversations (
    session_id, user_id, messages, metadata, sentiment, category, intent,
    summary, message_count, customer_email, customer_name, page_context
  ) VALUES (
    p_session_id, p_user_id, p_messages, p_metadata, p_sentiment, p_category, p_intent,
    p_summary, jsonb_array_length(COALESCE(p_messages, '[]'::jsonb)), p_customer_email, p_customer_name, p_page_context
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = COALESCE(EXCLUDED.user_id, chat_conversations.user_id),
    messages = EXCLUDED.messages,
    metadata = EXCLUDED.metadata,
    sentiment = EXCLUDED.sentiment,
    category = EXCLUDED.category,
    intent = EXCLUDED.intent,
    summary = EXCLUDED.summary,
    message_count = jsonb_array_length(COALESCE(EXCLUDED.messages, '[]'::jsonb)),
    customer_email = COALESCE(EXCLUDED.customer_email, chat_conversations.customer_email),
    customer_name = COALESCE(EXCLUDED.customer_name, chat_conversations.customer_name),
    page_context = COALESCE(EXCLUDED.page_context, chat_conversations.page_context),
    updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.payment_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  event_key       text NOT NULL,
  order_number    text,
  provider_ref    text,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  authenticity    text NOT NULL DEFAULT 'untrusted'
                    CHECK (authenticity IN ('untrusted', 'verified', 'rejected')),
  processing_state text NOT NULL DEFAULT 'accepted'
                    CHECK (processing_state IN ('accepted', 'processing', 'applied', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz,
  UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order ON public.payment_events (order_number);
CREATE INDEX IF NOT EXISTS idx_payment_events_state ON public.payment_events (processing_state);

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
    RETURN NULL;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.customer_insights (customer_id, customer_email, customer_name, total_chats, last_chat_at)
    VALUES (p_customer_id, p_customer_email, p_customer_name, 1, now())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.customer_insights
    SET total_chats    = total_chats + 1,
        last_chat_at   = now(),
        customer_name  = COALESCE(NULLIF(p_customer_name, ''), customer_name),
        customer_email = COALESCE(NULLIF(p_customer_email, ''), customer_email),
        customer_id    = COALESCE(p_customer_id, customer_id),
        updated_at     = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_ref text,
  p_moolre_ref text,
  p_charged_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_key text;
  v_result jsonb;
BEGIN
  v_event_key := coalesce(nullif(p_moolre_ref, ''), p_order_ref);

  INSERT INTO payment_events (provider, event_key, order_number, provider_ref, payload, authenticity, processing_state)
  VALUES (
    'moolre',
    v_event_key,
    p_order_ref,
    p_moolre_ref,
    jsonb_build_object('charged_amount', p_charged_amount),
    'verified',
    'accepted'
  )
  ON CONFLICT (provider, event_key) DO UPDATE
    SET attempts = payment_events.attempts + 1;

  v_result := public.mark_order_paid(p_order_ref, p_moolre_ref);

  UPDATE payment_events
     SET processing_state = CASE WHEN v_result ? 'id' THEN 'applied' ELSE 'failed' END,
         processed_at = now()
   WHERE provider = 'moolre' AND event_key = v_event_key;

  RETURN v_result;
END;
$$;
