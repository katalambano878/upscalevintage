import { query, queryOne } from '@/lib/db';

export type AnalyticsRange = '7days' | '30days' | '90days' | 'year';

export function resolveAnalyticsWindow(range: string, now = new Date()) {
  const end = now;
  const start = new Date(now);
  if (range === '7days') start.setDate(start.getDate() - 7);
  else if (range === '90days') start.setDate(start.getDate() - 90);
  else if (range === 'year') start.setFullYear(start.getFullYear(), 0, 1);
  else start.setDate(start.getDate() - 30);

  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setTime(start.getTime() - (end.getTime() - start.getTime()));

  return { start, end, prevStart, prevEnd, range: (range as AnalyticsRange) || '30days' };
}

function growth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type PeriodRow = {
  orders_all: string;
  orders_paid: string;
  revenue: string;
  discount: string;
};

async function periodMetrics(from: Date, to: Date): Promise<{
  ordersAll: number;
  ordersPaid: number;
  revenue: number;
  discount: number;
}> {
  const row = await queryOne<PeriodRow>(
    `SELECT
       COUNT(*)::text AS orders_all,
       COUNT(*) FILTER (
         WHERE payment_status IN ('paid', 'partially_paid') AND status <> 'cancelled'
       )::text AS orders_paid,
       COALESCE(SUM(total) FILTER (
         WHERE payment_status IN ('paid', 'partially_paid') AND status <> 'cancelled'
       ), 0)::text AS revenue,
       COALESCE(SUM(discount_total) FILTER (
         WHERE payment_status IN ('paid', 'partially_paid') AND status <> 'cancelled'
       ), 0)::text AS discount
     FROM orders
     WHERE created_at >= $1 AND created_at < $2`,
    [from.toISOString(), to.toISOString()]
  );
  return {
    ordersAll: Number(row?.orders_all || 0),
    ordersPaid: Number(row?.orders_paid || 0),
    revenue: Number(row?.revenue || 0),
    discount: Number(row?.discount || 0),
  };
}

export async function getAdminAnalytics(range: string) {
  const window = resolveAnalyticsWindow(range);
  const [current, previous, daily, products, categories] = await Promise.all([
    periodMetrics(window.start, window.end),
    periodMetrics(window.prevStart, window.prevEnd),
    query<{ date: string; sales: string; orders: string }>(
      `SELECT to_char(date_trunc('day', created_at), 'Mon DD') AS date,
              COALESCE(SUM(total), 0)::text AS sales,
              COUNT(*)::text AS orders
       FROM orders
       WHERE created_at >= $1 AND created_at < $2
         AND payment_status IN ('paid', 'partially_paid')
         AND status <> 'cancelled'
       GROUP BY date_trunc('day', created_at)
       ORDER BY date_trunc('day', created_at)`,
      [window.start.toISOString(), window.end.toISOString()]
    ),
    query<{ name: string; units: string; revenue: string }>(
      `SELECT COALESCE(NULLIF(oi.product_name, ''), 'Unknown') AS name,
              COALESCE(SUM(oi.quantity), 0)::text AS units,
              COALESCE(SUM(oi.total_price), 0)::text AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.created_at >= $1 AND o.created_at < $2
         AND o.payment_status IN ('paid', 'partially_paid')
         AND o.status <> 'cancelled'
       GROUP BY 1
       ORDER BY SUM(oi.total_price) DESC
       LIMIT 8`,
      [window.start.toISOString(), window.end.toISOString()]
    ),
    query<{ name: string; value: string }>(
      `SELECT COALESCE(NULLIF(c.name, ''), 'Uncategorized') AS name,
              COALESCE(SUM(oi.total_price), 0)::text AS value
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE o.created_at >= $1 AND o.created_at < $2
         AND o.payment_status IN ('paid', 'partially_paid')
         AND o.status <> 'cancelled'
       GROUP BY 1
       ORDER BY SUM(oi.total_price) DESC`,
      [window.start.toISOString(), window.end.toISOString()]
    ),
  ]);

  const aov = current.ordersPaid > 0 ? current.revenue / current.ordersPaid : 0;
  const prevAov = previous.ordersPaid > 0 ? previous.revenue / previous.ordersPaid : 0;
  const paidRate = current.ordersAll > 0 ? (current.ordersPaid / current.ordersAll) * 100 : 0;
  const prevPaidRate = previous.ordersAll > 0 ? (previous.ordersPaid / previous.ordersAll) * 100 : 0;

  const salesMap = new Map<string, { date: string; sales: number; orders: number; sort: number }>();
  const cursor = new Date(window.start);
  while (cursor < window.end) {
    const key = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    salesMap.set(key, { date: key, sales: 0, orders: 0, sort: cursor.getTime() });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const row of daily) {
    const existing = salesMap.get(row.date);
    if (existing) {
      existing.sales = Number(row.sales);
      existing.orders = Number(row.orders);
    } else {
      salesMap.set(row.date, {
        date: row.date,
        sales: Number(row.sales),
        orders: Number(row.orders),
        sort: 0,
      });
    }
  }

  return {
    range: window.range,
    metrics: {
      revenue: current.revenue,
      revenueGrowth: growth(current.revenue, previous.revenue),
      orders: current.ordersPaid,
      ordersGrowth: growth(current.ordersPaid, previous.ordersPaid),
      aov,
      aovGrowth: growth(aov, prevAov),
      paidRate: Math.round(paidRate * 10) / 10,
      paidRateGrowth: growth(paidRate, prevPaidRate),
      discountTotal: current.discount,
      ordersAll: current.ordersAll,
    },
    sales: [...salesMap.values()],
    topProducts: products.map((p) => ({
      name: p.name,
      units: Number(p.units),
      revenue: Number(p.revenue),
    })),
    categories: categories.map((c) => ({
      name: c.name,
      value: Number(c.value),
    })),
  };
}
