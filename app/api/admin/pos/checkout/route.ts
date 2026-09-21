import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { createOrderFromCheckout } from '@/lib/data/orders';
import { sendAndMarkOrderConfirmation } from '@/lib/notifications';
import { allow } from '@/lib/staff-gate';

/** In-store POS checkout (cash / card / immediate paid). */
export async function POST(request: Request) {
  const gate = await allow(request, 'pos.use');
  if (gate.denied) return gate.denied;
  const auth = gate.auth;

  try {
    const body = await request.json();
    const {
      orderNumber,
      trackingNumber,
      shippingData,
      cart,
      paymentMethod = 'cash',
      markPaid = true,
      deliveryMethod = 'pickup',
    } = body;

    if (!orderNumber || !cart?.length || !shippingData?.email) {
      return NextResponse.json({ error: 'Invalid POS payload' }, { status: 400 });
    }

    const order = await createOrderFromCheckout({
      userId: null,
      orderNumber,
      trackingNumber: trackingNumber || `SLI-POS-${Date.now()}`,
      shippingData,
      deliveryMethod,
      paymentMethod,
      cart,
      shippingCost: 0,
      tax: 0,
      channel: 'pos',
      placedBy: auth.user?.id || null,
    });

    if (markPaid) {
      await queryOne(`SELECT mark_order_paid($1::text, $2::text, $3::numeric) AS result`, [
        order.order_number,
        `pos-${paymentMethod}`,
        order.total,
      ]);
      if (order.email) {
        try {
          await query(`SELECT update_customer_stats($1, $2)`, [order.email, order.total]);
        } catch (statsErr) {
          console.error('[pos/checkout] customer stats', statsErr);
        }
      }
    }

    const paid = await queryOne(`SELECT * FROM orders WHERE id = $1::uuid`, [order.id]);
    await noteAction(request, auth.user?.id, 'pos.sale', 'order', order.id, {
      order_number: order.order_number,
      total: order.total,
      payment_method: paymentMethod,
    });
    if (markPaid) {
      await sendAndMarkOrderConfirmation((paid || order) as Record<string, unknown>);
    }
    return NextResponse.json(paid || order, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'POS checkout failed';
    console.error('[pos/checkout]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
