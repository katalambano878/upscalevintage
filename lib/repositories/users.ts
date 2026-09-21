import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { query, queryOne, transaction } from '../db';
import { hashPassword, verifyPassword } from '../password';
import { ApiError } from '../api';

/**
 * Account creation and credential checking, replacing Supabase Auth's
 * signUp / signInWithPassword / resetPasswordForEmail.
 */

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 60;

export interface UserRecord {
    id: string;
    email: string;
    role: 'admin' | 'staff' | 'customer';
}

export function normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
}

export async function createUser(input: {
    email: string;
    password: string;
    fullName?: string | null;
    phone?: string | null;
    role?: 'admin' | 'staff' | 'customer';
    permissions?: string[] | null;
}): Promise<UserRecord> {
    const email = normaliseEmail(input.email);
    const passwordHash = await hashPassword(input.password);

    return transaction(async (client) => {
        const existing = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
        if (existing.rowCount) {
            throw new ApiError('An account with that email already exists.', 409, 'email_taken');
        }

        const { rows } = await client.query<{ id: string }>(
            `INSERT INTO users (email, password_hash, phone) VALUES ($1, $2, $3) RETURNING id`,
            [email, passwordHash, input.phone ?? null]
        );
        const userId = rows[0]!.id;

        // The on_user_created trigger has already inserted a customer profile;
        // fill in the details it could not know.
        await client.query(
            `UPDATE profiles
                SET full_name = COALESCE($2, full_name),
                    phone     = COALESCE($3, phone),
                    role      = COALESCE($4::user_role, role),
                    permissions = COALESCE($5::jsonb, permissions)
              WHERE id = $1`,
            [
                userId,
                input.fullName ?? null,
                input.phone ?? null,
                input.role ?? null,
                input.permissions ? JSON.stringify(input.permissions) : null,
            ]
        );

        return { id: userId, email, role: input.role ?? 'customer' };
    });
}

/**
 * Verifies credentials. Returns null for every failure so the caller cannot
 * distinguish "no such account" from "wrong password" and leak which emails
 * are registered.
 */
export async function authenticate(
    emailInput: string,
    password: string
): Promise<UserRecord | null> {
    const email = normaliseEmail(emailInput);

    const user = await queryOne<{
        id: string;
        email: string;
        password_hash: string;
        role: 'admin' | 'staff' | 'customer';
        disabled_at: Date | null;
        failed_login_count: number;
        locked_until: Date | null;
    }>(
        `SELECT u.id, u.email, u.password_hash, u.disabled_at,
                u.failed_login_count, u.locked_until, p.role
           FROM users u
           JOIN profiles p ON p.id = u.id
          WHERE lower(u.email) = $1`,
        [email]
    );

    if (!user) {
        // Spend comparable time on a dummy hash so response timing does not
        // reveal whether the address exists.
        await verifyPassword(password, 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA');
        return null;
    }

    if (user.disabled_at) return null;

    if (user.locked_until && user.locked_until > new Date()) {
        throw new ApiError(
            'Too many failed attempts. Please try again in a few minutes.',
            429,
            'account_locked'
        );
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
        const attempts = user.failed_login_count + 1;
        await query(
            `UPDATE users
                SET failed_login_count = $2,
                    locked_until = CASE WHEN $2 >= $3
                                        THEN now() + ($4 || ' minutes')::interval
                                        ELSE locked_until END
              WHERE id = $1`,
            [user.id, attempts, MAX_FAILED_LOGINS, String(LOCKOUT_MINUTES)]
        );
        return null;
    }

    return { id: user.id, email: user.email, role: user.role };
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await hashPassword(newPassword);
    await query(
        `UPDATE users SET password_hash = $2, failed_login_count = 0, locked_until = NULL WHERE id = $1`,
        [userId, passwordHash]
    );
}

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a password reset token. Returns null when the address is unknown, so
 * the caller can respond identically either way and avoid confirming which
 * emails have accounts.
 */
export async function createPasswordResetToken(
    emailInput: string
): Promise<{ token: string; userId: string } | null> {
    const email = normaliseEmail(emailInput);
    const user = await queryOne<{ id: string }>(
        'SELECT id FROM users WHERE lower(email) = $1 AND disabled_at IS NULL',
        [email]
    );
    if (!user) return null;

    // Invalidate outstanding tokens so an older email cannot still be used.
    await query(
        `UPDATE auth_tokens SET consumed_at = now()
          WHERE user_id = $1 AND purpose = 'password_reset' AND consumed_at IS NULL`,
        [user.id]
    );

    const token = randomBytes(32).toString('base64url');
    await query(
        `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'password_reset', $2, now() + ($3 || ' minutes')::interval)`,
        [user.id, hashToken(token), String(RESET_TOKEN_TTL_MINUTES)]
    );

    return { token, userId: user.id };
}

/** Consumes a reset token and sets the new password. Single use. */
export async function consumePasswordResetToken(token: string, newPassword: string): Promise<string> {
    const passwordHash = await hashPassword(newPassword);

    return transaction(async (client) => {
        // FOR UPDATE serialises concurrent uses of the same token so it cannot
        // be redeemed twice.
        const { rows } = await client.query<{ id: string; user_id: string }>(
            `SELECT id, user_id FROM auth_tokens
              WHERE token_hash = $1
                AND purpose = 'password_reset'
                AND consumed_at IS NULL
                AND expires_at > now()
                FOR UPDATE`,
            [hashToken(token)]
        );

        const record = rows[0];
        if (!record) {
            throw new ApiError('That reset link is invalid or has expired.', 400, 'invalid_token');
        }

        await client.query('UPDATE auth_tokens SET consumed_at = now() WHERE id = $1', [record.id]);
        await client.query(
            `UPDATE users SET password_hash = $2, failed_login_count = 0, locked_until = NULL WHERE id = $1`,
            [record.user_id, passwordHash]
        );
        // Any session opened with the old password is no longer trustworthy.
        await client.query(
            `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
            [record.user_id]
        );

        return record.user_id;
    });
}
