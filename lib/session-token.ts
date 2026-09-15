/**
 * Session token format, shared by Node and Edge runtimes.
 * A token is `<sessionId>.<hmac>`. This file must stay free of Node built-ins.
 */

export const SESSION_COOKIE = 'upscale_session';
export const SESSION_TTL_DAYS = 30;

function requireSecret(): string {
    const secret = process.env.AUTH_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.');
    }
    return secret;
}

async function hmacKey(): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(requireSecret()),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

function toBase64Url(bytes: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(bytes));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signSessionId(sessionId: string): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(sessionId));
    return `${sessionId}.${toBase64Url(signature)}`;
}

export async function readSignedSessionId(token: string | undefined): Promise<string | null> {
    if (!token) return null;

    const separator = token.lastIndexOf('.');
    if (separator <= 0) return null;

    const sessionId = token.slice(0, separator);
    const expected = await signSessionId(sessionId);
    return timingSafeEqualString(token, expected) ? sessionId : null;
}

export async function hashSessionToken(token: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function timingSafeEqualString(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
