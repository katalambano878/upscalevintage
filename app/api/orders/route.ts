import { randomInt } from 'node:crypto';
import { fail, ok, route } from '@/lib/api';
import { getUserIdFromRequest, isStaffRole, verifyAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
    createOrderFromCheckout,
    listOrdersAdmin,
    listOrdersForUser,
} from '@/lib/data/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
    const auth = await verifyAuth(request);
    const userId = await getUserIdFromRequest(request);

    const mineOnly = new URL(request.url).searchParams.get('scope') === 'mine';

    if (!mineOnly && auth.authenticated && auth.user && isStaffRole(auth.role || auth.user.role)) {
        if (!can(auth.user, 'orders.view')) {
            return fail('You do not have permission to do that.', 403, 'forbidden');
        }
        return ok(await listOrdersAdmin());
    }

    if (userId) {
        return ok(await listOrdersForUser(userId));
    }

    return fail('You must be signed in.', 401, 'unauthenticated');
});

function newOrderNumber(): string {
    return `ORD-${Date.now()}-${randomInt(100, 1000)}`;
}

function newTrackingNumber(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += alphabet[randomInt(0, alphabet.length)];
    return `SLI-${id}`;
}

export const POST = route(async (request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const {
        shippingData,
        deliveryMethod = 'pickup',
        paymentMethod = 'moolre',
        paymentOption = 'full',
        cart,
        couponCode = null,
    } = body;

    if (!shippingData || typeof shippingData !== 'object' || !Array.isArray(cart) || !cart.length) {
        return fail('Invalid checkout payload.', 400, 'validation_error');
    }

    if (paymentOption && paymentOption !== 'full') {
        return fail('Only full payment is available.', 400, 'validation_error');
    }

    // Online orders are paid by Moolre. Other methods (cash, card) are for the till only.
    if (String(paymentMethod) !== 'moolre') {
        return fail('Please pay with Mobile Money.', 400, 'validation_error');
    }

    const DELIVERY_METHODS = ['pickup', 'doorstep', 'accra', 'outside-accra'];
    const method = DELIVERY_METHODS.includes(String(deliveryMethod)) ? String(deliveryMethod) : 'pickup';

    const shipping = Object.fromEntries(
        Object.entries(shippingData as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '').trim()])
    ) as Record<string, string>;
    shipping.email = (shipping.email || '').toLowerCase();
    for (const key of ['firstName', 'lastName', 'email', 'phone']) {
        if (!shipping[key]) {
            return fail('Please fill in your name, email and phone number.', 400, 'validation_error');
        }
    }
    if (method !== 'pickup' && (!shipping.address || !shipping.city || !shipping.region)) {
        return fail('Please fill in your delivery address.', 400, 'validation_error');
    }

    const userId = await getUserIdFromRequest(request);

    // The order number, shipping and tax are set here, never taken from the
    // browser. Doorstep delivery is quoted to the customer after the order.
    const order = await createOrderFromCheckout({
        userId,
        // Pages loaded before this change still send their own number and then
        // pay with it, so honour one in the standard format; otherwise make one.
        orderNumber: /^ORD-\d{10,16}-\d{1,4}$/.test(String(body.orderNumber || ''))
            ? String(body.orderNumber)
            : newOrderNumber(),
        trackingNumber: /^SLI-[A-Z0-9]{6}$/.test(String(body.trackingNumber || ''))
            ? String(body.trackingNumber)
            : newTrackingNumber(),
        shippingData: shipping,
        deliveryMethod: method,
        paymentMethod: 'moolre',
        paymentOption: 'full',
        cart: cart as Parameters<typeof createOrderFromCheckout>[0]['cart'],
        shippingCost: 0,
        tax: 0,
        couponCode: couponCode ? String(couponCode) : null,
    });

    return ok(order, { status: 201 });
});
