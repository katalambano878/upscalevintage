import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/api';
import { validatePasswordStrength } from '@/lib/password';
import { consumePasswordResetToken } from '@/lib/repositories/users';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const limit = checkRateLimit(`reset-password:${getClientIdentifier(request)}`, {
    maxRequests: 10,
    windowSeconds: 15 * 60,
  });
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '');
    const password = String(body.password || '');

    if (!token) {
      return NextResponse.json({ error: 'That reset link is invalid or has expired.' }, { status: 400 });
    }
    const weak = validatePasswordStrength(password);
    if (weak) {
      return NextResponse.json({ error: weak }, { status: 400 });
    }

    // Marks the token used, sets the password and signs out every old session.
    await consumePasswordResetToken(token, password);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Could not reset your password. Please try again.' }, { status: 500 });
  }
}
