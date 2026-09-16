import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { createOrderFromCheckout } from '@/lib/data/orders';
import { sendAndMarkOrderConfirmation } from '@/lib/notifications';

/** In-store POS checkout (cash / card / immediate paid). */
export async function POST(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
