'use client';

import { useState } from 'react';
import type { AppliedCoupon } from '@/lib/coupon-session';

interface AdvancedCouponSystemProps {
  subtotal: number;
  email?: string;
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
  appliedCoupon: AppliedCoupon | null;
}

export default function AdvancedCouponSystem({
  subtotal,
  email,
  onApply,
  onRemove,
  appliedCoupon,
}: AdvancedCouponSystemProps) {
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleApply = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setError('Enter a coupon code');
      return;
    }

    setChecking(true);
    setError('');
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code, subtotal, email }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        reason?: string;
        error?: string;
        code?: string;
        type?: AppliedCoupon['type'];
        value?: number;
        discount?: number;
        freeShipping?: boolean;
        description?: string | null;
      };
      if (!res.ok) {
        setError(data.error || 'Could not validate coupon');
        return;
      }
      if (!data.valid) {
        setError(data.reason || 'Invalid coupon code');
        return;
      }
      onApply({
        code: data.code || code,
        type: data.type || 'percentage',
        value: Number(data.value) || 0,
        discount: Number(data.discount) || 0,
        freeShipping: Boolean(data.freeShipping),
        description: data.description || undefined,
      });
      setCouponCode('');
    } catch {
      setError('Could not validate coupon. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      {!appliedCoupon ? (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Have a coupon code?</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleApply();
                }
              }}
              placeholder="Enter code"
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso text-sm"
            />
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={checking}
              className="bg-gray-900 hover:bg-brand-cocoa text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-60"
            >
              {checking ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-2 flex items-center">
              <i className="ri-error-warning-line mr-1"></i>
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="bg-brand-nude/30 border-2 border-brand-nude/70 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <i className="ri-price-tag-3-fill text-brand-espresso"></i>
                <span className="font-bold text-brand-cocoa">{appliedCoupon.code}</span>
              </div>
              <p className="text-sm text-brand-espresso">
                {appliedCoupon.freeShipping
                  ? 'Free shipping applied'
                  : appliedCoupon.description || `GH₵${appliedCoupon.discount.toFixed(2)} off`}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="w-8 h-8 flex items-center justify-center text-brand-espresso hover:text-brand-espresso transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
