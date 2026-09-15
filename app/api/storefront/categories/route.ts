import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const data = await query(
            `SELECT id, name, slug, image_url, parent_id, metadata
               FROM categories
              WHERE status = 'active'
              ORDER BY name`
        );

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
            },
        });
    } catch (err) {
        console.error('[Storefront API] Categories error:', (err as Error).message);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}
