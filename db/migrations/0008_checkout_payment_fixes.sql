-- 1. Paid orders reduce variant stock by order_items.variant_id (now saved at
-- checkout). Older rows have no variant_id, so they still match on the
-- variant label: either "Name" or "Option2 / Name" (for example "Red / M").
-- Before this, "Red / M" never matched pv.name = 'M' and variant stock stayed
-- the same after a sale.
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
  v_prev_status payment_status;
  v_total numeric;
  v_new_paid numeric;
BEGIN
  -- Lock the order so the Moolre callback and the customer's verify call
  -- cannot both apply the same payment at once.
  -- Payments add up: a balance payment after a deposit makes the order paid.
  SELECT payment_status,
         total,
         COALESCE(NULLIF(metadata->>'amount_paid', '')::numeric, 0)
           + COALESCE(p_charged_amount,
                      total - COALESCE(NULLIF(metadata->>'amount_paid', '')::numeric, 0))
  INTO v_prev_status, v_total, v_new_paid
  FROM orders
  WHERE order_number = order_ref
  FOR UPDATE;

  v_status := CASE WHEN v_new_paid + 0.009 < v_total
                   THEN 'partially_paid'::payment_status
                   ELSE 'paid'::payment_status END;

  IF v_prev_status = 'paid' THEN
      SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
      RETURN to_jsonb(updated_order) || jsonb_build_object('newly_paid', false);
  END IF;

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
                   'amount_paid', v_new_paid,
                   'balance_due', GREATEST(total - v_new_paid, 0)
               )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL THEN
      IF (updated_order.metadata->>'stock_reduced') IS NULL
         AND updated_order.payment_status = 'paid' THEN
          -- Sum per product so two lines of the same product both count.
          UPDATE products p
          SET quantity = GREATEST(0, p.quantity - s.qty)
          FROM (
            SELECT product_id, SUM(quantity) AS qty
            FROM order_items
            WHERE order_id = updated_order.id AND product_id IS NOT NULL
            GROUP BY product_id
          ) s
          WHERE s.product_id = p.id;

          -- Lines without a usable variant id are linked by their label first
          -- so the decrement here and restock_order() use the same rows.
          UPDATE order_items oi
          SET variant_id = (
            SELECT v.id FROM product_variants v
            WHERE v.product_id = oi.product_id
              AND (
                (position(' / ' in oi.variant_name) > 0
                  AND trim(coalesce(v.option2, '')) = trim(split_part(oi.variant_name, ' / ', 1))
                  AND trim(v.name) = trim(split_part(oi.variant_name, ' / ', 2)))
                OR (position(' / ' in oi.variant_name) = 0
                  AND (trim(v.name) = trim(oi.variant_name)
                       OR trim(coalesce(v.option2, '')) = trim(oi.variant_name)))
              )
            ORDER BY v.created_at
            LIMIT 1
          )
          WHERE oi.order_id = updated_order.id
            AND oi.variant_name IS NOT NULL
            -- Saving a product in admin recreates its variants with new ids,
            -- so also re-link lines whose variant id no longer exists.
            AND (oi.variant_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM product_variants x WHERE x.id = oi.variant_id));

          UPDATE product_variants pv
          SET quantity = GREATEST(0, pv.quantity - s.qty)
          FROM (
            SELECT variant_id, SUM(quantity) AS qty
            FROM order_items
            WHERE order_id = updated_order.id AND variant_id IS NOT NULL
            GROUP BY variant_id
          ) s
          WHERE s.variant_id = pv.id;

          UPDATE orders
          SET metadata = metadata || '{"stock_reduced": true}'::jsonb
          WHERE id = updated_order.id;
      END IF;
  ELSE
      SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order) || jsonb_build_object(
    'newly_paid',
    updated_order.id IS NOT NULL
      AND updated_order.payment_status = 'paid'
      AND v_prev_status IS DISTINCT FROM 'paid'
  );
END;
$$;

-- 2. Customer records are unique on lower(email). The old lookups compared
-- email exactly, so "Ama@x.com" missed "ama@x.com", tried to INSERT, hit the
-- unique index and rolled back the whole checkout.
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
  v_email TEXT := lower(trim(coalesce(p_email, '')));
BEGIN
  SELECT id, email, phone, secondary_email, secondary_phone
  INTO v_customer_id, v_existing_email, v_existing_phone, v_existing_secondary_email, v_existing_secondary_phone
  FROM customers
  WHERE lower(email) = v_email OR lower(secondary_email) = v_email
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
    VALUES (v_email, p_phone, p_full_name, p_first_name, p_last_name, p_user_id, p_address)
    ON CONFLICT ((lower(email))) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE customers SET
      secondary_email = CASE
        WHEN v_email != '' AND v_email != lower(v_existing_email)
             AND (v_existing_secondary_email IS NULL OR v_existing_secondary_email = '' OR lower(v_existing_secondary_email) != v_email)
        THEN v_email ELSE secondary_email END,
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
  WHERE lower(email) = lower(p_customer_email)
     OR lower(secondary_email) = lower(p_customer_email);
END;
$$;

-- 3. The payment-reminder cron reads and writes these; they never existed,
-- so every run failed before sending anything.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_reminder_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_reminder_sent_at timestamptz;

-- 4. Put stock back when a paid (stock-reduced) order is cancelled or refunded.
CREATE OR REPLACE FUNCTION public.restock_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reduced boolean;
BEGIN
  SELECT (metadata->>'stock_reduced') IS NOT NULL INTO v_reduced
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT COALESCE(v_reduced, false) THEN
    RETURN false;
  END IF;

  -- Re-link lines whose variant was recreated by an admin save since the sale.
  UPDATE order_items oi
  SET variant_id = (
    SELECT v.id FROM product_variants v
    WHERE v.product_id = oi.product_id
      AND (
        (position(' / ' in oi.variant_name) > 0
          AND trim(coalesce(v.option2, '')) = trim(split_part(oi.variant_name, ' / ', 1))
          AND trim(v.name) = trim(split_part(oi.variant_name, ' / ', 2)))
        OR (position(' / ' in oi.variant_name) = 0
          AND (trim(v.name) = trim(oi.variant_name)
               OR trim(coalesce(v.option2, '')) = trim(oi.variant_name)))
      )
    ORDER BY v.created_at
    LIMIT 1
  )
  WHERE oi.order_id = p_order_id
    AND oi.variant_name IS NOT NULL
    AND (oi.variant_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM product_variants x WHERE x.id = oi.variant_id));

  UPDATE products p
  SET quantity = p.quantity + s.qty
  FROM (
    SELECT product_id, SUM(quantity) AS qty FROM order_items
    WHERE order_id = p_order_id AND product_id IS NOT NULL
    GROUP BY product_id
  ) s
  WHERE s.product_id = p.id;

  UPDATE product_variants pv
  SET quantity = pv.quantity + s.qty
  FROM (
    SELECT variant_id, SUM(quantity) AS qty FROM order_items
    WHERE order_id = p_order_id AND variant_id IS NOT NULL
    GROUP BY variant_id
  ) s
  WHERE s.variant_id = pv.id;

  UPDATE orders
  SET metadata = (metadata - 'stock_reduced') || jsonb_build_object('restocked_at', now())
  WHERE id = p_order_id;

  RETURN true;
END;
$$;
