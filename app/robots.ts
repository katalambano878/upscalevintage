import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * robots.txt — generated dynamically so the canonical host always matches
 * NEXT_PUBLIC_APP_URL (no stale .com vs .shop drift).
 *
 * Disallows:
 * - Auth, account, cart, wishlist, checkout, payment, order tracking — these
 *   are personalized / transactional surfaces with no SEO value.
 * - Admin & API routes — internal only.
 * - PWA install / offline / maintenance fallbacks — utility pages.
 * - Internal Supabase preview query params (?search, ?ref) avoided via
 *   explicit canonical tags on each page, so we don't need URL params here.
 *
 * Bingbot, GPTBot, etc. inherit the same rules via the wildcard.
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin',
                    '/admin/',
                    '/api/',
                    '/auth/',
                    '/account',
                    '/account/',
                    '/cart',
                    '/checkout',
                    '/wishlist',
                    '/order-tracking',
                    '/order-success',
                    '/pay/',
                    '/support/ticket',
                    '/support/tickets',
                    '/maintenance',
                    '/offline',
                    '/pwa-settings',
                    '/_next/',
                    '*?*utm_*',
                    '*?*session_id=',
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
