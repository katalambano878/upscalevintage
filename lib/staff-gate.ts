import 'server-only';
import { NextResponse } from 'next/server';
import { verifyAuth, type AuthResult, type AuthUser } from '@/lib/auth';
import { canAny, type PermissionKey } from '@/lib/permissions';

type Allowed = { auth: AuthResult & { user: AuthUser }; denied: null };
type Blocked = { auth: AuthResult; denied: NextResponse };

export async function allow(request: Request, permission: PermissionKey | PermissionKey[]): Promise<Allowed | Blocked> {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated || !auth.user) {
    return {
      auth,
      denied: NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 }),
    };
  }

  const keys = Array.isArray(permission) ? permission : [permission];
  if (!canAny(auth.user, keys)) {
    return {
      auth,
      denied: NextResponse.json({ error: 'You do not have permission to do that.' }, { status: 403 }),
    };
  }

  return { auth: { ...auth, user: auth.user }, denied: null };
}
