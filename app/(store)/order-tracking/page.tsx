'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiData } from '@/lib/client/api';
import EditorialHero from '@/components/EditorialHero';
import { PAGE_HERO_IMAGES } from '@/lib/brand';
import {
  formatDeliveryMethod,
  deliveryMethodHint,
  isStorePickup,
  pickupLocation,
  resolveDeliveryMethod,
} from '@/lib/delivery';

function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const urlOrderNumber = searchParams.get('order') || '';

  const [orderNumber, setOrderNumber] = useState(urlOrderNumber);
  const [email, setEmail] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const urlEmail = searchParams.get('email') || '';

  const fetchOrder = useCallback(async (orderNum: string, verifyEmail?: string) => {
    const emailToVerify = verifyEmail || email;

    if (!emailToVerify) {
      setError('Please enter your email address to verify your identity.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiData<Record<string, unknown>>('/api/orders/track', {
        method: 'POST',
        json: { email: emailToVerify, order_number: orderNum },
      });

      setOrder(data);
      setIsTracking(true);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Order not found or email does not match. Please check your details and try again.');
      setIsTracking(false);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (urlOrderNumber && urlEmail) {
      setEmail(urlEmail);
      fetchOrder(urlOrderNumber, urlEmail);
    }
  }, [urlOrderNumber, urlEmail, fetchOrder]);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orderNumber) {
      setError('Please enter your order number');
      return;
    }

    if (!email) {
      setError('Please enter your email address for verification');
      return;
    }

    fetchOrder(orderNumber, email);
  };

  const getTrackingSteps = () => {
    if (!order) return [];

    const status = order.status || 'pending';
    const paymentStatus = order.payment_status || 'pending';

    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(status);

    const pickup = isStorePickup(resolveDeliveryMethod(order));
    return [
      {
        key: 'placed',
        title: 'Order placed',
        description: 'Your order has been confirmed',
        date: new Date(order.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        icon: 'ri-checkbox-circle-line',
        status: 'completed' as const,
      },
      {
        key: 'payment',
        title: 'Payment',
        description: paymentStatus === 'paid' ? 'Payment confirmed' : 'Awaiting payment',
        date: paymentStatus === 'paid'
          ? (order.metadata?.payment_verified_at
            ? new Date(order.metadata.payment_verified_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Confirmed')
          : 'Pending',
        icon: 'ri-bank-card-line',
        status: paymentStatus === 'paid' ? 'completed' as const : 'pending' as const,
      },
      {
        key: 'processing',
        title: 'Processing',
        description: 'Your order is being prepared',
        date: currentIndex >= 1 ? 'In progress' : 'Pending',
        icon: 'ri-box-3-line',
        status: currentIndex >= 1 ? 'completed' as const : currentIndex === 0 && paymentStatus === 'paid' ? 'active' as const : 'pending' as const,
      },
      {
        key: 'shipped',
        title: pickup ? 'Ready for pickup' : 'Packaged',
        description: pickup ? 'Your order is ready to collect' : 'Your order has been packaged',
        date: currentIndex >= 2 ? (pickup ? 'Ready' : 'Packaged') : 'Pending',
        icon: pickup ? 'ri-store-2-line' : 'ri-truck-line',
        status: currentIndex >= 2 ? 'completed' as const : currentIndex === 1 ? 'active' as const : 'pending' as const,
      },
      {
        key: 'delivered',
        title: pickup ? 'Collected' : 'Delivered',
        description: pickup ? 'You have collected your order' : 'Your order has been delivered',
        date: currentIndex >= 3 ? (pickup ? 'Collected' : 'Delivered') : 'Pending',
        icon: pickup ? 'ri-hand-heart-line' : 'ri-home-smile-line',
        status: currentIndex >= 3 ? 'completed' as const : currentIndex === 2 ? 'active' as const : 'pending' as const,
      },
    ];
  };

  const getStatusBadge = () => {
    if (!order) return { label: 'Unknown', color: 'bg-[#F4F2EE] text-brand-espresso' };
    const pickup = isStorePickup(resolveDeliveryMethod(order));

    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'bg-[#F4F2EE] text-brand-espresso' },
      processing: { label: 'Processing', color: 'bg-black text-white' },
      shipped: { label: pickup ? 'Ready for pickup' : 'Packaged', color: 'bg-brand-champagne text-black' },
      delivered: { label: pickup ? 'Collected' : 'Delivered', color: 'bg-brand-champagne text-black' },
      cancelled: { label: 'Cancelled', color: 'bg-black text-white' },
    };

    return statusMap[order.status] || { label: order.status, color: 'bg-[#F4F2EE] text-brand-espresso' };
  };

  if (!isTracking || !order) {
    return (
      <main className="bg-white">
        <EditorialHero
          eyebrow="Orders"
          title="Track your order"
          subtitle="Enter the order number and the email used at checkout."
          image={PAGE_HERO_IMAGES.cart}
        />

        <section className="mx-auto max-w-xl px-4 py-14 sm:px-6 md:py-16">
          <form onSubmit={handleTrack} className="space-y-5 rounded-[1.5rem] border border-black/[0.08] p-6 sm:p-8">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Order number</span>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="mt-2 h-12 w-full rounded-full bg-[#F4F2EE] px-5 text-sm outline-none placeholder:text-brand-mauve focus:ring-1 focus:ring-brand-champagne"
                placeholder="e.g. ORD-1770328211911-915"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-12 w-full rounded-full bg-[#F4F2EE] px-5 text-sm outline-none placeholder:text-brand-mauve focus:ring-1 focus:ring-brand-champagne"
                placeholder="you@example.com"
                required
              />
            </label>

            {error && (
              <p className="rounded-2xl border border-black/10 bg-[#F4F2EE] px-4 py-3 text-sm text-brand-espresso">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-black text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-champagne hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? 'Searching…' : 'Track order'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm leading-relaxed text-brand-mauve">
            Your order number is in the SMS or email we sent after checkout.
          </p>
        </section>
      </main>
    );
  }

  const trackingSteps = getTrackingSteps();
  const statusBadge = getStatusBadge();
  const trackingNumber = order.metadata?.tracking_number || '';
  const shippingAddress = order.shipping_address || {};
  const deliveryMethod = resolveDeliveryMethod(order);
  const pickup = isStorePickup(deliveryMethod);
  const deliveryLabel = formatDeliveryMethod(deliveryMethod);
  const deliveryHint = deliveryMethodHint(deliveryMethod);
  const estimatedDelivery = new Date(new Date(order.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <main className="bg-white">
      <EditorialHero
        eyebrow="Orders"
        title={order.order_number}
        subtitle={pickup ? `${deliveryLabel} · Ready in 24 hours` : `${deliveryLabel} · Estimated ${estimatedDelivery}`}
        image={PAGE_HERO_IMAGES.cart}
      />

      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
        <button
          type="button"
          onClick={() => { setIsTracking(false); setOrder(null); setOrderNumber(''); setEmail(''); }}
          className="text-sm font-medium text-brand-champagne"
        >
          Track another order
        </button>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            {trackingNumber && (
              <p className="text-sm text-brand-mauve">
                Tracking <span className="font-medium text-brand-espresso">{trackingNumber}</span>
              </p>
            )}
            {deliveryHint && <p className="mt-1 text-sm text-brand-mauve">{deliveryHint}</p>}
          </div>
          <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${statusBadge.color}`}>{statusBadge.label}</span>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#F4F2EE] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">{pickup ? 'Pickup' : 'Shipping to'}</p>
            <p className="mt-2 font-medium text-brand-espresso">
              {pickup ? pickupLocation() : shippingAddress.city || shippingAddress.region || 'Ghana'}
            </p>
          </div>
          <div className="rounded-2xl bg-[#F4F2EE] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Total</p>
            <p className="mt-2 font-medium tabular-nums text-brand-espresso">GH₵{Number(order.total).toFixed(2)}</p>
          </div>
          <div className="rounded-2xl bg-[#F4F2EE] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Items</p>
            <p className="mt-2 font-medium text-brand-espresso">
              {order.order_items?.length || 0} product{(order.order_items?.length || 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <ol className="mt-12">
          {trackingSteps.map((step, index) => (
            <li key={step.key} className="grid grid-cols-[2.5rem_1fr] gap-4 pb-8 last:pb-0">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    step.status === 'completed'
                      ? 'bg-black text-brand-champagne'
                      : step.status === 'active'
                        ? 'bg-brand-champagne text-black'
                        : 'bg-[#F4F2EE] text-brand-mauve'
                  }`}
                >
                  <i className={`${step.icon} text-lg`} aria-hidden />
                </span>
                {index < trackingSteps.length - 1 && (
                  <span className={`mt-2 w-px flex-1 ${step.status === 'completed' ? 'bg-brand-champagne' : 'bg-black/10'}`} />
                )}
              </div>
              <div className="pt-1.5">
                <h2 className={`text-lg font-semibold tracking-tight ${step.status === 'pending' ? 'text-brand-mauve' : 'text-brand-espresso'}`}>
                  {step.title}
                </h2>
                <p className="mt-1 text-sm text-brand-cocoa/75">{step.description}</p>
                <p className="mt-1 text-sm font-medium text-brand-champagne">{step.date}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 border-t border-black/[0.08] pt-10">
          <h2 className="text-2xl font-semibold tracking-tight text-brand-espresso">Order items</h2>
          <ul className="mt-6 space-y-3">
            {order.order_items?.map((item: any) => (
              <li key={item.id} className="flex items-center gap-4 rounded-2xl bg-[#F4F2EE] p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                  {item.products?.product_images?.[0]?.url || item.metadata?.image ? (
                    <img
                      src={item.products?.product_images?.[0]?.url || item.metadata?.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-brand-champagne">
                      <i className="ri-image-line text-xl" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-espresso">{item.product_name}</p>
                  <p className="text-sm text-brand-mauve">Qty {item.quantity}</p>
                  {item.variant_name && <p className="text-xs text-brand-mauve">{item.variant_name}</p>}
                </div>
                <p className="text-sm font-semibold tabular-nums">GH₵{Number(item.unit_price).toFixed(2)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/contact" className="inline-flex h-11 items-center rounded-full bg-black px-6 text-sm font-semibold text-white hover:bg-brand-champagne hover:text-black">
            Contact us
          </Link>
          <Link href="/returns" className="inline-flex h-11 items-center rounded-full border border-black/15 px-6 text-sm font-medium text-brand-espresso">
            Returns policy
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[50vh] items-center justify-center bg-white">
          <p className="text-sm text-brand-mauve">Loading order tracking…</p>
        </main>
      }
    >
      <OrderTrackingContent />
    </Suspense>
  );
}
