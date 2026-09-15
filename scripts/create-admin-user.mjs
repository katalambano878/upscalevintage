/**
 * Create an admin user in plain PostgreSQL (users + profiles).
 *
 * Usage:
 *   node scripts/create-admin-user.mjs <email> <password>
 *   CREATE_ADMIN_EMAIL=admin@example.com CREATE_ADMIN_PASSWORD=secret node scripts/create-admin-user.mjs
 */

import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scryptAsync = promisify(scrypt);

function loadEnv() {
    for (const name of ['.env.local', '.env']) {
        const p = join(__dirname, '..', name);
        if (!existsSync(p)) continue;
        for (const line of readFileSync(p, 'utf8').split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
            const eq = trimmed.indexOf('=');
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = val;
        }
    }
}

async function hashPassword(password) {
    const salt = randomBytes(16);
    const derived = await scryptAsync(password.normalize('NFKC'), salt, 64, {
        N: 2 ** 17,
        r: 8,
        p: 1,
        maxmem: 256 * 1024 * 1024,
    });
    return ['scrypt', 2 ** 17, 8, 1, salt.toString('base64'), derived.toString('base64')].join('$');
}

loadEnv();

const email = (process.argv[2] || process.env.CREATE_ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.argv[3] || process.env.CREATE_ADMIN_PASSWORD;
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
}

if (!email || !password) {
    console.error('Usage: node scripts/create-admin-user.mjs <email> <password>');
    process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'disable' || isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();

try {
    const existing = await client.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (existing.rowCount) {
        await client.query(`UPDATE profiles SET role = 'admin' WHERE id = $1`, [existing.rows[0].id]);
        console.log('Existing user promoted to admin:', email);
    } else {
        const passwordHash = await hashPassword(password);
        const inserted = await client.query(
            `INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, now()) RETURNING id`,
            [email, passwordHash]
        );
        await client.query(`UPDATE profiles SET role = 'admin', email = $2 WHERE id = $1`, [
            inserted.rows[0].id,
            email,
        ]);
        console.log('Admin user created:', email);
        console.log('Login at: /admin/login');
    }
} finally {
    await client.end();
}
