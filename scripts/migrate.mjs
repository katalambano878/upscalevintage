#!/usr/bin/env node
/**
 * Applies SQL files from db/migrations in filename order.
 *
 * Each file runs inside a transaction and is recorded in schema_migrations, so
 * re-running is a no-op and a failed migration leaves no partial schema behind.
 *
 * Usage:
 *   node scripts/migrate.mjs           apply pending migrations
 *   node scripts/migrate.mjs --status  list applied and pending migrations
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const migrationsDir = join(projectRoot, 'db', 'migrations');

loadEnvFile(join(projectRoot, '.env.local'));
loadEnvFile(join(projectRoot, '.env'));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is not set. Add it to .env.local or export it.');
    process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString);
const client = new pg.Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'disable' || isLocal ? undefined : { rejectUnauthorized: false },
});

const statusOnly = process.argv.includes('--status');

await client.connect();

try {
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name        text PRIMARY KEY,
            checksum    text NOT NULL,
            applied_at  timestamptz NOT NULL DEFAULT now()
        )
    `);

    const { rows: applied } = await client.query('SELECT name, checksum FROM schema_migrations');
    const appliedByName = new Map(applied.map((row) => [row.name, row.checksum]));

    const files = readdirSync(migrationsDir)
        .filter((name) => name.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('No migration files found in db/migrations.');
        process.exit(0);
    }

    let pending = 0;

    for (const name of files) {
        const sql = readFileSync(join(migrationsDir, name), 'utf8');
        const checksum = createHash('sha256').update(sql).digest('hex').slice(0, 16);
        const previous = appliedByName.get(name);

        if (previous) {
            if (previous !== checksum) {
                console.error(
                    `\n  ${name} was already applied but its contents have changed.\n` +
                    `  Editing an applied migration makes environments diverge silently.\n` +
                    `  Add a new migration file instead.`
                );
                process.exit(1);
            }
            if (statusOnly) console.log(`  applied  ${name}`);
            continue;
        }

        pending += 1;

        if (statusOnly) {
            console.log(`  pending  ${name}`);
            continue;
        }

        process.stdout.write(`  applying ${name} ... `);
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
                name,
                checksum,
            ]);
            await client.query('COMMIT');
            console.log('ok');
        } catch (err) {
            await client.query('ROLLBACK');
            console.log('FAILED');
            console.error(`\n${err.message}\n`);
            process.exit(1);
        }
    }

    if (statusOnly) {
        console.log(`\n${files.length} migration(s), ${pending} pending.`);
    } else if (pending === 0) {
        console.log('Database is up to date.');
    } else {
        console.log(`\nApplied ${pending} migration(s).`);
    }
} finally {
    await client.end();
}

/** Minimal .env reader so migrations run without extra dependencies. */
function loadEnvFile(path) {
    if (!existsSync(path)) return;
    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        if (process.env[key] !== undefined) continue;
        let value = line.slice(eq + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
    }
}
