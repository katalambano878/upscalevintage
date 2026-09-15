/**
 * Browser-side API client.
 *
 * Replaces the Supabase JS client in components. It restores the `{ data, error }`
 * shape the UI already expects, but adds the checks the Supabase client used to
 * do for us: verifying the status, confirming the response is actually JSON
 * rather than an HTML error page, and aborting requests that hang.
 */

export interface ApiResult<T> {
    data: T | null;
    error: { message: string; code: string; details?: unknown } | null;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Sends FormData untouched, for uploads. */
    formData?: FormData;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    const { method = 'GET', body, formData, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

    // Without this a stalled request leaves a spinner running forever, which is
    // indistinguishable from the page being frozen.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
        const response = await fetch(path, {
            method,
            headers: formData ? undefined : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
            body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
            credentials: 'same-origin',
            signal: controller.signal,
        });

        const contentType = response.headers.get('content-type') ?? '';

        if (!contentType.includes('application/json')) {
            return {
                data: null,
                error: {
                    message:
                        response.status >= 500
                            ? 'The server is not responding correctly. Please try again.'
                            : 'Unexpected response from the server.',
                    code: 'invalid_response',
                },
            };
        }

        const payload = (await response.json()) as ApiResult<T> | T;

        if (!response.ok) {
            const failure = payload as ApiResult<T>;
            return {
                data: null,
                error: failure.error ?? { message: 'Request failed.', code: String(response.status) },
            };
        }

        if (
            payload &&
            typeof payload === 'object' &&
            'data' in payload &&
            'error' in payload &&
            (payload as ApiResult<T>).error === null
        ) {
            return { data: (payload as ApiResult<T>).data ?? null, error: null };
        }

        return { data: payload as T, error: null };
    } catch (err) {
        if ((err as Error).name === 'AbortError') {
            return {
                data: null,
                error: { message: 'The request timed out. Please try again.', code: 'timeout' },
            };
        }
        return {
            data: null,
            error: { message: 'Could not reach the server. Check your connection.', code: 'network_error' },
        };
    } finally {
        clearTimeout(timer);
    }
}

export function apiGet<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'PATCH', body });
}

export function apiDelete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return apiRequest<T>(path, { ...options, method: 'DELETE' });
}

/** Builds a query string, omitting undefined, null and empty values. */
/** Returns `data` or throws — for admin/store callers that expect a direct payload. */
export async function apiData<T>(
    path: string,
    options: RequestOptions & { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' } = {}
): Promise<T> {
    const { method = 'GET', body, ...rest } = options;
    const result =
        method === 'GET'
            ? await apiGet<T>(path, rest)
            : method === 'POST'
              ? await apiPost<T>(path, body, rest)
              : method === 'PATCH'
                ? await apiPatch<T>(path, body, rest)
                : method === 'DELETE'
                  ? await apiDelete<T>(path, rest)
                  : await apiRequest<T>(path, { ...rest, method, body });

    if (result.error) {
        throw new Error(result.error.message);
    }
    if (result.data === null) {
        throw new Error('Empty response from server.');
    }
    return result.data;
}

export function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `?${query}` : '';
}
