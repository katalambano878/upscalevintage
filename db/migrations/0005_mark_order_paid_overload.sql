-- 0003 added mark_order_paid(text, text, numeric) while 0002 left
-- mark_order_paid(text, text). Two-arg calls from POS then fail with
-- "function mark_order_paid(unknown, unknown) is not unique".
DROP FUNCTION IF EXISTS public.mark_order_paid(text, text);
