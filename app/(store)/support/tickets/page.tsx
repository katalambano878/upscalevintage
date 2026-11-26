'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePageTitle } from '@/hooks/usePageTitle';

type Ticket = {
  id: string;
  ticket_number: number;
  subject: string;
  category: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  messages: number;
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
];

const CATEGORY_LABELS: Record<string, string> = {
  order: 'Order issue',
  delivery: 'Delivery problem',
  return: 'Return request',
  payment: 'Payment issue',
  product: 'Product question',
  account: 'Account help',
  other: 'Other',
};

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function statusColor(status: string) {
  switch (status) {
    case 'in_progress':
    case 'waiting_customer':
      return 'bg-amber-100 text-amber-800';
    case 'resolved':
    case 'closed':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-brand-nude/50 text-brand-espresso';
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MyTicketsPage() {
  usePageTitle('My Support Tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/support/tickets', { credentials: 'include', cache: 'no-store' });
        if (res.status === 401) {
          setSignedOut(true);
          return;
        }
        if (!res.ok) throw new Error('Could not load your tickets.');
        setTickets(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your tickets.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const countFor = (value: string) =>
    value === 'all' ? tickets.length : tickets.filter((t) => t.status === value).length;
  const shown = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My support tickets</h1>
            <p className="text-gray-600">We reply by email, usually within a day.</p>
          </div>
          <Link
            href="/support/ticket"
            className="inline-flex items-center justify-center bg-brand-espresso hover:bg-brand-cocoa text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <i className="ri-add-line mr-2" aria-hidden="true"></i>
            New ticket
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">Loading your tickets…</div>
        ) : signedOut ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to see your tickets</h2>
            <p className="text-gray-600 mb-6">
              Tickets sent while signed out are answered by email.
            </p>
            <Link
              href="/auth/login"
              className="inline-block bg-brand-espresso hover:bg-brand-cocoa text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Sign in
            </Link>
          </div>
        ) : error ? (
          <div role="alert" className="bg-white rounded-xl shadow-sm p-12 text-center text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="flex border-b border-gray-200 overflow-x-auto" role="tablist">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={`px-6 py-4 font-semibold whitespace-nowrap border-b-2 transition-colors ${
                      filter === f.value
                        ? 'border-brand-espresso text-brand-espresso'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {f.label} ({countFor(f.value)})
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">No tickets here</h2>
                <p className="text-gray-600 mb-6">
                  {tickets.length === 0 ? "You haven't opened a support ticket yet." : 'No tickets match this filter.'}
                </p>
                {tickets.length === 0 && (
                  <Link
                    href="/support/ticket"
                    className="inline-block bg-brand-espresso hover:bg-brand-cocoa text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Open a ticket
                  </Link>
                )}
              </div>
            ) : (
              <ul className="space-y-4">
                {shown.map((ticket) => (
                  <li key={ticket.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-lg font-bold text-gray-900">{ticket.subject}</h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(ticket.status)}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">
                      {CATEGORY_LABELS[ticket.category || ''] || 'Other'} · Ticket #{ticket.ticket_number}
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
                      <span>Opened {formatDate(ticket.created_at)}</span>
                      <span>Updated {formatDate(ticket.updated_at)}</span>
                      <span>
                        {ticket.messages} {ticket.messages === 1 ? 'message' : 'messages'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
