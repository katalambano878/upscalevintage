import { NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';
import { emailLayout, sendEmail } from '@/lib/notifications';
import { escapeHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const;

/** Support tickets with their message thread, open ones first. */
export async function GET(request: Request) {
  const gate = await allow(request, 'customers.view');
  if (gate.denied) return gate.denied;

  const rows = await query(
    `SELECT t.id, t.ticket_number, t.email, t.subject, t.description, t.category,
            t.status::text AS status, t.priority::text AS priority, t.metadata,
            t.created_at, t.updated_at,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', m.id,
                'message', m.message,
                'created_at', m.created_at,
                'from_staff', m.user_id IS NOT NULL AND m.user_id IS DISTINCT FROM t.user_id,
                'author', p.full_name
              ) ORDER BY m.created_at)
              FROM support_messages m
              LEFT JOIN profiles p ON p.id = m.user_id
              WHERE m.ticket_id = t.id AND NOT m.is_internal
            ), '[]'::jsonb) AS messages
       FROM support_tickets t
      ORDER BY (t.status IN ('open', 'in_progress')) DESC,
               CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               t.created_at DESC
      LIMIT 500`
  );
  return NextResponse.json(rows);
}

/** Change a ticket's status and/or reply to the customer by email. */
export async function PATCH(request: Request) {
  const gate = await allow(request, 'customers.view');
  if (gate.denied) return gate.denied;
  const staff = gate.auth.user;

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || '');
  const reply = typeof body.reply === 'string' ? body.reply.trim().slice(0, 5000) : '';
  let status = STATUSES.includes(body.status) ? String(body.status) : null;

  if (!/^[0-9a-f-]{36}$/i.test(id) || (!status && !reply)) {
    return NextResponse.json({ error: 'Write a reply or choose a status.' }, { status: 400 });
  }

  const ticket = await queryOne<{ id: string; ticket_number: number; email: string; subject: string }>(
    `SELECT id, ticket_number, email, subject FROM support_tickets WHERE id = $1::uuid`,
    [id]
  );
  if (!ticket) {
    return NextResponse.json({ error: 'That ticket no longer exists.' }, { status: 404 });
  }

  // A reply with no explicit status means the ball is in the customer's court.
  if (reply && !status) status = 'waiting_customer';

  await transaction(async (client) => {
    if (reply) {
      await client.query(
        `INSERT INTO support_messages (ticket_id, user_id, message) VALUES ($1::uuid, $2::uuid, $3)`,
        [id, staff.id, reply]
      );
    }
    await client.query(
      `UPDATE support_tickets SET status = COALESCE($2::ticket_status, status), updated_at = now() WHERE id = $1::uuid`,
      [id, status]
    );
  });

  let emailed = false;
  if (reply) {
    try {
      // sendEmail returns null when it could not send.
      emailed = Boolean(
        await sendEmail({
          to: ticket.email,
          subject: `Re: ${ticket.subject} (ticket #${ticket.ticket_number})`,
          html: emailLayout(
            `<p style="white-space:pre-wrap;">${escapeHtml(reply)}</p>
<p style="color:#6b7280;font-size:13px;">Reply to this email or message us on WhatsApp to continue. Ticket #${ticket.ticket_number}.</p>`,
            `Reply to ticket #${ticket.ticket_number}`
          ),
        })
      );
    } catch (err) {
      console.error('[admin/support] reply email failed (reply saved):', err);
    }
  }

  await noteAction(request, staff.id, 'support.update', 'support_ticket', id, {
    ticket_number: ticket.ticket_number,
    status,
    replied: Boolean(reply),
  });

  return NextResponse.json({ ok: true, status, emailed });
}
