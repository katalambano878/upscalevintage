import { NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth';
import { notifyAdmin } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  payment_status: string;
  status: string;
  user_id: string | null;
};

type ItemRow = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  image: string | null;
};

/** The order only if the email matches it, so order numbers alone reveal nothing. */
async function findOrder(orderNumber: string, email: string) {
  const order = await queryOne<OrderRow>(
    `SELECT id, order_number, created_at, payment_status::text AS payment_status,
            status::text AS status, user_id
       FROM orders
      WHERE order_number = $1 AND lower(email) = lower($2)`,
    [orderNumber.trim(), email.trim()]
  );
  if (!order) return null;

  const items = await query<ItemRow>(
    `SELECT oi.id, oi.product_name, oi.variant_name, oi.quantity, oi.unit_price,
            COALESCE(
              oi.metadata->>'image',
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.position LIMIT 1)
            ) AS image
       FROM order_items oi
      WHERE oi.order_id = $1::uuid
      ORDER BY oi.created_at`,
    [order.id]
  );
  return { order, items };
}

export async function POST(request: Request) {
  const limit = checkRateLimit(`returns:${getClientIdentifier(request)}`, {
    maxRequests: 20,
    windowSeconds: 15 * 60,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const orderNumber = String(body.orderNumber || '');
  const email = String(body.email || '');

  if (!orderNumber.trim() || !email.trim()) {
    return NextResponse.json({ error: 'Enter your order number and email.' }, { status: 400 });
  }

  try {
    const found = await findOrder(orderNumber, email);
    if (!found) {
      return NextResponse.json(
        { error: 'We could not find an order with that number and email.' },
        { status: 404 }
      );
    }
    const { order, items } = found;

    if (order.payment_status !== 'paid' && order.payment_status !== 'partially_paid') {
      return NextResponse.json(
        { error: 'This order has not been paid, so there is nothing to return.' },
        { status: 400 }
      );
    }
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json({ error: 'This order was already cancelled or refunded.' }, { status: 400 });
    }

    if (action === 'lookup') {
      return NextResponse.json({
        order: { order_number: order.order_number, created_at: order.created_at },
        items,
      });
    }

    if (action !== 'submit') {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const returnType = body.returnType === 'exchange' ? 'exchange' : 'refund';
    const requested = (Array.isArray(body.items) ? body.items : []) as { orderItemId?: string; reason?: string }[];
    const byId = new Map(items.map((item) => [item.id, item]));
    const lines = requested
      .map((r) => ({ item: byId.get(String(r.orderItemId || '')), reason: String(r.reason || '').slice(0, 300) }))
      .filter((l): l is { item: ItemRow; reason: string } => Boolean(l.item && l.reason));

    if (!lines.length) {
      return NextResponse.json({ error: 'Choose at least one item and a reason.' }, { status: 400 });
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM return_requests WHERE order_id = $1::uuid AND status IN ('pending', 'approved', 'processing') LIMIT 1`,
      [order.id]
    );
    if (existing) {
      return NextResponse.json(
        { error: 'A return for this order is already open. We will contact you about it.' },
        { status: 409 }
      );
    }

    const userId = await getUserIdFromRequest(request);
    const notes = String(body.notes || '').slice(0, 2000);

    const requestId = await transaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO return_requests (order_id, user_id, reason, description, refund_method)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5) RETURNING id`,
        [order.id, userId || order.user_id, lines.map((l) => l.reason).join('; '), notes || null, returnType]
      );
      const id = rows[0].id;
      for (const line of lines) {
        await client.query(
          `INSERT INTO return_items (return_request_id, order_item_id, quantity, reason)
           VALUES ($1::uuid, $2::uuid, $3, $4)`,
          [id, line.item.id, line.item.quantity, line.reason]
        );
      }
      return id;
    });

    const list = lines
      .map((l) => `<li>${escapeHtml(l.item.product_name)}${l.item.variant_name ? ` (${escapeHtml(l.item.variant_name)})` : ''} × ${l.item.quantity}: ${escapeHtml(l.reason)}</li>`)
      .join('');
    await notifyAdmin(
      `Return request for ${order.order_number}`,
      `<h2 style="margin:0 0 12px;">New ${returnType} request</h2>
<p>Order <strong>${escapeHtml(order.order_number)}</strong> · ${escapeHtml(email)}</p>
<ul>${list}</ul>
${notes ? `<p>Notes: ${escapeHtml(notes)}</p>` : ''}`
    ).catch((err) => console.error('[returns] admin email failed (request saved):', err));

    return NextResponse.json({ ok: true, id: requestId });
  } catch (err) {
    console.error('[returns]', err);
    return NextResponse.json({ error: 'Could not send your request. Please try again.' }, { status: 500 });
  }
}
