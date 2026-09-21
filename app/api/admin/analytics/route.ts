import { NextResponse } from 'next/server';
import { allow } from '@/lib/staff-gate';
import { getAdminAnalytics } from '@/lib/data/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = await allow(request, 'analytics.view');
  if (gate.denied) return gate.denied;

  const range = new URL(request.url).searchParams.get('range') || '30days';
  try {
    return NextResponse.json(await getAdminAnalytics(range));
  } catch (err: unknown) {
    console.error('[admin/analytics]', err);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
