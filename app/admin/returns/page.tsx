'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiData } from '@/lib/client/api';

type ReturnItem = {
  id: string;
  product_name: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number | null;
  reason: string | null;
};

type ReturnRequest = {
  id: string;
  status: string;
  request_type: string | null;
  reason: string;
  description: string | null;
  admin_notes: string | null;
  created_at: string;
  order_id: string;
  order_number: string;
  email: string;
  phone: string | null;
  customer_name: string | null;
  items: ReturnItem[];
};

const FILTERS = [
  { value: 'open', label: 'Needs action' },
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-[#F6F0E4] text-[#5C4718]',
  processing: 'bg-[#F6F0E4] text-[#5C4718]',
  completed: 'bg-gray-100 text-gray-700',
  rejected: 'bg-red-50 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'New',
  approved: 'Approved',
  processing: 'Item received',
  completed: 'Completed',
  rejected: 'Rejected',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminReturnsPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const rows = await apiData<ReturnRequest[]>('/api/admin/returns');
      setRequests(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load return requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isOpen = (r: ReturnRequest) => ['pending', 'approved', 'processing'].includes(r.status);
  const shown = requests.filter((r) =>
    filter === 'all' ? true : filter === 'open' ? isOpen(r) : r.status === filter
  );
  const count = (value: string) =>
    value === 'all'
      ? requests.length
      : value === 'open'
        ? requests.filter(isOpen).length
        : requests.filter((r) => r.status === value).length;

  const update = async (r: ReturnRequest, status?: string) => {
    setSavingId(r.id);
    setNotice('');
    try {
      const result = await apiData<{ emailed?: boolean }>('/api/admin/returns', {
        method: 'PATCH',
        json: { id: r.id, status, admin_notes: notes[r.id] ?? r.admin_notes ?? '' },
      });
      setNotice(
        status && ['approved', 'rejected', 'completed'].includes(status)
          ? result.emailed
            ? `${r.order_number}: saved and the customer was emailed.`
            : `${r.order_number}: saved. The email did not go out, so tell the customer on WhatsApp.`
          : `${r.order_number}: saved.`
      );
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Returns</h1>
        <p className="text-gray-600 mt-1">Return and exchange requests customers send from the Returns page.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter returns">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border-2 transition-colors ${
              filter === f.value
                ? 'border-store-navy bg-store-navy text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            {f.label} ({count(f.value)})
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="text-sm text-gray-800 bg-white border border-gray-200 rounded-lg px-4 py-3">
          {notice}
        </p>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        {loading ? (
          <ul className="divide-y divide-gray-100" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="p-5">
                <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-72 bg-gray-100 rounded animate-pulse" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-red-700">
            {error}{' '}
            <button type="button" onClick={load} className="underline font-semibold">
              Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-gray-900">
              {requests.length === 0 ? 'No return requests yet' : 'Nothing in this list'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Customers start a return from the Returns page with their order number and email.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((r) => {
              const expanded = openId === r.id;
              const busy = savingId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : r.id)}
                    aria-expanded={expanded}
                    className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">{r.order_number}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {r.request_type === 'exchange' ? 'Exchange' : 'Refund'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {r.customer_name || r.email} · {r.items.length} item{r.items.length === 1 ? '' : 's'} · {r.reason}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(r.created_at)}</span>
                    <i className={`ri-arrow-down-s-line text-xl text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 space-y-4">
                      <dl className="grid sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <dt className="text-gray-500">Customer</dt>
                          <dd className="text-gray-900 break-words">{r.customer_name || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Email</dt>
                          <dd className="text-gray-900 break-all">{r.email}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Phone</dt>
                          <dd className="text-gray-900">
                            {r.phone ? (
                              <a className="underline" href={`https://wa.me/233${r.phone.replace(/\D/g, '').replace(/^(233|0)/, '')}`} target="_blank" rel="noreferrer">
                                {r.phone} (WhatsApp)
                              </a>
                            ) : (
                              '—'
                            )}
                          </dd>
                        </div>
                      </dl>

                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500">
                            <th className="font-medium py-1">Item</th>
                            <th className="font-medium py-1 w-12 text-right">Qty</th>
                            <th className="font-medium py-1 pl-4">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.items.map((item) => (
                            <tr key={item.id} className="border-t border-gray-100 align-top">
                              <td className="py-2 text-gray-900">
                                {item.product_name || 'Item'}
                                {item.variant_name ? <span className="text-gray-500"> · {item.variant_name}</span> : null}
                              </td>
                              <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                              <td className="py-2 pl-4 text-gray-700">{item.reason || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {r.description && <p className="text-sm text-gray-700">Customer notes: {r.description}</p>}

                      <div>
                        <label htmlFor={`notes-${r.id}`} className="block text-sm font-medium text-gray-900 mb-1">
                          Staff notes (customers do not see these)
                        </label>
                        <textarea
                          id={`notes-${r.id}`}
                          rows={2}
                          value={notes[r.id] ?? r.admin_notes ?? ''}
                          onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-base focus:border-store-navy focus:ring-2 focus:ring-store-primary/20"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {r.status === 'pending' && (
                          <>
                            <button type="button" disabled={busy} onClick={() => update(r, 'approved')} className="px-4 py-2 bg-store-navy hover:bg-store-navy-light text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                              Approve and email customer
                            </button>
                            <button type="button" disabled={busy} onClick={() => update(r, 'rejected')} className="px-4 py-2 border-2 border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-semibold disabled:opacity-50">
                              Reject and email customer
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && (
                          <button type="button" disabled={busy} onClick={() => update(r, 'processing')} className="px-4 py-2 bg-store-navy hover:bg-store-navy-light text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                            Item received
                          </button>
                        )}
                        {(r.status === 'approved' || r.status === 'processing') && (
                          <button type="button" disabled={busy} onClick={() => update(r, 'completed')} className="px-4 py-2 border-2 border-gray-300 text-gray-800 hover:bg-gray-50 rounded-lg text-sm font-semibold disabled:opacity-50">
                            Mark completed
                          </button>
                        )}
                        <button type="button" disabled={busy} onClick={() => update(r)} className="px-4 py-2 border-2 border-gray-300 text-gray-800 hover:bg-gray-50 rounded-lg text-sm font-semibold disabled:opacity-50">
                          {busy ? 'Saving…' : 'Save notes'}
                        </button>
                        <Link href={`/admin/orders/${r.order_id}`} className="px-4 py-2 text-sm font-semibold text-store-ink underline underline-offset-4">
                          Open order
                        </Link>
                      </div>
                      <p className="text-xs text-gray-500">
                        Refunds are paid outside the website. Cancelling the order on its page puts the stock back.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
