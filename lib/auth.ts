import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { query, queryOne } from './db';
import { parsePermissionList } from './permissions';
import {
    SESSION_COOKIE,
    SESSION_TTL_DAYS,
    hashSessionToken,
    readSignedSessionId,
    signSessionId,
} from './session-token';

export type UserRole = 'admin' | 'staff' | 'customer';

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    fullName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    permissions: string[];
}

interface SessionRow {
    user_id: string;
    email: string;
    role: UserRole;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    email_verified_at: Date | null;
    disabled_at: Date | null;
    permissions: unknown;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
    const store = await cookies();
    const sessionId = await readSignedSessionId(store.get(SESSION_COOKIE)?.value);
    if (!sessionId) return null;

    const row = await queryOne<SessionRow>(
        `SELECT s.user_id,
                u.email,
                u.email_verified_at,
                u.disabled_at,
                p.role,
                p.full_name,
                p.phone,
                p.avatar_url,
                p.permissions
           FROM sessions s
           JOIN users u    ON u.id = s.user_id
           JOIN profiles p ON p.id = s.user_id
          WHERE s.id = $1
            AND s.revoked_at IS NULL
            AND s.expires_at > now()`,
        [sessionId]
    );

    if (!row || row.disabled_at) return null;

    return {
        id: row.user_id,
        email: row.email,
        role: row.role,
        fullName: row.full_name,
        phone: row.phone,
        avatarUrl: row.avatar_url,
        emailVerified: row.email_verified_at !== null,
        permissions: parsePermissionList(row.permissions),
    };
}

export class AuthError extends Error {
    constructor(
        message: string,
        readonly status: 401 | 403
    ) {
        super(message);
        this.name = 'AuthError';
    }
}

export async function requireUser(): Promise<AuthUser> {
    const user = await getCurrentUser();
    if (!user) throw new AuthError('You must be signed in.', 401);
    return user;
}

export async function requireStaff(): Promise<AuthUser> {
    const user = await requireUser();
    if (user.role !== 'admin' && user.role !== 'staff') {
        throw new AuthError('Administrator access required.', 403);
    }
    return user;
}

export async function requireAdmin(): Promise<AuthUser> {
    const user = await requireUser();
    if (user.role !== 'admin') {
        throw new AuthError('Administrator access required.', 403);
    }
    return user;
}

export function isStaff(user: AuthUser | null): boolean {
    return user?.role === 'admin' || user?.role === 'staff';
}

export function isStaffRole(role: string | undefined | null): boolean {
    return role === 'admin' || role === 'staff';
}

export async function getUserIdFromRequest(_request: Request): Promise<string | null> {
    const user = await getCurrentUser();
    return user?.id ?? null;
}

export async function createSession(
    userId: string,
    context: { userAgent?: string | null; ipAddress?: string | null } = {}
): Promise<void> {
    const sessionId = randomUUID();
    const token = await signSessionId(sessionId);
    const tokenHash = await hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

    await query(
        `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            sessionId,
            userId,
            tokenHash,
            context.userAgent?.slice(0, 300) ?? null,
            context.ipAddress ?? null,
            expiresAt,
        ]
    );

    await query('UPDATE users SET last_login_at = now(), failed_login_count = 0 WHERE id = $1', [userId]);

    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
    });
}

export async function destroySession(): Promise<void> {
    const store = await cookies();
    const sessionId = await readSignedSessionId(store.get(SESSION_COOKIE)?.value);

    if (sessionId) {
        await query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [
            sessionId,
        ]);
    }

    store.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
    await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
        userId,
    ]);
}

/**
 * Request-based auth for API routes (replaces Supabase bearer tokens).
 * Uses the same session cookie as getCurrentUser.
 */
export interface AuthResult {
    authenticated: boolean;
    user?: AuthUser;
    role?: string;
    error?: string;
}

export async function verifyAuth(
    _request: Request,
    options: { requireAdmin?: boolean } = {}
): Promise<AuthResult> {
    try {
        const user = options.requireAdmin ? await requireStaff() : await requireUser();
        return { authenticated: true, user, role: user.role };
    } catch (err) {
        if (err instanceof AuthError) {
            return { authenticated: false, error: err.message };
        }
        return { authenticated: false, error: 'Auth verification failed' };
    }
}

export async function verifyAdminToken(_token: string): Promise<AuthResult> {
    return verifyAuth(new Request('http://local'), { requireAdmin: true });
}
