"use client";

import { useState } from 'react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus('idle');
    setMessage(null);

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        setStatus('error');
        setMessage(body.error || 'Something went wrong. Please try again.');
        return;
      }

      setStatus('success');
      setMessage(body.message || "You're on the list.");
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-white px-4 pb-16 pt-4 sm:px-6 md:pb-20">
      <div className="mx-auto max-w-[1400px] overflow-hidden rounded-[1.75rem] bg-black px-6 py-10 text-white sm:px-10 md:px-14 md:py-14">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-brand-champagne">The edit</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Be the first to know
            </h2>
            <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/65">
              New fashion, bags, and lifestyle imports, plus private offers, sent only when they are worth opening.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-md">
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                autoComplete="email"
                className="h-[4.5rem] min-h-[4.5rem] w-full min-w-0 flex-1 appearance-none rounded-full border border-white/15 bg-white/5 px-6 text-base text-white outline-none placeholder:text-white/40 focus:border-brand-champagne md:h-12 md:min-h-0 md:w-auto md:px-5 md:text-sm"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand-champagne px-7 text-sm font-semibold text-black transition-colors duration-150 hover:bg-white disabled:opacity-60"
              >
                {isSubmitting ? 'Joining…' : 'Join'}
              </button>
            </div>
            {message && (
              <p
                className={`mt-3 text-sm ${status === 'error' ? 'text-red-300' : 'text-brand-champagne'}`}
                role="status"
              >
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
