import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { allow } from '@/lib/staff-gate';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const gate = await allow(request, 'staff.manage');
  if (gate.denied) return gate.denied;

  const url = new URL(request.url);
  const userId = url.searchParams.get('user');
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '150', 10) || 150, 1), 300);

  if (userId && !UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Unknown staff member.' }, { status: 400 });
  }

  try {
    const rows = await query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
              u.email, p.full_name, p.role::text AS role
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN profiles p ON p.id = a.user_id
        WHERE ($1::uuid IS NULL OR a.user_id = $1::uuid)
        ORDER BY a.created_at DESC
        LIMIT $2`,
      [userId, limit]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[admin/activity GET]', err);
    return NextResponse.json({ error: 'Could not load activity.' }, { status: 500 });
  }
}
