import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { validatePasswordStrength, verifyPassword } from '@/lib/password';
import { query, queryOne } from '@/lib/db';
import { changePassword } from '@/lib/repositories/users';

export async function PATCH(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const userId = auth.user.id;

  try {
    if (body.password) {
      // Changing the password needs the current one, so someone using an
      // unlocked phone or a stolen session cannot lock the owner out.
      const row = await queryOne<{ password_hash: string | null }>(
        `SELECT password_hash FROM users WHERE id = $1::uuid`,
        [userId]
      );
      const current = String(body.current_password || '');
      if (!row?.password_hash || !current || !(await verifyPassword(current, row.password_hash))) {
        return NextResponse.json({ error: 'Your current password is not right.' }, { status: 400 });
      }
      const weak = validatePasswordStrength(String(body.password));
      if (weak) {
        return NextResponse.json({ error: weak }, { status: 400 });
      }
      await changePassword(userId, String(body.password));
    }

    const fullName =
      body.full_name ??
      (body.first_name || body.last_name
        ? `${body.first_name || ''} ${body.last_name || ''}`.trim()
        : undefined);

    if (fullName !== undefined || body.phone !== undefined) {
      await query(
        `UPDATE profiles SET
           full_name = COALESCE($2, full_name),
           phone = COALESCE($3, phone),
           updated_at = now()
         WHERE id = $1::uuid`,
        // Blank means "leave as is", not "erase".
        [
          userId,
          typeof fullName === 'string' && fullName.trim() ? fullName.trim() : null,
          typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null,
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[auth/profile]', err);
    return NextResponse.json({ error: 'Update failed. Please try again.' }, { status: 500 });
  }
}
