import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { query } from '@/lib/db';

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
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const hashed = await hashPassword(String(body.password));
      await query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1::uuid`, [
        userId,
        hashed,
      ]);
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
        [userId, fullName ?? null, body.phone ?? null]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
