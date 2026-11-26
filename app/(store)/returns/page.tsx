'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHero from '@/components/PageHero';
import RefundPolicySection from '@/components/RefundPolicySection';
import { usePageTitle } from '@/hooks/usePageTitle';
import { REFUND_POLICY } from '@/lib/brand';

type ReturnableItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  image: string | null;
};

type FoundOrder = {
  order_number: string;
  created_at: string;
  items: ReturnableItem[];
};

export default function ReturnsPage() {
  usePageTitle('Returns & Refunds');
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [returnType, setReturnType] = useState<'refund' | 'exchange'>('refund');
  const [isLoading, setIsLoading] = useState(false);
  const [foundOrder, setFoundOrder] = useState<FoundOrder | null>(null);

  const reasons = [...REFUND_POLICY.refundReasons, 'Other (describe in notes to support)'];

  const callReturns = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, email, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  };

  const handleFindOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const data = await callReturns({ action: 'lookup' });
      setFoundOrder({ ...data.order, items: data.items || [] });
      setSelectedItems([]);
      setReturnReasons({});
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find that order.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSubmitReturn = async () => {
    setError('');
    setIsLoading(true);
    try {
      await callReturns({
        action: 'submit',
        returnType,
        items: selectedItems.map((id) => ({ orderItemId: id, reason: returnReasons[id] })),
      });
      router.push('/returns/confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request.');
      setIsLoading(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-brand-cream">
      <PageHero
        title="Returns & Refunds"
        subtitle="Read our refund policy below, then start a return or exchange request with your order details."
        backgroundImage="/hero/hero-contact.png"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-14">
        <RefundPolicySection />

        <div id="returns-portal">
          <div className="text-center mb-8">
            <span className="brand-eyebrow mb-3 block">Start a request</span>
            <h2 className="text-2xl sm:text-3xl font-display font-semibold text-brand-espresso tracking-tight">
              Returns portal
            </h2>
            <p className="brand-body mt-3 max-w-lg mx-auto">
              Enter your order number and email to begin. Exchanges must meet the 24 hour window in our policy above.
            </p>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center flex-1">
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${
                      i <= step ? 'bg-brand-espresso text-brand-cream' : 'bg-brand-nude text-brand-cocoa/50'
                    }`}
                  >
                    {i < step ? <i className="ri-check-line" /> : i}
                  </div>
                  {i < 3 && (
                    <div
                      className={`flex-1 h-1 mx-2 sm:mx-4 ${i < step ? 'bg-brand-espresso' : 'bg-brand-nude'}`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs sm:text-sm font-medium text-brand-cocoa/80">
              <span>Find order</span>
              <span>Select items</span>
              <span>Submit</span>
            </div>
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl border border-brand-nude shadow-soft p-6 sm:p-8">
              <h3 className="text-xl font-display font-semibold text-brand-espresso mb-6">Find your order</h3>
              <form onSubmit={handleFindOrder} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-brand-espresso mb-2">Order number *</label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full px-4 py-3 border border-brand-nude rounded-xl bg-brand-cream text-brand-cocoa focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-mauve"
                    placeholder="ORD-1700000000000-123"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-brand-espresso mb-2">Email address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-brand-nude rounded-xl bg-brand-cream text-brand-cocoa focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-mauve"
                    placeholder="you@example.com"
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-red-600">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full btn-luxury-primary py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Finding order…' : 'Find order'}
                </button>
              </form>

              <p className="brand-body text-sm mt-6 text-brand-cocoa/80">
                Prefer to talk first?{' '}
                <Link href="/contact" className="font-semibold text-brand-espresso hover:text-brand-mauve">
                  Contact us
                </Link>{' '}
                with your order number before sending anything back.
              </p>
            </div>
          )}

          {step === 2 && foundOrder && (
            <div className="bg-white rounded-2xl border border-brand-nude shadow-soft p-6 sm:p-8">
              <h3 className="text-xl font-display font-semibold text-brand-espresso mb-6">Select items to return</h3>

              <div className="mb-6 p-4 bg-brand-nude/30 rounded-xl border border-brand-nude">
                <p className="text-sm font-medium text-brand-cocoa/80">
                  Order #{foundOrder.order_number} · Placed on {formatDate(foundOrder.created_at)}
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {foundOrder.items.map((item) => (
                  <div key={item.id} className="border border-brand-nude rounded-xl p-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="mt-1 w-5 h-5 text-brand-espresso rounded border-brand-nude focus:ring-brand-mauve/40"
                      />
                      <div className="w-20 h-20 shrink-0 bg-brand-nude/40 rounded-lg overflow-hidden">
                        {item.image && (
                          <img src={item.image} alt={item.product_name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-brand-espresso mb-1">
                          {item.product_name}
                          {item.variant_name ? ` · ${item.variant_name}` : ''}
                          {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                        </p>
                        <p className="text-lg font-semibold text-brand-espresso mb-3">
                          GH₵{Number(item.unit_price).toFixed(2)}
                        </p>
                        {selectedItems.includes(item.id) && (
                          <div className="mt-2">
                            <label className="block text-sm font-semibold text-brand-espresso mb-2">
                              Reason *
                            </label>
                            <select
                              value={returnReasons[item.id] || ''}
                              onChange={(e) =>
                                setReturnReasons({ ...returnReasons, [item.id]: e.target.value })
                              }
                              className="w-full px-4 py-2 border border-brand-nude rounded-xl bg-brand-cream focus:ring-2 focus:ring-brand-mauve/40"
                              required
                            >
                              <option value="">Select a reason</option>
                              {reasons.map((reason) => (
                                <option key={reason} value={reason}>
                                  {reason}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mb-8">
                <label className="block text-sm font-semibold text-brand-espresso mb-3">What would you like? *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setReturnType('refund')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      returnType === 'refund'
                        ? 'border-brand-espresso bg-brand-nude/40'
                        : 'border-brand-nude hover:border-brand-mauve/40'
                    }`}
                  >
                    <i className="ri-refund-line text-2xl text-brand-espresso mb-2" />
                    <p className="font-semibold text-brand-espresso">Refund</p>
                    <p className="text-sm text-brand-cocoa/75 mt-1 font-medium">When policy conditions apply</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturnType('exchange')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      returnType === 'exchange'
                        ? 'border-brand-espresso bg-brand-nude/40'
                        : 'border-brand-nude hover:border-brand-mauve/40'
                    }`}
                  >
                    <i className="ri-exchange-line text-2xl text-brand-espresso mb-2" />
                    <p className="font-semibold text-brand-espresso">Exchange</p>
                    <p className="text-sm text-brand-cocoa/75 mt-1 font-medium">Within 24 hours of purchase</p>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border-2 border-brand-nude text-brand-espresso rounded-xl font-semibold hover:bg-brand-nude/30 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={
                    selectedItems.length === 0 || !selectedItems.every((id) => returnReasons[id])
                  }
                  className="flex-1 py-4 btn-luxury-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && foundOrder && (
            <div className="bg-white rounded-2xl border border-brand-nude shadow-soft p-6 sm:p-8">
              <h3 className="text-xl font-display font-semibold text-brand-espresso mb-6">Review & submit</h3>

              <div className="mb-8">
                <h4 className="font-semibold text-brand-espresso mb-4">Return summary</h4>
                <div className="space-y-3">
                  {foundOrder.items
                    .filter((item) => selectedItems.includes(item.id))
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-brand-nude/25 rounded-xl border border-brand-nude/60"
                      >
                        <div>
                          <p className="font-semibold text-brand-espresso">{item.product_name}</p>
                          <p className="text-sm text-brand-cocoa/75 font-medium">
                            {returnType === 'exchange' ? 'Exchange' : 'Refund'} · {returnReasons[item.id]}
                          </p>
                        </div>
                        <p className="font-semibold text-brand-espresso">
                          GH₵{(Number(item.unit_price) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              <div className="mb-8 p-6 border border-brand-mauve/25 bg-brand-mauve/10 rounded-xl">
                <h4 className="font-semibold text-brand-espresso mb-4">Next steps</h4>
                <ol className="space-y-2 brand-body text-sm">
                  <li>
                    <span className="font-semibold text-brand-espresso">1.</span> Our team will confirm your request
                    matches the refund policy.
                  </li>
                  <li>
                    <span className="font-semibold text-brand-espresso">2.</span> Pack items unworn, with tags and
                    original packaging.
                  </li>
                  <li>
                    <span className="font-semibold text-brand-espresso">3.</span> Bring to store or follow instructions
                    we send by WhatsApp or email.
                  </li>
                  <li>
                    <span className="font-semibold text-brand-espresso">4.</span> Exchanges must be within 24 hours of
                    purchase.
                  </li>
                </ol>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 mb-4">
                  {error}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 border-2 border-brand-nude text-brand-espresso rounded-xl font-semibold hover:bg-brand-nude/30 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReturn}
                  disabled={isLoading}
                  className="flex-1 py-4 btn-luxury-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Submitting…' : 'Submit return request'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
