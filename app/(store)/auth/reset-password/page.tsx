'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';

function ResetPasswordForm() {
  usePageTitle('Choose a New Password');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least 8 characters with at least one letter and one number.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reset your password.');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Reset link missing</h1>
        <p className="text-gray-600 mb-8">
          Open the link from your reset email, or ask for a new one.
        </p>
        <PrimaryLink href="/auth/forgot-password">Send a new link</PrimaryLink>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <div className="w-16 h-16 flex items-center justify-center bg-brand-nude/50 rounded-full mx-auto mb-6">
          <i className="ri-lock-password-line text-3xl text-brand-espresso" aria-hidden="true"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Password changed</h1>
        <p className="text-gray-600 mb-8">
          You can now sign in with your new password. Other devices have been signed out.
        </p>
        <PrimaryLink href="/auth/login">Sign in</PrimaryLink>
      </Card>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Choose a new password</h1>
          <p className="text-gray-600">At least 8 characters, with a letter and a number.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-gray-900 mb-2">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-500"
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-gray-900 mb-2">
                Type it again
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-brand-mauve/40 focus:border-brand-espresso"
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
              className="w-full bg-brand-espresso hover:bg-brand-cocoa text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 text-center">{children}</div>
    </main>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block bg-brand-espresso hover:bg-brand-cocoa text-white px-8 py-3 rounded-lg font-semibold transition-colors"
    >
      {children}
    </Link>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
