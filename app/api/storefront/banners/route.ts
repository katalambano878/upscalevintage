import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || 'top';

    try {
        const rows = await query(
            `SELECT id, title, subtitle, background_color, text_color, button_text, button_url
               FROM banners
              WHERE is_active = true
                AND position = $1
                AND (start_date IS NULL OR start_date <= now())
                AND (end_date IS NULL OR end_date >= now())
              ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
            [position]
        );
        return NextResponse.json(rows);
    } catch {
        return NextResponse.json([]);
    }
}
