import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, readSignedSessionId } from '@/lib/session-token';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const response = NextResponse.next();

    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

    if (pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-store');
    }

    if (pathname.startsWith('/admin')) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

        if (pathname === '/admin/login') {
            return response;
        }

        let sessionId: string | null = null;
        try {
            sessionId = await readSignedSessionId(request.cookies.get(SESSION_COOKIE)?.value);
        } catch {
            sessionId = null;
        }

        if (!sessionId) {
            const loginUrl = new URL('/admin/login', request.url);
            loginUrl.searchParams.set('redirect', pathname);
            return NextResponse.redirect(loginUrl);
        }
    }

    return response;
}

export const config = {
    matcher: ['/admin/:path*', '/api/:path*'],
};
