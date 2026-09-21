-- Separate website orders from till sales, and store each staff member's permissions.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'online';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS placed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_channel_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_channel_check CHECK (channel IN ('online', 'pos'));
  END IF;
END $$;

UPDATE public.orders
   SET channel = 'pos'
 WHERE channel = 'online'
   AND (
     COALESCE(metadata->>'pos_sale', '') IN ('true', 't')
     OR COALESCE(metadata->>'channel', '') = 'pos'
     OR lower(COALESCE(email, '')) LIKE '%@pos.local'
     OR lower(COALESCE(email, '')) = 'pos-walkin@store.local'
     OR COALESCE(metadata->>'tracking_number', '') LIKE 'SLI-POS-%'
   );

CREATE INDEX IF NOT EXISTS idx_orders_channel ON public.orders (channel);
CREATE INDEX IF NOT EXISTS idx_orders_placed_by ON public.orders (placed_by);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;
