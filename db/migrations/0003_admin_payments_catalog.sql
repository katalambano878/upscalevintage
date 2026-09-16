-- Partial payments used by checkout deposits + Moolre callback / reconcile.
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- Replace the 0002 two-arg function so POS/callback calls are not ambiguous.
DROP FUNCTION IF EXISTS public.mark_order_paid(text, text);

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS sale_price numeric(12,2);

CREATE OR REPLACE FUNCTION public.mark_order_paid(
  order_ref text,
  moolre_ref text DEFAULT NULL,
  p_charged_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_order orders;
  v_status payment_status;
BEGIN
  SELECT CASE
    WHEN p_charged_amount IS NOT NULL AND p_charged_amount + 0.009 < total
      THEN 'partially_paid'::payment_status
    ELSE 'paid'::payment_status
  END
  INTO v_status
  FROM orders
  WHERE order_number = order_ref;

  UPDATE orders
  SET
    payment_status = COALESCE(v_status, 'paid'::payment_status),
    status = CASE
        WHEN status = 'pending' THEN 'processing'::order_status
        WHEN status = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                   'amount_paid', COALESCE(p_charged_amount, total)
               )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL THEN
      IF (updated_order.metadata->>'stock_reduced') IS NULL
         AND updated_order.payment_status = 'paid' THEN
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

  v_result := public.mark_order_paid(p_order_ref, p_moolre_ref, p_charged_amount);

  UPDATE payment_events
     SET processing_state = CASE WHEN v_result ? 'id' THEN 'applied' ELSE 'failed' END,
         processed_at = now()
   WHERE provider = 'moolre' AND event_key = v_event_key;

  RETURN v_result;
END;
$$;

INSERT INTO public.categories (name, slug, description, status, position)
VALUES
  ('Fashion Picks', 'fashion', 'Trending everyday style', 'active', 10),
  ('Bags & Accessories', 'accessories', 'Statement finishing touches', 'active', 20),
  ('Lifestyle Finds', 'lifestyle', 'Curated living favorites', 'active', 30),
  ('Trending Imports', 'imported', 'Fresh sourced arrivals', 'active', 40),
  ('Beauty & Care', 'beauty', 'Self-care & grooming picks', 'active', 50),
  ('Home Appliances', 'home-appliances', 'Smart living essentials', 'active', 60),
  ('Car Deals', 'luxury-cars', 'Special imported picks', 'active', 70)
ON CONFLICT (slug) DO NOTHING;
