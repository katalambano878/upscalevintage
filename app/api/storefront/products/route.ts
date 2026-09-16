import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured') === 'true';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const category = searchParams.get('category')?.trim() || null;

    try {
        const rows = await query<{
            id: string;
            name: string;
            slug: string;
            price: number;
            compare_at_price: number | null;
            quantity: number;
            description: string | null;
            metadata: unknown;
            category: unknown;
            product_images: unknown;
            product_variants: unknown;
        }>(
            `SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.compare_at_price, p.quantity, p.moq,
                    p.description, p.metadata,
                    CASE WHEN c.id IS NULL THEN NULL
                         ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
                    END AS category,
                    COALESCE((
                      SELECT jsonb_agg(jsonb_build_object('url', i.url, 'position', i.position) ORDER BY i.position)
                      FROM product_images i WHERE i.product_id = p.id
                    ), '[]'::jsonb) AS product_images,
                    COALESCE((
                      SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price, 'quantity', v.quantity))
                      FROM product_variants v WHERE v.product_id = p.id
                    ), '[]'::jsonb) AS product_variants
               FROM products p
               LEFT JOIN categories c ON c.id = p.category_id
              WHERE p.status = 'active'
                AND ($1::boolean = false OR p.featured = true)
                AND ($2::text IS NULL OR c.slug = $2 OR c.name ILIKE $2)
              ORDER BY p.created_at DESC
              LIMIT $3`,
            [featured, category, limit]
        );

        const data = rows.map((row) => ({
            ...row,
            categories: row.category,
        }));

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
            },
        });
    } catch (err) {
        console.error('[Storefront API] Products error:', (err as Error).message);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}
