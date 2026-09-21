import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { changePassword } from '@/lib/repositories/users';
import { cleanStaffPermissions } from '@/lib/permissions';
import { allow } from '@/lib/staff-gate';

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: Ctx) {
  const gate = await allow(request, 'staff.manage');
  if (gate.denied) return gate.denied;

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Unknown staff member.' }, { status: 400 });

  const body = await request.json().catch(() => null);
  const target = await queryOne<{ id: string; role: string; email: string }>(
    `SELECT u.id, u.email, p.role::text AS role
       FROM users u JOIN profiles p ON p.id = u.id
      WHERE u.id = $1 AND p.role IN ('admin', 'staff')`,
    [id]
  );
  if (!target) return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });

  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim().slice(0, 80) : undefined;
  const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 30) : undefined;
  const password = typeof body?.password === 'string' ? body.password : '';
  const wantsPermissions = Array.isArray(body?.permissions);
  const permissions = wantsPermissions ? cleanStaffPermissions(body.permissions) : null;
  const disabled = typeof body?.disabled === 'boolean' ? body.disabled : undefined;

  if (target.role === 'admin' && wantsPermissions) {
    return NextResponse.json({ error: 'Admin accounts already have full access.' }, { status: 400 });
  }
  if (wantsPermissions && !permissions?.length) {
    return NextResponse.json({ error: 'Choose at least one permission.' }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: 'Use a password of at least 8 characters.' }, { status: 400 });
  }
  if (disabled === true && id === gate.auth.user?.id) {
    return NextResponse.json({ error: 'You cannot disable your own account.' }, { status: 400 });
  }

  if (disabled === true && target.role === 'admin') {
    const remaining = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM profiles p
         JOIN users u ON u.id = p.id
        WHERE p.role = 'admin' AND u.disabled_at IS NULL AND u.id <> $1`,
      [id]
    );
    if (!remaining || remaining.count < 1) {
      return NextResponse.json({ error: 'Keep at least one active admin account.' }, { status: 400 });
    }
  }

  try {
    if (fullName !== undefined) {
      await query(`UPDATE profiles SET full_name = $2 WHERE id = $1`, [id, fullName || null]);
    }
    if (phone !== undefined) {
      await query(`UPDATE profiles SET phone = $2 WHERE id = $1`, [id, phone || null]);
      await query(`UPDATE users SET phone = $2 WHERE id = $1`, [id, phone || null]);
    }
    if (permissions) {
      await query(`UPDATE profiles SET permissions = $2::jsonb WHERE id = $1`, [id, JSON.stringify(permissions)]);
    }
    if (password) {
      await changePassword(id, password);
      await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
    }
    if (disabled === true) {
      await query(`UPDATE users SET disabled_at = COALESCE(disabled_at, now()) WHERE id = $1`, [id]);
      await query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);
    }
    if (disabled === false) {
      await query(`UPDATE users SET disabled_at = NULL, failed_login_count = 0, locked_until = NULL WHERE id = $1`, [id]);
    }

    await noteAction(request, gate.auth.user?.id, 'staff.update', 'user', id, {
      email: target.email,
      full_name: fullName,
      permissions: permissions || undefined,
      disabled,
      password_reset: Boolean(password),
    });

    const person = await queryOne(
      `SELECT u.id, u.email, u.disabled_at, u.last_login_at, p.full_name, p.phone, p.role::text AS role, p.permissions,
              EXISTS (
                SELECT 1 FROM sessions s
                 WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()
              ) AS signed_in
         FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = $1`,
      [id]
    );
    return NextResponse.json(person);
  } catch (err) {
    console.error('[admin/staff PATCH]', err);
    return NextResponse.json({ error: 'Could not update that staff member.' }, { status: 500 });
  }
}
