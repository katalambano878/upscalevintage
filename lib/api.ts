import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { AuthError } from './auth';

/**
 * Consistent shapes for every API route.
 *
 * Supabase returned `{ data, error }` from every call and the UI branched on it.
 * These helpers keep that contract at the HTTP boundary so client code has one
 * predictable shape, while making sure internal database errors never reach the
 * browser.
 */

export interface ApiSuccess<T> {
    data: T;
    error: null;
}

export interface ApiFailure {
    data: null;
    error: { message: string; code: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
    return NextResponse.json({ data, error: null }, init);
}

export function fail(
    message: string,
    status: number,
    code = 'error',
    details?: unknown
): NextResponse<ApiFailure> {
    return NextResponse.json({ data: null, error: { message, code, details } }, { status });
}

/**
 * Wraps a route handler so thrown errors become predictable JSON rather than an
 * HTML error page, which client `response.json()` calls cannot parse.
 */
export function route<Args extends unknown[]>(
    handler: (request: Request, ...args: Args) => Promise<NextResponse>
) {
    return async (request: Request, ...args: Args): Promise<NextResponse> => {
        try {
            return await handler(request, ...args);
        } catch (err) {
            if (err instanceof AuthError) {
                return fail(err.message, err.status, err.status === 401 ? 'unauthenticated' : 'forbidden');
            }

            if (err instanceof ZodError) {
                return fail('The submitted data is not valid.', 422, 'validation_error', fieldErrors(err));
            }

            if (err instanceof ApiError) {
                return fail(err.message, err.status, err.code);
            }

            const pgCode = (err as { code?: string }).code;

            // Translate the database constraint violations the UI can act on.
            if (pgCode === '23505') {
                return fail('That record already exists.', 409, 'duplicate');
            }
            if (pgCode === '23503') {
                return fail('A related record is missing.', 409, 'foreign_key');
            }
            if (pgCode === '23514') {
                return fail('A value is outside the allowed range.', 422, 'check_violation');
            }
            if (pgCode === '57014') {
                return fail('The request took too long. Please try again.', 504, 'timeout');
            }

            // Log the detail, return none of it: messages can contain SQL and
            // column names that map out the schema for an attacker.
            console.error('[api] unhandled error', {
                message: (err as Error).message,
                code: pgCode,
                stack: (err as Error).stack?.split('\n').slice(0, 4).join('\n'),
            });

            return fail('Something went wrong. Please try again.', 500, 'internal_error');
        }
    };
}

/** An error whose message is safe to show the user. */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code = 'error'
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export function notFound(what = 'That record'): never {
    throw new ApiError(`${what} could not be found.`, 404, 'not_found');
}

/** Parses and validates a JSON request body. */
export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        throw new ApiError('Request body must be valid JSON.', 400, 'invalid_json');
    }
    return schema.parse(body);
}

/** Parses and validates query string parameters. */
export function readQuery<T>(request: Request, schema: ZodType<T>): T {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    return schema.parse(params);
}

function fieldErrors(error: ZodError): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.join('.') || '_';
        if (!result[key]) result[key] = issue.message;
    }
    return result;
}

/** Best-effort client IP for rate limiting and session records. */
export function clientIp(request: Request): string | null {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]!.trim();
    return request.headers.get('x-real-ip');
}
