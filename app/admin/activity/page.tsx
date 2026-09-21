'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiData } from '@/lib/client/api';

type StaffPerson = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

type ActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'pos.sale': 'Rang up a till sale',
  'order.update': 'Updated an order',
  'day.close': 'Closed the day',
  'sale.apply': 'Applied sale prices',
  'sale.clear': 'Removed sale prices',
  'staff.create': 'Added a staff account',
  'staff.update': 'Changed a staff account',
  'product.create': 'Added a product',
  'product.update': 'Updated a product',
  'product.delete': 'Deleted a product',
  'product.import': 'Imported products',
  product_import: 'Imported products',
  'category.create': 'Added a category',
  'category.update': 'Updated a category',
  'category.delete': 'Deleted a category',
  'settings.update': 'Changed settings',
  'coupon.create': 'Added a coupon',
  'coupon.update': 'Updated a coupon',
  'coupon.delete': 'Deleted a coupon',
  'review.update': 'Updated a review',
  'blog.create': 'Added a blog post',
  'blog.update': 'Updated a blog post',
  'blog.delete': 'Deleted a blog post',
  'payment.reconcile': 'Reconciled a payment',
  'notification.send': 'Sent a notification',
};

function describe(row: ActivityRow) {
  const label = ACTION_LABELS[row.action] || row.action.split('.').join(' ');
  const details = row.details || {};
  const extra = [details.order_number, details.email, details.name, details.full_name]
    .filter((value) => typeof value === 'string' && value && value !== row.email)
    .slice(0, 2)
    .join(' · ');
  return extra ? `${label} · ${extra}` : label;
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [personId, setPersonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = userId ? `?user=${encodeURIComponent(userId)}` : '';
      const [activity, staff] = await Promise.all([
        apiData<ActivityRow[]>(`/api/admin/activity${query}`),
        apiData<StaffPerson[]>('/api/admin/staff'),
      ]);
      setRows(Array.isArray(activity) ? activity : []);
      setPeople(Array.isArray(staff) ? staff : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(personId);
  }, [load, personId]);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Activity</h1>
          <p className="mt-1 text-gray-600">Sign-ins and changes made by you and your staff.</p>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-gray-900">Person</span>
          <select
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
            className="rounded-lg border-2 border-gray-300 px-4 py-3"
          >
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name || person.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">When</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Who</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">What they did</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">Loading activity…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    Nothing recorded yet. Sign-ins and shop changes will show up here.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString('en-GH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Africa/Accra',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.full_name || row.email || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">
                        {row.email || '—'}
                        {row.role ? ` · ${row.role}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{describe(row)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
