export const COUPON_SESSION_KEY = 'upscale_applied_coupon';

export type AppliedCoupon = {
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping' | 'fixed';
  value: number;
  discount: number;
  description?: string;
  freeShipping?: boolean;
};

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
