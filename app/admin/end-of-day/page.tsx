'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiData } from '@/lib/client/api';
import { money } from '@/lib/format-money';

type DayOrder = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total: number;
  created_at: string;
};

type DayClose = {
  date: string;
  closed_at: string;
  closed_by: string | null;
  order_count: number;
  paid_total: number;
  note: string;
};

type DayReport = {
  date: string;
  orders: DayOrder[];
  item_count: number;
  close: DayClose | null;
};

function todayInAccra() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Accra',
  });
}

export default function EndOfDayPage() {
  const [date, setDate] = useState(todayInAccra);
  const [report, setReport] = useState<DayReport | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (day: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiData<DayReport>(`/api/admin/end-of-day?date=${day}`);
      setReport(data);
      setNote(data.close?.note || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load the day');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const totals = useMemo(() => {
    const orders = report?.orders || [];
    const paid = orders.filter((order) => order.payment_status === 'paid');
    const byMethod = new Map<string, { count: number; total: number }>();
    for (const order of paid) {
      const key = order.payment_method || 'Unspecified';
      const current = byMethod.get(key) || { count: 0, total: 0 };
      byMethod.set(key, { count: current.count + 1, total: current.total + Number(order.total) });
    }
    return {
      orders: orders.length,
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, order) => sum + Number(order.total), 0),
      unpaidTotal: orders
        .filter((order) => order.payment_status !== 'paid')
        .reduce((sum, order) => sum + Number(order.total), 0),
      methods: [...byMethod.entries()],
    };
  }, [report]);

  const closeDay = async () => {
    setClosing(true);
    setError(null);
    try {
      await apiData('/api/admin/end-of-day', {
        method: 'POST',
        json: { date, note },
      });
      await load(date);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not close the day');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-gray-900">End of day</h1>
          <p className="mt-1 text-gray-600">Today&apos;s orders, what was paid, and a record that the day is closed.</p>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-900">Day</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border-2 border-gray-300 px-4 py-3"
          />
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Orders</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? '—' : totals.orders}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Paid</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? '—' : `GH₵${money(totals.paidTotal)}`}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Still unpaid</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? '—' : `GH₵${money(totals.unpaidTotal)}`}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm text-gray-600">Items sold</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? '—' : report?.item_count ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900">Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Order</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Payment</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody>
                {!loading && totals.orders === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No orders for this day.
                    </td>
                  </tr>
                ) : (
                  report?.orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100">
                      <td className="px-6 py-3">
                        <p className="font-medium text-gray-900">{order.order_number}</p>
                        <p className="text-xs text-gray-500">
                          {formatTime(order.created_at)} · {order.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {order.payment_method || '—'}
                        <span className="block text-xs text-gray-500">{order.payment_status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.status}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">GH₵{money(order.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Paid by method</h2>
            {totals.methods.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No paid orders yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {totals.methods.map(([method, summary]) => (
                  <li key={method} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      {method} <span className="text-gray-400">· {summary.count}</span>
                    </span>
                    <span className="font-semibold text-gray-900">GH₵{money(summary.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Close the day</h2>
            {report?.close && (
              <p className="mt-2 text-sm text-gray-600">
                Closed {new Date(report.close.closed_at).toLocaleString('en-GH', { timeZone: 'Africa/Accra' })}
                {report.close.closed_by ? ` by ${report.close.closed_by}` : ''}. Paid GH₵{money(report.close.paid_total)} across{' '}
                {report.close.order_count} orders.
              </p>
            )}
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-gray-900">Note</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Cash counted, anything to follow up tomorrow"
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3"
              />
            </label>
            <button
              type="button"
              onClick={closeDay}
              disabled={closing || loading}
              className="mt-4 w-full rounded-lg bg-store-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {closing ? 'Closing…' : report?.close ? 'Update close' : 'End the day'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
