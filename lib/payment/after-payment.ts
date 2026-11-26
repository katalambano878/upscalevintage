import { query, queryOne } from '@/lib/db';
import { applyCouponUsageForOrder } from '@/lib/coupons';
import { sendOrderConfirmation } from '@/lib/notifications';

type PaidOrderJson = Record<string, unknown> & {
  order_number?: string;
  email?: string;
  total?: number | string;
  payment_status?: string;
  newly_paid?: boolean;
};

/**
 * Runs the one-time steps after an order becomes paid: count the coupon use,
 * update the customer's totals and send the confirmation.
 *
 * The Moolre callback and the customer's verify call can both arrive for the
 * same payment. `newly_paid` comes from mark_order_paid, which locks the order
 * row, so only the call that actually moved the order to paid runs these.
 */
export async function runAfterPayment(order: PaidOrderJson, tag: string): Promise<void> {
  if (order.payment_status !== 'paid') return;
  // Before migration 0008, mark_order_paid did not report newly_paid. Then fall
  // back to the per-step guards below (coupon flag, confirmation claim).
  if (order.newly_paid === false) return;

  try {
    await applyCouponUsageForOrder(order);
  } catch (err) {
    console.error(`[${tag}] Coupon usage failed:`, err);
  }

  if (order.email) {
    try {
      await query(`SELECT update_customer_stats($1, $2)`, [String(order.email), Number(order.total)]);
    } catch (err) {
      console.error(`[${tag}] Customer stats failed:`, err);
    }
  }

  // Claim the confirmation atomically so it is sent once.
  const claimed = await queryOne<{ id: string }>(
    `UPDATE orders
        SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
      WHERE order_number = $1 AND (metadata->>'confirmation_sent_at') IS NULL
      RETURNING id`,
    [order.order_number, JSON.stringify({ confirmation_sent_at: new Date().toISOString() })]
  );
  if (!claimed) return;

  try {
    await sendOrderConfirmation(order);
  } catch (err) {
    console.error(`[${tag}] Notification failed:`, err);
    // Let a later call try again.
    await query(
      `UPDATE orders SET metadata = metadata - 'confirmation_sent_at' WHERE order_number = $1`,
      [order.order_number]
    ).catch(() => undefined);
  }
}
