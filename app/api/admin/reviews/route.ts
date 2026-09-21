import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';

export async function GET(request: Request) {
  const gate = await allow(request, 'reviews.manage');
  if (gate.denied) return gate.denied;

  try {
    const status = new URL(request.url).searchParams.get('status') || 'pending';
    const result =
      status === 'all'
        ? await query(
            `SELECT r.*, p.name AS product_name, pr.full_name AS reviewer_name
             FROM reviews r
             LEFT JOIN products p ON p.id = r.product_id
             LEFT JOIN profiles pr ON pr.id = r.user_id
             ORDER BY r.created_at DESC`
          )
        : await query(
            `SELECT r.*, p.name AS product_name, pr.full_name AS reviewer_name
             FROM reviews r
             LEFT JOIN products p ON p.id = r.product_id
             LEFT JOIN profiles pr ON pr.id = r.user_id
             WHERE r.status = $1::review_status
             ORDER BY r.created_at DESC`,
            [status]
          );
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list reviews';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const gate = await allow(request, 'reviews.manage');
  if (gate.denied) return gate.denied;

  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const updated = await queryOne(
      `UPDATE reviews SET status = $2::review_status, updated_at = now() WHERE id = $1::uuid RETURNING *`,
      [id, status]
    );
    await noteAction(request, gate.auth.user?.id, 'review.update', 'review', String(id), { status });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
