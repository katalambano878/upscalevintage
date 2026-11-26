import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { notifyAdmin } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES = new Set(['order', 'delivery', 'return', 'payment', 'product', 'account', 'other']);
const PRIORITIES: Record<string, string> = { low: 'low', normal: 'medium', medium: 'medium', high: 'high', urgent: 'urgent' };

/** The signed-in customer's own tickets. */
export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Sign in to see your tickets.' }, { status: 401 });
  }

  const rows = await query(
    `SELECT t.id, t.ticket_number, t.subject, t.category, t.status::text AS status,
            t.priority::text AS priority, t.created_at, t.updated_at,
            (SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id AND NOT m.is_internal) AS messages
       FROM support_tickets t
      WHERE t.user_id = $1::uuid OR lower(t.email) = lower($2)
      ORDER BY t.created_at DESC
      LIMIT 100`,
    [auth.user.id, auth.user.email]
  );
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const limit = checkRateLimit(`support-ticket:${getClientIdentifier(request)}`, {
    maxRequests: 5,
    windowSeconds: 15 * 60,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many tickets. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase();
  const subject = String(body.subject || '').trim().slice(0, 200);
  const description = String(body.description || '').trim().slice(0, 5000);
  const orderNumber = String(body.orderNumber || '').trim().slice(0, 60);
  const category = CATEGORIES.has(String(body.category)) ? String(body.category) : 'other';
  const priority = PRIORITIES[String(body.priority)] || 'medium';

  if (!name || !subject || !description || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Please fill in your name, a valid email, a subject and a description.' },
      { status: 400 }
    );
  }

  try {
    const auth = await verifyAuth(request);
    const userId = auth.authenticated && auth.user ? auth.user.id : null;

    const ticket = await queryOne<{ id: string; ticket_number: number }>(
      `INSERT INTO support_tickets (user_id, email, subject, description, category, priority, metadata)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::ticket_priority, $7::jsonb)
       RETURNING id, ticket_number`,
      [userId, email, subject, description, category, priority, JSON.stringify({ name, order_number: orderNumber || null })]
    );
    if (!ticket) throw new Error('Ticket insert returned nothing');

    await query(
      `INSERT INTO support_messages (ticket_id, user_id, message) VALUES ($1::uuid, $2::uuid, $3)`,
      [ticket.id, userId, description]
    );

    await notifyAdmin(
      `Support ticket #${ticket.ticket_number}: ${subject}`,
      `<h2 style="margin:0 0 12px;">New support ticket #${ticket.ticket_number}</h2>
<p><strong>${escapeHtml(name)}</strong> · ${escapeHtml(email)}${orderNumber ? ` · Order ${escapeHtml(orderNumber)}` : ''}</p>
<p>Category: ${escapeHtml(category)} · Priority: ${escapeHtml(priority)}</p>
<p><strong>${escapeHtml(subject)}</strong></p>
<p style="white-space:pre-wrap;">${escapeHtml(description)}</p>`
    ).catch((err) => console.error('[support] admin email failed (ticket saved):', err));

    return NextResponse.json({ ok: true, ticketNumber: ticket.ticket_number }, { status: 201 });
  } catch (err) {
    console.error('[support/tickets]', err);
    return NextResponse.json({ error: 'Could not create your ticket. Please try again.' }, { status: 500 });
  }
}
