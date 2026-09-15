import 'server-only';
import { Pool, types, type PoolClient } from 'pg';

/**
 * PostgreSQL connection layer.
 *
 * Replaces the Supabase client. Server-side only — importing this from a client
 * component is a build error, which is deliberate: it is the guard that stops
 * database credentials reaching the browser.
 */

types.setTypeParser(types.builtins.NUMERIC, (value: string | null) => (value === null ? null : parseFloat(value)));
types.setTypeParser(types.builtins.INT8, (value: string | null) => (value === null ? null : parseInt(value, 10)));

function getConnectionString(): string {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error(
            'DATABASE_URL is not set. Copy .env.example to .env.local and set the PostgreSQL connection string.'
        );
    }
    return connectionString;
}

function createPool(): Pool {
    const connectionString = getConnectionString();
    const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString);
    const sslDisabled = process.env.DATABASE_SSL === 'disable' || isLocal;

    const pool = new Pool({
        connectionString,
        ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
        max: Number(process.env.DATABASE_POOL_MAX ?? 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        query_timeout: 15_000,
    });

    pool.on('error', (err: Error) => {
        console.error('[db] idle client error', { message: err.message });
    });

    return pool;
}

const globalForDb = globalThis as unknown as { __upscalePool?: Pool };

function getPool(): Pool {
    if (!globalForDb.__upscalePool) {
        globalForDb.__upscalePool = createPool();
    }
    return globalForDb.__upscalePool;
}

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_LOG_MS ?? 500);

export async function query<T = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = []
): Promise<T[]> {
    const startedAt = Date.now();
    try {
        const result = await getPool().query<T>(text, params as unknown[]);
        const elapsed = Date.now() - startedAt;
        if (elapsed > SLOW_QUERY_MS) {
            console.warn('[db] slow query', { ms: elapsed, sql: collapse(text) });
        }
        return result.rows;
    } catch (err) {
        console.error('[db] query failed', {
            sql: collapse(text),
            code: (err as { code?: string }).code,
            message: (err as Error).message,
        });
        throw err;
    }
}

export async function queryOne<T = Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = []
): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackErr) {
            console.error('[db] rollback failed', { message: (rollbackErr as Error).message });
        }
        throw err;
    } finally {
        client.release();
    }
}

export async function isDatabaseReachable(): Promise<boolean> {
    try {
        await getPool().query('SELECT 1');
        return true;
    } catch {
        return false;
    }
}

function collapse(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().slice(0, 200);
}
