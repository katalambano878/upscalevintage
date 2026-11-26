import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';
import { emailLayout, sendEmail } from '@/lib/notifications';
import { escapeHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'approved', 'rejected', 'processing', 'completed'] as const;
type ReturnStatus = (typeof STATUSES)[number];

/** Return and exchange requests, newest first, with the order and items. */
export async function GET(request: Request) {
  const gate = await allow(request, 'orders.view');
  if (gate.denied) return gate.denied;

  const rows = await query(
    `SELECT r.id, r.status::text AS status, r.reason, r.description, r.refund_method AS request_type,
            r.admin_notes, r.created_at, r.updated_at,
            o.id AS order_id, o.order_number, o.email, o.phone, o.total, o.created_at AS order_date,
            COALESCE(
              NULLIF(trim(concat_ws(' ', o.shipping_address->>'firstName', o.shipping_address->>'lastName')), ''),
              o.metadata->>'first_name',
              o.email
            ) AS customer_name,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', ri.id,
                'product_name', oi.product_name,
                'variant_name', oi.variant_name,
                'quantity', ri.quantity,
                'unit_price', oi.unit_price,
                'reason', ri.reason
              ) ORDER BY ri.created_at)
              FROM return_items ri
              LEFT JOIN order_items oi ON oi.id = ri.order_item_id
              WHERE ri.return_request_id = r.id
            ), '[]'::jsonb) AS items
       FROM return_requests r
       JOIN orders o ON o.id = r.order_id
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
      LIMIT 500`
  );
  return NextResponse.json(rows);
}

const CUSTOMER_MESSAGES: Partial<Record<ReturnStatus, { subject: string; body: string }>> = {
  approved: {
    subject: 'Your return request was approved',
    body: 'Good news: we approved your request. Bring the items unworn, with tags and packaging, to our shop, or reply to this email and we will arrange it with you.',
  },
  rejected: {
    subject: 'About your return request',
    body: 'We looked at your request and could not accept it under our refund policy. Reply to this email or message us on WhatsApp if you want to talk it through.',
  },
  completed: {
    subject: 'Your return is complete',
    body: 'Your return or exchange is complete. Thank you for shopping with us.',
  },
};

export async function PATCH(request: Request) {
  const gate = await allow(request, 'orders.update');
  if (gate.denied) return gate.denied;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const status = STATUSES.includes(body.status) ? (body.status as ReturnStatus) : null;
  const notes = typeof body.admin_notes === 'string' ? body.admin_notes.slice(0, 2000) : null;

  if (!/^[0-9a-f-]{36}$/i.test(id) || (!status && notes === null)) {
    return NextResponse.json({ error: 'Choose a request and a new status or note.' }, { status: 400 });
  }

  const before = await queryOne<{ status: string }>(
    `SELECT status::text AS status FROM return_requests WHERE id = $1::uuid`,
    [id]
  );
  if (!before) {
    return NextResponse.json({ error: 'That return request no longer exists.' }, { status: 404 });
  }

  const updated = await queryOne<{ id: string; status: string; order_number: string; email: string }>(
    `UPDATE return_requests r
        SET status = COALESCE($2::return_status, r.status),
            admin_notes = COALESCE($3, r.admin_notes),
            updated_at = now()
       FROM orders o
      WHERE r.id = $1::uuid AND o.id = r.order_id
      RETURNING r.id, r.status::text AS status, o.order_number, o.email`,
    [id, status, notes]
  );
  if (!updated) {
    return NextResponse.json({ error: 'Could not update the request.' }, { status: 500 });
  }

  await noteAction(request, gate.auth.user.id, 'return.update', 'return_request', id, {
    order_number: updated.order_number,
    status: updated.status,
  });

  // Tell the customer when the decision changes.
  const message = status && status !== before.status ? CUSTOMER_MESSAGES[status] : undefined;
  let emailed = false;
  if (message && updated.email) {
    try {
      // sendEmail returns null when it could not send.
      emailed = Boolean(
        await sendEmail({
          to: updated.email,
          subject: `${message.subject} (${updated.order_number})`,
          html: emailLayout(
            `<p>Hi,</p><p>${escapeHtml(message.body)}</p><p>Order: <strong>${escapeHtml(updated.order_number)}</strong></p>`,
            message.subject
          ),
        })
      );
    } catch (err) {
      console.error('[admin/returns] customer email failed:', err);
    }
  }

  return NextResponse.json({ ...updated, emailed });
}
