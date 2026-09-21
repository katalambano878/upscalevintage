import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total: number;
  created_at: string;
};

type CloseRecord = {
  date: string;
  closed_at: string;
  closed_by: string | null;
  order_count: number;
  paid_total: number;
  note: string;
};

function isDate(value: string | null) {
  return Boolean(value && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)));
}

async function loadCloses() {
  const row = await queryOne<{ value: { closes?: CloseRecord[] } | null }>(
    `SELECT value FROM site_settings WHERE key = 'day_closes'`
  );
  const closes = row?.value?.closes;
  return Array.isArray(closes) ? closes : [];
}

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get('date');
  if (!isDate(date)) {
    return NextResponse.json({ error: 'Choose a valid day.' }, { status: 400 });
  }

  const { start, end } = dayBounds(date as string);

  try {
    const orders = await query<OrderRow>(
      `SELECT id, order_number, email, status::text AS status, payment_status::text AS payment_status,
              payment_method, total, created_at
         FROM orders
        WHERE created_at >= $1::timestamptz
          AND created_at < $2::timestamptz
          AND status::text <> 'cancelled'
        ORDER BY created_at DESC`,
      [start, end]
    );

    const itemCount = await queryOne<{ quantity: number }>(
      `SELECT COALESCE(SUM(oi.quantity), 0)::int AS quantity
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= $1::timestamptz
          AND o.created_at < $2::timestamptz
          AND o.status::text <> 'cancelled'`,
      [start, end]
    );

    const closes = await loadCloses();
    const close = closes.find((entry) => entry.date === date) ?? null;

    return NextResponse.json({
      date,
      orders,
      item_count: itemCount?.quantity ?? 0,
      close,
    });
  } catch (err: unknown) {
    console.error('[admin/end-of-day GET]', err);
    return NextResponse.json({ error: 'Could not load the day.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date = typeof body?.date === 'string' ? body.date : '';
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : '';

  if (!isDate(date)) {
    return NextResponse.json({ error: 'Choose a valid day.' }, { status: 400 });
  }

  const { start, end } = dayBounds(date);

  try {
    const totals = await queryOne<{ order_count: number; paid_total: number }>(
      `SELECT COUNT(*)::int AS order_count,
              COALESCE(SUM(total) FILTER (WHERE payment_status::text = 'paid'), 0)::float AS paid_total
         FROM orders
        WHERE created_at >= $1::timestamptz
          AND created_at < $2::timestamptz
          AND status::text <> 'cancelled'`,
      [start, end]
    );

    const closes = await loadCloses();
    const nextClose: CloseRecord = {
      date,
      closed_at: new Date().toISOString(),
      closed_by: auth.user?.email ?? null,
      order_count: totals?.order_count ?? 0,
      paid_total: totals?.paid_total ?? 0,
      note,
    };
    const next = [nextClose, ...closes.filter((entry) => entry.date !== date)].slice(0, 120);

    await query(
      `INSERT INTO site_settings (key, value, category, updated_at)
       VALUES ('day_closes', $1::jsonb, 'reports', now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [JSON.stringify({ closes: next })]
    );

    return NextResponse.json({ close: nextClose });
  } catch (err: unknown) {
    console.error('[admin/end-of-day POST]', err);
    return NextResponse.json({ error: 'Could not close the day.' }, { status: 500 });
  }
}
