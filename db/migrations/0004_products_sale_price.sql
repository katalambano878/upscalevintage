-- Store-wide sale pricing reads products.sale_price; 0001 only had compare_at_price.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price numeric(12,2);

COMMENT ON COLUMN public.products.sale_price IS 'Optional sale amount used when store-wide sale mode is on';
