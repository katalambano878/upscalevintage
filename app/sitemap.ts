import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/seo';

/**
 * Dynamic sitemap.xml for Upscale Vintage.
 *
 * Includes:
 * 1. Public static pages (home, shop, categories, about, contact, faqs,
 *    shipping, returns, privacy, terms, help, blog).
 * 2. Every active product (with image and lastmod) — feeds Google's
 *    image sitemap too.
 * 3. Every active category as a /shop?category=[slug] entry (we don't have
 *    per-category routes today; this is the canonical browse URL).
 * 4. The currently-published blog posts.
 *
 * Excludes everything in app/robots.ts disallow list (cart, account, auth,
 * checkout, pay, order-tracking, admin, api).
 *
 * Output is at `${SITE_URL}/sitemap.xml` automatically by Next.js.
 */

// Make sure the sitemap is regenerated frequently — it's queried by crawlers
// and we want product/category changes to propagate quickly. Next.js will
// revalidate the static sitemap response at this interval.
export const revalidate = 3600; // 1 hour

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Frequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

interface StaticEntry {
    path: string;
    changeFrequency: Frequency;
    priority: number;
}

const STATIC_PAGES: StaticEntry[] = [
    { path: '/', changeFrequency: 'daily', priority: 1.0 },
    { path: '/shop', changeFrequency: 'daily', priority: 0.9 },
    { path: '/categories', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/about', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.6 },
    { path: '/faqs', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/help', changeFrequency: 'monthly', priority: 0.45 },
    { path: '/shipping', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/returns', changeFrequency: 'monthly', priority: 0.4 },
    { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
];

// Blog posts are currently hardcoded in app/(store)/blog/[id]/page.tsx
// (IDs 1–3). When the blog moves into a CMS table, swap this for a real
// fetch — until then we hand-list the published IDs.
const STATIC_BLOG_POSTS: Array<{ id: string; lastModified: string }> = [
    { id: '1', lastModified: '2025-12-15' },
    { id: '2', lastModified: '2025-12-12' },
    { id: '3', lastModified: '2025-12-10' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const baseUrl = SITE_URL.replace(/\/$/, '');

    const staticPages: MetadataRoute.Sitemap = STATIC_PAGES.map((p) => ({
        url: `${baseUrl}${p.path}`,
        lastModified: now,
        changeFrequency: p.changeFrequency,
        priority: p.priority,
    }));

    const staticBlog: MetadataRoute.Sitemap = STATIC_BLOG_POSTS.map((post) => ({
        url: `${baseUrl}/blog/${post.id}`,
        lastModified: new Date(post.lastModified),
        changeFrequency: 'monthly',
        priority: 0.55,
    }));

    let productPages: MetadataRoute.Sitemap = [];
    let categoryPages: MetadataRoute.Sitemap = [];

    if (supabaseUrl && supabaseKey) {
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Active products + their primary image for the image sitemap.
            const { data: products } = await supabase
                .from('products')
                .select('slug, updated_at, name, product_images(url, position)')
                .eq('status', 'active');

            if (products) {
                productPages = products.map((product: any) => {
                    const sortedImages = [...(product.product_images || [])].sort(
                        (a: { position?: number }, b: { position?: number }) =>
                            (a.position ?? 0) - (b.position ?? 0),
                    );
                    const primaryImage = sortedImages[0]?.url
                        ? sortedImages[0].url.startsWith('http')
                            ? sortedImages[0].url
                            : `${baseUrl}${sortedImages[0].url}`
                        : undefined;

                    return {
                        url: `${baseUrl}/product/${product.slug}`,
                        lastModified: product.updated_at ? new Date(product.updated_at) : now,
                        changeFrequency: 'weekly' as const,
                        priority: 0.75,
                        images: primaryImage ? [primaryImage] : undefined,
                    };
                });
            }

            // Active categories. There's no /categories/[slug] route, so we
            // use the canonical filter URL /shop?category=[slug].
            const { data: categories } = await supabase
                .from('categories')
                .select('slug, updated_at')
                .eq('status', 'active');

            if (categories) {
                categoryPages = categories.map((category: any) => ({
                    url: `${baseUrl}/shop?category=${category.slug}`,
                    lastModified: category.updated_at ? new Date(category.updated_at) : now,
                    changeFrequency: 'weekly' as const,
                    priority: 0.7,
                }));
            }
        } catch (error) {
            console.error('[sitemap] error fetching dynamic entries:', error);
        }
    }

    return [...staticPages, ...categoryPages, ...productPages, ...staticBlog];
}
