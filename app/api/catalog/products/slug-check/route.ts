import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { allow } from '@/lib/staff-gate';
import { slugifyProduct } from '@/lib/product-seo';

export async function GET(request: Request) {
  const gate = await allow(request, ['products.manage', 'inventory.manage']);
  if (gate.denied) return gate.denied;

  const url = new URL(request.url);
  const raw = url.searchParams.get('slug') || '';
  const exclude = url.searchParams.get('exclude') || '';
  const slug = slugifyProduct(raw);

  if (!slug) {
    return NextResponse.json({ slug: '', available: false, reason: 'empty' });
  }

  const clash = exclude
    ? await queryOne<{ id: string }>(
        `SELECT id FROM products WHERE slug = $1 AND id <> $2::uuid LIMIT 1`,
        [slug, exclude]
      )
    : await queryOne<{ id: string }>(`SELECT id FROM products WHERE slug = $1 LIMIT 1`, [slug]);

  return NextResponse.json({
    slug,
    available: !clash,
    reason: clash ? 'taken' : 'ok',
  });
}
