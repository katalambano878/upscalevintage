import { query, queryOne } from '@/lib/db';

export type CouponType = 'percentage' | 'fixed_amount' | 'free_shipping';

export type CouponRecord = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minimum_purchase: number;
  maximum_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

export type CouponValidation =
  | { valid: false; code: string; reason: string }
  | {
      valid: true;
      code: string;
      coupon: CouponRecord;
      discount: number;
      freeShipping: boolean;
    };

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asCoupon(row: Record<string, unknown>): CouponRecord {
  const rawType = String(row.type || 'percentage');
  const type: CouponType =
    rawType === 'fixed_amount' || rawType === 'free_shipping' ? rawType : 'percentage';
  return {
    id: String(row.id),
    code: String(row.code || '').toUpperCase(),
    description: row.description != null ? String(row.description) : null,
    type,
    value: num(row.value),
    minimum_purchase: num(row.minimum_purchase),
    maximum_discount: row.maximum_discount != null ? num(row.maximum_discount) : null,
    usage_limit: row.usage_limit != null ? Number(row.usage_limit) : null,
    usage_count: num(row.usage_count),
    per_user_limit: Math.max(1, num(row.per_user_limit, 1)),
    start_date: row.start_date ? String(row.start_date) : null,
    end_date: row.end_date ? String(row.end_date) : null,
    is_active: row.is_active !== false,
  };
}

export function computeCouponDiscount(coupon: CouponRecord, subtotal: number): number {
  const base = Math.max(0, Number(subtotal) || 0);
  if (coupon.type === 'free_shipping') return 0;
  if (coupon.type === 'percentage') {
    let amount = base * (coupon.value / 100);
    if (coupon.maximum_discount != null && coupon.maximum_discount > 0) {
      amount = Math.min(amount, coupon.maximum_discount);
    }
    return Math.min(base, Math.round(amount * 100) / 100);
  }
  return Math.min(base, Math.round(coupon.value * 100) / 100);
}

export async function validateCoupon(input: {
  code: string;
  subtotal?: number;
  email?: string | null;
}): Promise<CouponValidation> {
  const code = (input.code || '').trim().toUpperCase();
  if (!code) return { valid: false, code, reason: 'Enter a coupon code.' };

  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM coupons WHERE upper(code) = $1 LIMIT 1`,
    [code]
  );
  if (!row) return { valid: false, code, reason: 'This coupon code does not exist.' };

  const coupon = asCoupon(row);
  const now = Date.now();

  if (!coupon.is_active) {
    return { valid: false, code, reason: 'This coupon is no longer active.' };
  }
  if (coupon.start_date && new Date(coupon.start_date).getTime() > now) {
    return { valid: false, code, reason: 'This coupon is not yet valid.' };
  }
  if (coupon.end_date && new Date(coupon.end_date).getTime() < now) {
    return { valid: false, code, reason: 'This coupon has expired.' };
  }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, code, reason: 'This coupon has reached its usage limit.' };
  }

  const subtotal = input.subtotal;
  if (subtotal != null && coupon.minimum_purchase > 0 && subtotal < coupon.minimum_purchase) {
    return {
      valid: false,
      code,
      reason: `Minimum purchase of GH₵${coupon.minimum_purchase.toFixed(2)} required.`,
    };
  }

  const email = input.email?.trim().toLowerCase();
  if (email && coupon.per_user_limit > 0) {
    const used = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n
       FROM orders
       WHERE lower(email) = $1
         AND metadata->>'coupon_code' = $2
         AND payment_status IN ('paid', 'partially_paid')`,
      [email, coupon.code]
    );
    if (Number(used?.n || 0) >= coupon.per_user_limit) {
      return { valid: false, code, reason: 'You have already used this coupon the allowed number of times.' };
    }
  }

  return {
    valid: true,
    code,
    coupon,
    discount: computeCouponDiscount(coupon, subtotal ?? 0),
    freeShipping: coupon.type === 'free_shipping',
  };
}

export async function applyCouponUsageForOrder(order: Record<string, unknown> | null | undefined) {
  if (!order?.id) return;
  const meta = (order.metadata || {}) as Record<string, unknown>;
  if (meta.coupon_usage_applied) return;

  let couponId = meta.coupon_id ? String(meta.coupon_id) : '';
  const couponCode = meta.coupon_code ? String(meta.coupon_code).toUpperCase() : '';
  if (!couponId && couponCode) {
    const row = await queryOne<{ id: string }>(`SELECT id FROM coupons WHERE upper(code) = $1 LIMIT 1`, [
      couponCode,
    ]);
    couponId = row?.id || '';
  }
  if (!couponId) return;

  await query(
    `UPDATE coupons
     SET usage_count = usage_count + 1, updated_at = now()
     WHERE id = $1::uuid
       AND (usage_limit IS NULL OR usage_count < usage_limit)`,
    [couponId]
  );
  await query(
    `UPDATE orders
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
     WHERE id = $1::uuid`,
    [order.id, JSON.stringify({ coupon_usage_applied: true })]
  );
}
