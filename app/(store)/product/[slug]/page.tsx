import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import ProductDetailClient from './ProductDetailClient';
import { BRAND_NAME, APP_TITLE } from '@/lib/brand';
import { SEO_ASSETS, SITE_URL, productJsonLd, breadcrumbJsonLd } from '@/lib/seo';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = getSupabase();

  const fallback: Metadata = {
    title: `Product | ${APP_TITLE}`,
    description: `View product details at ${BRAND_NAME}.`,
    openGraph: {
      images: [{ url: `${SITE_URL}${SEO_ASSETS.ogImage}`, width: 1200, height: 630 }],
    },
  };

  if (!supabase) return fallback;

  const { data: product } = await supabase
    .from('products')
    .select('name, slug, short_description, description, price, seo_title, seo_description, product_images(url, position)')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!product) return fallback;

  const title =
    product.seo_title?.trim() ||
    `${product.name} | ${BRAND_NAME}`;
  const description =
    product.seo_description?.trim() ||
    product.short_description?.trim() ||
    product.description?.replace(/<[^>]+>/g, '').slice(0, 160) ||
    `Shop ${product.name} at ${BRAND_NAME}. Fashion and lifestyle finds in Ghana.`;

  const images = [...(product.product_images || [])].sort(
    (a: { position?: number }, b: { position?: number }) => (a.position ?? 0) - (b.position ?? 0)
  );
  const imageUrl = images[0]?.url
    ? images[0].url.startsWith('http')
      ? images[0].url
      : `${SITE_URL}${images[0].url}`
    : `${SITE_URL}${SEO_ASSETS.ogImage}`;

  const canonical = `${SITE_URL}/product/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: APP_TITLE,
      title,
      description,
      locale: 'en_GH',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: product.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getSupabase();

  // Best-effort structured-data fetch. If it fails we still render the
  // client component so SSR never breaks because of SEO concerns.
  let productLd: ReturnType<typeof productJsonLd> | null = null;
  let breadcrumb: ReturnType<typeof breadcrumbJsonLd> | null = null;

  if (supabase) {
    const { data: product } = await supabase
      .from('products')
      .select('name, slug, description, short_description, price, brand, quantity, sku, product_images(url, position), category:categories(name, slug)')
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (product) {
      const images = [...(product.product_images || [])].sort(
        (a: { position?: number }, b: { position?: number }) => (a.position ?? 0) - (b.position ?? 0),
      );
      const imageUrl = images[0]?.url
        ? images[0].url.startsWith('http')
          ? images[0].url
          : `${SITE_URL}${images[0].url}`
        : `${SITE_URL}${SEO_ASSETS.ogImage}`;

      productLd = productJsonLd({
        name: product.name,
        description:
          product.short_description?.trim() ||
          product.description?.replace(/<[^>]+>/g, '').slice(0, 500) ||
          `Shop ${product.name} at ${BRAND_NAME}.`,
        image: imageUrl,
        slug: product.slug,
        price: Number(product.price) || 0,
        currency: 'GHS',
        sku: product.sku || product.slug,
        inStock: (product.quantity ?? 0) > 0,
        brand: product.brand || BRAND_NAME,
      });

      const category = Array.isArray(product.category) ? product.category[0] : product.category;
      const breadcrumbItems = [
        { name: 'Home', path: '/' },
        { name: 'Shop', path: '/shop' },
      ];
      if (category?.name && category?.slug) {
        breadcrumbItems.push({
          name: category.name,
          path: `/shop?category=${category.slug}`,
        });
      }
      breadcrumbItems.push({ name: product.name, path: `/product/${product.slug}` });
      breadcrumb = breadcrumbJsonLd(breadcrumbItems);
    }
  }

  return (
    <>
      {productLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
        />
      )}
      {breadcrumb && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
        />
      )}
      <ProductDetailClient slug={slug} />
    </>
  );
}
