import { NextResponse } from 'next/server';
import { getProductBySlug } from '@/lib/data/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { slug } = await context.params;
    const decoded = decodeURIComponent(slug || '').trim();
    if (!decoded) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const product = await getProductBySlug(decoded);
    if (!product || String(product.status) !== 'active') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err: unknown) {
    console.error('[storefront/products/[slug]]', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
