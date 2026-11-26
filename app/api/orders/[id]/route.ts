import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth, isStaffRole, getUserIdFromRequest } from '@/lib/auth';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';
import { getOrderById } from '@/lib/data/orders';

type Ctx = { params: Promise<{ id: string }> };

// Matches an order by id or by order number. A bare `id = $1::uuid` fails with
// 22P02 when $1 is an order number like ORD-123-456.
const ORDER_MATCH = `(CASE WHEN $1 ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       THEN id = $1::uuid ELSE false END
                     OR order_number = $1::text)`;

export async function GET(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const auth = await verifyAuth(request);
    const userId = await getUserIdFromRequest(request);
    const isStaff = auth.authenticated && isStaffRole(auth.role || '');

    const order = await getOrderById(id, userId, isStaff);
    if (!order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const gate = await allow(request, 'orders.update');
  if (gate.denied) return gate.denied;
  const auth = gate.auth;

  const { id } = await context.params;
  const body = await request.json();

  if ('payment_status' in body) {
    return NextResponse.json(
      { error: 'payment_status cannot be changed via order PATCH; use Payment Reconcile instead' },
      { status: 400 }
    );
  }

  const allowed = ['status', 'notes', 'metadata', 'shipping_address'] as const;
  const sets: string[] = [];
  const params: unknown[] = [id];
  let i = 2;

  for (const key of allowed) {
    if (key in body) {
      if (key === 'status') {
        sets.push(`${key} = $${i}::order_status`);
        params.push(body[key]);
      } else if (key === 'metadata') {
        // Merge, never replace: the payment callback writes keys such as
        // stock_reduced and amount_paid that the admin page may not have seen.
        sets.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${i}::jsonb`);
        params.push(JSON.stringify(body[key]));
      } else if (key === 'shipping_address') {
        sets.push(`${key} = $${i}::jsonb`);
        params.push(JSON.stringify(body[key]));
      } else {
        sets.push(`${key} = $${i}`);
        params.push(body[key]);
      }
      i++;
    }
  }

  if (!sets.length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  if (body.status === 'shipped' || body.status === 'delivered') {
    const current = await queryOne<{ payment_status: string }>(
      `SELECT payment_status::text AS payment_status FROM orders WHERE ${ORDER_MATCH}`,
      [id]
    );
    if (current && current.payment_status !== 'paid' && current.payment_status !== 'partially_paid') {
      return NextResponse.json(
        { error: 'Order must be paid or deposit-paid before packaged/delivered status' },
        { status: 400 }
      );
    }
  }

  sets.push('updated_at = now()');

  try {
    const updated = await queryOne(
      `UPDATE orders SET ${sets.join(', ')} WHERE ${ORDER_MATCH} RETURNING *`,
      params
    );
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (body.status === 'cancelled' || body.status === 'refunded') {
      // Paid orders took stock off the shelf; put it back once.
      try {
        await query(`SELECT restock_order($1::uuid)`, [updated.id]);
      } catch (restockErr) {
        // restock_order arrives with migration 0008; the cancel itself still counts.
        console.error('[orders PATCH] restock failed:', restockErr);
      }
    }

    if (body.status) {
      await query(
        `INSERT INTO order_status_history (order_id, status, notes, created_by)
         SELECT id, $2::order_status, $3, $4::uuid FROM orders WHERE ${ORDER_MATCH}`,
        [id, body.status, body.status_note || null, auth.user?.id || null]
      );
    }

    await noteAction(request, auth.user?.id, 'order.update', 'order', updated.id, {
      order_number: updated.order_number,
      status: body.status,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
