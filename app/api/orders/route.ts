import { fail, ok, route } from '@/lib/api';
import { getUserIdFromRequest, isStaffRole, verifyAuth } from '@/lib/auth';
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

    if (auth.authenticated && auth.user && isStaffRole(auth.role || auth.user.role)) {
        return ok(await listOrdersAdmin());
    }

    if (userId) {
        return ok(await listOrdersForUser(userId));
    }

    return fail('You must be signed in.', 401, 'unauthenticated');
});

export const POST = route(async (request) => {
    const body = (await request.json()) as Record<string, unknown>;
    const {
        orderNumber,
        trackingNumber,
        shippingData,
        deliveryMethod = 'pickup',
        paymentMethod = 'moolre',
        paymentOption = 'full',
        cart,
        shippingCost = 0,
        tax = 0,
    } = body;

    if (
        !orderNumber ||
        !trackingNumber ||
        !shippingData ||
        !Array.isArray(cart) ||
        !cart.length
    ) {
        return fail('Invalid checkout payload.', 400, 'validation_error');
    }

    if (paymentOption !== 'full' && paymentOption !== 'half') {
        return fail('Invalid payment option.', 400, 'validation_error');
    }

    const userId = await getUserIdFromRequest(request);

    const order = await createOrderFromCheckout({
        userId,
        orderNumber: String(orderNumber),
        trackingNumber: String(trackingNumber),
        shippingData: shippingData as Record<string, string>,
        deliveryMethod: String(deliveryMethod),
        paymentMethod: String(paymentMethod),
        paymentOption: String(paymentOption),
        cart: cart as Parameters<typeof createOrderFromCheckout>[0]['cart'],
        shippingCost: Number(shippingCost) || 0,
        tax: Number(tax) || 0,
    });

    return ok(order, { status: 201 });
});
