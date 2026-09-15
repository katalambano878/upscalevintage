import { NextResponse } from 'next/server';
import { isDatabaseReachable } from '@/lib/db';
import { checkConfig } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const config = checkConfig();
    const db = await isDatabaseReachable();
    const ok = config.ok && db;

    return NextResponse.json(
        {
            status: ok ? 'ok' : 'degraded',
            database: db ? 'up' : 'down',
            config: config.ok ? 'ok' : 'invalid',
        },
        { status: ok ? 200 : 503 }
    );
}
