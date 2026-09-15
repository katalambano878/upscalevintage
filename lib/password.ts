import 'server-only';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing, replacing the hashing Supabase Auth did for us.
 *
 * Uses scrypt from Node's standard library rather than bcrypt or argon2 so the
 * project keeps zero native dependencies — those need a compile toolchain and
 * break reproducible Docker builds on the deployment host.
 */

const scryptAsync = promisify(scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number,
    options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

// OWASP's minimum for scrypt: N=2^17, r=8, p=1.
const COST = 2 ** 17;
const BLOCK_SIZE = 8;
const PARALLELISATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// scrypt needs roughly 128 * N * r bytes; the default 32 MB cap is too small.
const MAX_MEMORY = 256 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = (await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELISATION,
        maxmem: MAX_MEMORY,
    })) as Buffer;

    return [
        'scrypt',
        COST,
        BLOCK_SIZE,
        PARALLELISATION,
        salt.toString('base64'),
        derived.toString('base64'),
    ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, cost, blockSize, parallelisation, saltB64, hashB64] = parts;

    try {
        const salt = Buffer.from(saltB64, 'base64');
        const expected = Buffer.from(hashB64, 'base64');

        const derived = (await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
            N: Number(cost),
            r: Number(blockSize),
            p: Number(parallelisation),
            maxmem: MAX_MEMORY,
        })) as Buffer;

        // Constant-time comparison; a plain === leaks the hash byte by byte.
        return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
        return false;
    }
}

/** Returns a human-readable problem with the password, or null if acceptable. */
export function validatePasswordStrength(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (password.length > 200) {
        return 'Password must be 200 characters or fewer.';
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return 'Password must contain at least one letter and one number.';
    }
    return null;
}
