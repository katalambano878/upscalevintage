'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiData } from '@/lib/client/api';
import { asNumber, money } from '@/lib/format-money';
import { parseStorePricingValue } from '@/lib/pricing';

type SaleProduct = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  status: string;
  price: number;
  sale_price?: number | null;
  quantity?: number;
  categories?: { name?: string } | null;
};

export default function AdminSalesPage() {
  const [enabled, setEnabled] = useState(false);
  const [effective, setEffective] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [headline, setHeadline] = useState('');
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [percentOff, setPercentOff] = useState('10');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const me = await apiData<{ user: { role: string } | null }>('/api/auth/me');
      setIsAdmin(me.user?.role === 'admin');

      const [settingsRes, catalog] = await Promise.all([
        apiData<{ settings: { store_pricing?: unknown } }>('/api/settings?keys=store_pricing'),
        apiData<SaleProduct[]>('/api/catalog/products?status=all&sort=newest'),
      ]);

      const parsed = parseStorePricingValue(settingsRes.settings?.store_pricing);
      setEnabled(parsed.enabled);
      setEffective(parsed.sales_active);
      setStartsAt(parsed.starts_at ? parsed.starts_at.slice(0, 16) : '');
      setEndsAt(parsed.ends_at ? parsed.ends_at.slice(0, 16) : '');
      setHeadline(parsed.headline || '');
      setProducts(Array.isArray(catalog) ? catalog : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const eligible = useMemo(
    () =>
      products.filter((p) => asNumber(p.sale_price) > 0 && asNumber(p.sale_price) < asNumber(p.price)),
    [products]
  );

  const missingSale = useMemo(
    () => products.filter((p) => p.status === 'active' && !(asNumber(p.sale_price) > 0)),
    [products]
  );

  const catalog = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (product.status === 'archived') return false;
      if (!term) return true;
      const category = product.categories?.name || '';
      return (
        product.name.toLowerCase().includes(term) ||
        (product.sku || '').toLowerCase().includes(term) ||
        category.toLowerCase().includes(term)
      );
    });
  }, [products, search]);

  const allVisibleSelected = catalog.length > 0 && catalog.every((product) => selected.has(product.id));

  const avgOff = useMemo(() => {
    if (!eligible.length) return 0;
    const pcts = eligible.map((p) => {
      const price = asNumber(p.price);
      const sale = asNumber(p.sale_price);
      return price > 0 ? ((price - sale) / price) * 100 : 0;
    });
    return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [eligible]);

  const savePricing = async (next: {
    sales_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    headline: string;
  }) => {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiData('/api/settings', {
        method: 'PUT',
        json: {
          settings: {
            store_pricing: next,
          },
          category: 'pricing',
        },
      });
      const parsed = parseStorePricingValue(next);
      setEnabled(parsed.enabled);
      setEffective(parsed.sales_active);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const currentPayload = () => ({
    sales_active: enabled,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    headline: headline.trim(),
  });

  const toggleProduct = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) catalog.forEach((product) => next.delete(product.id));
      else catalog.forEach((product) => next.add(product.id));
      return next;
    });
  };

  const updateSelectedPrices = async (action: 'apply' | 'clear') => {
    if (!isAdmin) return;
    if (selected.size === 0) {
      setError('Select at least one product.');
      return;
    }

    setApplying(true);
    setError(null);
    setSaved(false);
    try {
      await apiData('/api/admin/sales/products', {
        method: 'POST',
        json: {
          action,
          product_ids: [...selected],
          percent: action === 'apply' ? Number(percentOff) : undefined,
        },
      });
      setSaved(true);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update products');
    } finally {
      setApplying(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setEnabled(next);
    await savePricing({ ...currentPayload(), sales_active: next });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        <i className="ri-loader-4-line text-3xl animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-sans tracking-normal">Sale pricing</h1>
        <p className="text-gray-600 mt-1 font-sans tracking-normal">
          Turn store-wide sale pricing on or off. When active, eligible products show sale prices on the
          storefront.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
      )}
      {saved && (
        <div className="p-3 bg-store-surface border border-gray-200 rounded-lg text-store-ink text-sm">
          Sale settings saved.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Storefront</p>
          <p className="text-2xl font-bold text-gray-900">{effective ? 'On sale' : 'Regular'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Eligible products</p>
          <p className="text-2xl font-bold text-gray-900">{eligible.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Average discount</p>
          <p className="text-2xl font-bold text-gray-900">{avgOff}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Active without sale price</p>
          <p className="text-2xl font-bold text-gray-900">{missingSale.length}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">Sales mode</p>
            <p className="text-sm text-gray-500">
              {effective
                ? 'Sale prices are visible to customers.'
                : enabled
                  ? 'Toggle is on, but the schedule window is not active yet.'
                  : 'Only regular prices are shown.'}
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin || saving}
            onClick={() => handleToggle(!enabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              enabled ? 'bg-store-navy' : 'bg-gray-300'
            } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-pressed={enabled}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        {!isAdmin && (
          <p className="text-xs text-amber-700 mt-4">Only admins can change this setting.</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 font-sans tracking-normal">Schedule and headline</h2>
          <p className="text-sm text-gray-500 mt-1">
            Optional window. Leave dates empty to follow the toggle only.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Starts</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Ends</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Storefront headline</label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Weekend sale — extra off selected pieces"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
          />
        </div>
        <button
          type="button"
          disabled={!isAdmin || saving}
          onClick={() => savePricing(currentPayload())}
          className="px-5 py-3 bg-store-navy text-white rounded-lg font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save schedule'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-sans tracking-normal">Products for the sale</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tick the pieces to include, or select all. The discount is saved as each product&apos;s sale price
                and shows on the storefront while sales mode is on.
              </p>
            </div>
            <p className="text-sm font-semibold text-gray-900">{selected.size} selected</p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="block flex-1">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, SKU, or category"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
              />
            </label>
            <label className="block w-full lg:w-36">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Percent off</span>
              <input
                type="number"
                min="1"
                max="99"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg"
              />
            </label>
            <button
              type="button"
              disabled={!isAdmin || applying || selected.size === 0}
              onClick={() => updateSelectedPrices('apply')}
              className="px-5 py-3 bg-store-navy text-white rounded-lg font-semibold disabled:opacity-60"
            >
              {applying ? 'Saving…' : 'Apply to selected'}
            </button>
            <button
              type="button"
              disabled={!isAdmin || applying || selected.size === 0}
              onClick={() => updateSelectedPrices('clear')}
              className="px-5 py-3 border border-gray-300 rounded-lg font-semibold text-gray-800 disabled:opacity-60"
            >
              Remove from sale
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-3 pl-6 pr-2 text-left">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisible}
                    aria-label="Select all products"
                    className="h-4 w-4"
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Regular</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sale</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Savings</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No products match this search.
                  </td>
                </tr>
              ) : (
                catalog.map((p) => {
                  const price = asNumber(p.price);
                  const sale = asNumber(p.sale_price);
                  const onSale = sale > 0 && sale < price;
                  const save = onSale ? price - sale : 0;
                  return (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-3 pl-6 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleProduct(p.id)}
                          aria-label={`Include ${p.name}`}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/products/${p.id}`} className="font-medium text-gray-900 hover:underline">
                          {p.name}
                        </Link>
                        <p className="text-xs text-gray-500">{p.categories?.name || p.sku || p.slug}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-700">GH₵{money(price)}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {onSale ? `GH₵${money(sale)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-store-ink">
                        {onSale ? `GH₵${money(save)} (${price > 0 ? Math.round((save / price) * 100) : 0}%)` : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{onSale ? 'On sale' : p.status}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
