import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getAdminAnalytics } from '@/lib/data/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const range = new URL(request.url).searchParams.get('range') || '30days';
  try {
    return NextResponse.json(await getAdminAnalytics(range));
  } catch (err: unknown) {
    console.error('[admin/analytics]', err);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
