'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRecaptcha } from '@/hooks/useRecaptcha';

export default function SupportTicketPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    orderNumber: '',
    category: 'order',
    priority: 'normal',
    subject: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState('');
  const { getToken } = useRecaptcha();

  const categories = [
    { value: 'order', label: 'Order Issue', icon: 'ri-shopping-bag-line' },
    { value: 'delivery', label: 'Delivery Problem', icon: 'ri-truck-line' },
    { value: 'return', label: 'Return Request', icon: 'ri-arrow-left-right-line' },
    { value: 'payment', label: 'Payment Issue', icon: 'ri-bank-card-line' },
    { value: 'product', label: 'Product Question', icon: 'ri-gift-line' },
    { value: 'account', label: 'Account Help', icon: 'ri-user-line' },
    { value: 'other', label: 'Other', icon: 'ri-question-line' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setIsSubmitting(true);

    // reCAPTCHA verification
    const isHuman = await getToken('support_ticket');
    if (!isHuman) {
      setIsSubmitting(false);
      alert('Security verification failed. Please try again.');
      return;
    }
    
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          orderNumber: formData.orderNumber,
          category: formData.category,
          priority: formData.priority,
          subject: formData.subject,
          description: formData.description,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create your ticket.');
      setTicketNumber(data.ticketNumber ?? null);
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create your ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <>
        <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="w-20 h-20 flex items-center justify-center bg-brand-nude/50 rounded-full mx-auto mb-6">
                <i className="ri-check-line text-4xl text-brand-espresso"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ticket Created!</h2>
              <p className="text-gray-600 mb-2">
                Your support ticket has been submitted successfully.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                {ticketNumber != null ? `Ticket #${ticketNumber}` : null}
              </p>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  We'll respond to your email within 24 hours.
                </p>
                <Link
                  href="/support/tickets"
                  className="block bg-brand-espresso hover:bg-brand-cocoa text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  View My Tickets
                </Link>
                <Link
                  href="/help"
                  className="block text-brand-espresso hover:text-brand-espresso font-semibold whitespace-nowrap"
                >
                  Back to Help Center
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            href="/help"
            className="inline-flex items-center text-brand-espresso hover:text-brand-espresso font-semibold mb-6 whitespace-nowrap"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Help Center
          </Link>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Support Ticket</h1>
              <p className="text-gray-600">
                Fill out the form below and our team will get back to you within 24 hours
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Order Number (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso"
                  placeholder="ORD-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  What can we help you with? *
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.value })}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.category === cat.value
                          ? 'border-brand-espresso bg-brand-nude/30'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <i className={`${cat.icon} text-2xl ${
                          formData.category === cat.value ? 'text-brand-espresso' : 'text-gray-400'
                        }`}></i>
                        <span className="font-semibold text-gray-900">{cat.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Priority Level *
                </label>
                <div className="flex space-x-4">
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.priority === 'low' ? 'border-gray-700 bg-gray-50' : 'border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="low"
                      checked={formData.priority === 'low'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">Low</p>
                      <p className="text-xs text-gray-600">3 to 5 days</p>
                    </div>
                  </label>
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.priority === 'normal' ? 'border-brand-espresso bg-brand-nude/30' : 'border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="normal"
                      checked={formData.priority === 'normal'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">Normal</p>
                      <p className="text-xs text-gray-600">1 to 2 days</p>
                    </div>
                  </label>
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.priority === 'high' ? 'border-red-700 bg-red-50' : 'border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="high"
                      checked={formData.priority === 'high'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">High</p>
                      <p className="text-xs text-gray-600">Within 24h</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso h-32 resize-none"
                  placeholder="Please provide as much detail as possible..."
                  required
                  maxLength={500}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.description.length}/500 characters
                </p>
              </div>

              <p className="text-sm text-gray-600">
                Have photos of the problem? Send them to us on WhatsApp with your ticket number after you submit.
              </p>

              {submitError && (
                <p role="alert" className="text-sm text-red-600">
                  {submitError}
                </p>
              )}

              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => router.push('/help')}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-brand-espresso hover:bg-brand-cocoa text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Submitting...
                    </>
                  ) : (
                    'Submit Ticket'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 bg-brand-nude/30 border border-brand-nude/70 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <i className="ri-information-line text-2xl text-brand-espresso mt-0.5"></i>
              <div>
                <p className="font-semibold text-brand-cocoa mb-2">Before submitting a ticket</p>
                <ul className="text-sm text-brand-espresso space-y-1">
                  <li>• Check our <Link href="/help" className="underline hover:text-brand-espresso">Help Center</Link> for quick answers</li>
                  <li>• Average response time: 24 hours</li>
                  <li>• Include your order number for faster assistance</li>
                  <li>• Attach photos if reporting a product issue</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
