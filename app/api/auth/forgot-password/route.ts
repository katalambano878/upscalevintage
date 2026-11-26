import { NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/lib/repositories/users';
import { sendEmail } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function POST(request: Request) {
  // Same answer whether or not the account exists, so this cannot be used to
  // find out who shops here.
  const okResponse = NextResponse.json({
    ok: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  });

  const limit = checkRateLimit(`forgot-password:${getClientIdentifier(request)}`, {
    maxRequests: 5,
    windowSeconds: 15 * 60,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many reset requests. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return okResponse;
    }

    // Single-use token stored hashed in auth_tokens; older links stop working.
    const issued = await createPasswordResetToken(email);
    if (!issued) {
      return okResponse;
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://upscalevintage.shop').replace(/\/$/, '');
    const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(issued.token)}`;
    const safeUrl = escapeHtml(resetUrl);

    if (!process.env.RESEND_API_KEY) {
      console.warn('[forgot-password] RESEND_API_KEY missing; reset email not sent');
      return okResponse;
    }

    await sendEmail({
      to: email,
      subject: 'Reset your Upscale Vintage password',
      html: `<p>Someone asked to reset the password for your Upscale Vintage account.</p>
<p><a href="${safeUrl}">Choose a new password</a></p>
<p>This link works once and expires soon. If you did not ask for this, you can ignore this email.</p>`,
    });

    return okResponse;
  } catch (err: unknown) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Unable to process request' }, { status: 500 });
  }
}
