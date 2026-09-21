import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { createUser } from '@/lib/repositories/users';
import { ApiError } from '@/lib/api';
import { cleanStaffPermissions } from '@/lib/permissions';
import { allow } from '@/lib/staff-gate';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: Request) {
  const gate = await allow(request, 'staff.manage');
  if (gate.denied) return gate.denied;

  try {
    const people = await query(
      `SELECT u.id, u.email, u.disabled_at, u.last_login_at, u.created_at,
              p.full_name, p.phone, p.role::text AS role, p.permissions,
              EXISTS (
                SELECT 1 FROM sessions s
                 WHERE s.user_id = u.id
                   AND s.revoked_at IS NULL
                   AND s.expires_at > now()
              ) AS signed_in
         FROM users u
         JOIN profiles p ON p.id = u.id
        WHERE p.role IN ('admin', 'staff')
        ORDER BY CASE WHEN p.role = 'admin' THEN 0 ELSE 1 END, p.full_name NULLS LAST, u.email`
    );
    return NextResponse.json(people);
  } catch (err) {
    console.error('[admin/staff GET]', err);
    return NextResponse.json({ error: 'Could not load staff.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await allow(request, 'staff.manage');
  if (gate.denied) return gate.denied;

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim().slice(0, 80) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 30) : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const permissions = cleanStaffPermissions(body?.permissions);

  if (!fullName) return NextResponse.json({ error: 'Enter the staff member’s name.' }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Use a password of at least 8 characters.' }, { status: 400 });
  if (!permissions.length) return NextResponse.json({ error: 'Choose what this person can do.' }, { status: 400 });

  try {
    const created = await createUser({
      email,
      password,
      fullName,
      phone: phone || null,
      role: 'staff',
      permissions,
    });
    await noteAction(request, gate.auth.user?.id, 'staff.create', 'user', created.id, {
      email,
      full_name: fullName,
      permissions,
    });

    const person = await queryOne(
      `SELECT u.id, u.email, u.disabled_at, u.last_login_at, p.full_name, p.phone, p.role::text AS role, p.permissions
         FROM users u JOIN profiles p ON p.id = u.id WHERE u.id = $1`,
      [created.id]
    );
    return NextResponse.json(person, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[admin/staff POST]', err);
    return NextResponse.json({ error: 'Could not add that staff member.' }, { status: 500 });
  }
}
