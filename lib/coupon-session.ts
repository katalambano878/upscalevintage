export const COUPON_SESSION_KEY = 'upscale_applied_coupon';

export type AppliedCoupon = {
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'fixed';
  value: number;
  discount: number;
  description?: string;
  freeShipping?: boolean;
  minimumPurchase?: number;
  maximumDiscount?: number;
};

/**
 * The discount for the current subtotal, using the same rules as the server
 * (lib/coupons computeCouponDiscount). The amount saved when the code was
 * applied goes stale once the cart changes.
 */
export function couponDiscountFor(coupon: AppliedCoupon | null, subtotal: number): number {
  if (!coupon) return 0;
  const base = Math.max(0, Number(subtotal) || 0);
  if (coupon.minimumPurchase && base < coupon.minimumPurchase) return 0;
  if (coupon.type === 'free_shipping') return 0;
  if (coupon.type === 'percentage') {
    let amount = base * ((Number(coupon.value) || 0) / 100);
    if (coupon.maximumDiscount && coupon.maximumDiscount > 0) {
      amount = Math.min(amount, coupon.maximumDiscount);
    }
    return Math.min(base, Math.round(amount * 100) / 100);
  }
  return Math.min(base, Math.round((Number(coupon.value) || 0) * 100) / 100);
}

export function readAppliedCoupon(): AppliedCoupon | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(COUPON_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppliedCoupon;
    if (!parsed?.code) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAppliedCoupon(coupon: AppliedCoupon) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(COUPON_SESSION_KEY, JSON.stringify(coupon));
}

export function clearAppliedCoupon() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(COUPON_SESSION_KEY);
}
