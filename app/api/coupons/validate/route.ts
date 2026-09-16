import { NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/coupons';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limit = checkRateLimit(`coupon-validate:${getClientIdentifier(request)}`, {
    maxRequests: 20,
    windowSeconds: 60 * 60,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many coupon attempts. Please try again later.' }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const code = String(body.code || '');
  const subtotal = body.subtotal != null ? Number(body.subtotal) : undefined;
  const email = body.email != null ? String(body.email) : undefined;

  try {
    const result = await validateCoupon({ code, subtotal, email });
    if (!result.valid) {
      return NextResponse.json({ valid: false, code: result.code, reason: result.reason }, { status: 200 });
    }
    return NextResponse.json({
      valid: true,
      code: result.code,
      type: result.coupon.type,
      value: result.coupon.value,
      discount: result.discount,
      freeShipping: result.freeShipping,
      description: result.coupon.description,
      minimum_purchase: result.coupon.minimum_purchase,
      maximum_discount: result.coupon.maximum_discount,
    });
  } catch (err: unknown) {
    console.error('[coupons/validate]', err);
    return NextResponse.json({ error: 'Could not validate coupon' }, { status: 500 });
  }
}
