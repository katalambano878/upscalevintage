'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiData } from '@/lib/client/api';

type Message = {
  id: string;
  message: string;
  created_at: string;
  from_staff: boolean;
  author: string | null;
};

type Ticket = {
  id: string;
  ticket_number: number;
  email: string;
  subject: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  metadata: { name?: string; order_number?: string | null } | null;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

const FILTERS = [
  { value: 'active', label: 'Needs reply' },
  { value: 'waiting_customer', label: 'Waiting on customer' },
  { value: 'done', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const STATUS_LABEL: Record<string, string> = {
  open: 'New',
  in_progress: 'In progress',
  waiting_customer: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-[#F6F0E4] text-[#5C4718]',
  waiting_customer: 'bg-gray-100 text-gray-700',
  resolved: 'bg-gray-100 text-gray-600',
  closed: 'bg-gray-100 text-gray-600',
};

const CATEGORY_LABEL: Record<string, string> = {
  order: 'Order issue',
  delivery: 'Delivery',
  return: 'Return',
  payment: 'Payment',
  product: 'Product question',
  account: 'Account',
  other: 'Other',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const rows = await apiData<Ticket[]>('/api/admin/support');
      setTickets(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const matches = (t: Ticket, value: string) =>
    value === 'all'
      ? true
      : value === 'active'
        ? t.status === 'open' || t.status === 'in_progress'
        : value === 'done'
          ? t.status === 'resolved' || t.status === 'closed'
          : t.status === value;
  const shown = tickets.filter((t) => matches(t, filter));

  const send = async (t: Ticket, status?: string) => {
    const reply = (drafts[t.id] || '').trim();
    if (!reply && !status) return;
    setSavingId(t.id);
    setNotice('');
    try {
      const result = await apiData<{ emailed?: boolean }>('/api/admin/support', {
        method: 'PATCH',
        json: { id: t.id, reply: reply || undefined, status },
      });
      if (reply) {
        setDrafts({ ...drafts, [t.id]: '' });
        setNotice(
          result.emailed
            ? `Ticket #${t.ticket_number}: reply emailed to the customer.`
            : `Ticket #${t.ticket_number}: reply saved, but the email did not go out. Send it on WhatsApp too.`
        );
      } else {
        setNotice(`Ticket #${t.ticket_number}: marked ${STATUS_LABEL[status || ''] || status}.`);
      }
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
        <h1 className="text-3xl font-bold text-gray-900">Support</h1>
        <p className="text-gray-600 mt-1">Tickets customers open from the Help pages. Replies go to the customer by email.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filter tickets">
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
            {f.label} ({tickets.filter((t) => matches(t, f.value)).length})
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
                <div className="h-4 w-56 bg-gray-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-80 bg-gray-100 rounded animate-pulse" />
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
            <p className="font-semibold text-gray-900">{tickets.length === 0 ? 'No tickets yet' : 'Nothing in this list'}</p>
            <p className="text-sm text-gray-600 mt-1">New tickets also arrive in the shop's email inbox.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((t) => {
              const expanded = openId === t.id;
              const busy = savingId === t.id;
              const name = t.metadata?.name || t.email;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : t.id)}
                    aria-expanded={expanded}
                    className="w-full text-left p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900 break-words">{t.subject}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[t.status] || 'bg-gray-100 text-gray-700'}`}>
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                        {(t.priority === 'high' || t.priority === 'urgent') && (
                          <span className="text-xs font-semibold text-red-700">{t.priority === 'urgent' ? 'Urgent' : 'High priority'}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        #{t.ticket_number} · {name} · {CATEGORY_LABEL[t.category || ''] || 'Other'}
                        {t.metadata?.order_number ? ` · ${t.metadata.order_number}` : ''}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap">{formatDate(t.updated_at)}</span>
                    <i className={`ri-arrow-down-s-line text-xl text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                  </button>

                  {expanded && (
                    <div className="px-5 pb-5 space-y-4">
                      <p className="text-sm text-gray-600 break-all">
                        From {name} &lt;{t.email}&gt;
                      </p>

                      <ol className="space-y-3">
                        {t.messages.map((m) => (
                          <li
                            key={m.id}
                            className={`rounded-lg px-4 py-3 text-sm ${m.from_staff ? 'bg-[#F6F0E4] ml-6' : 'bg-gray-50 mr-6'}`}
                          >
                            <p className="text-xs text-gray-500 mb-1">
                              {m.from_staff ? m.author || 'Shop' : 'Customer'} · {formatDate(m.created_at)}
                            </p>
                            <p className="text-gray-900 whitespace-pre-wrap break-words">{m.message}</p>
                          </li>
                        ))}
                      </ol>

                      <div>
                        <label htmlFor={`reply-${t.id}`} className="block text-sm font-medium text-gray-900 mb-1">
                          Reply to {name}
                        </label>
                        <textarea
                          id={`reply-${t.id}`}
                          rows={3}
                          value={drafts[t.id] || ''}
                          onChange={(e) => setDrafts({ ...drafts, [t.id]: e.target.value })}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-base focus:border-store-navy focus:ring-2 focus:ring-store-primary/20"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy || !(drafts[t.id] || '').trim()}
                          onClick={() => send(t)}
                          className="px-4 py-2 bg-store-navy hover:bg-store-navy-light text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          {busy ? 'Sending…' : 'Send reply'}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !(drafts[t.id] || '').trim()}
                          onClick={() => send(t, 'resolved')}
                          className="px-4 py-2 border-2 border-gray-300 text-gray-800 hover:bg-gray-50 rounded-lg text-sm font-semibold disabled:opacity-50"
                        >
                          Send and resolve
                        </button>
                        {t.status !== 'resolved' && t.status !== 'closed' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => send(t, 'resolved')}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 underline underline-offset-4 disabled:opacity-50"
                          >
                            Resolve without reply
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => send(t, 'open')}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 underline underline-offset-4 disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
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
