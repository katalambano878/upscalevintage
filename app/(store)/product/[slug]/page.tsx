import type { Metadata } from 'next';
import { getProductBySlug } from '@/lib/data/products';
import { stripHtml } from '@/lib/product-seo';
import { absoluteAsset, BRAND_ASSETS, getSiteUrl } from '@/lib/site-brand';
import ProductDetailClient from './ProductDetailClient';

export const dynamic = 'force-dynamic';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Upscale Vintage';
const siteUrl = getSiteUrl();

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProductBySlug(slug);
    if (!product) {
      return { title: `Product | ${siteName}` };
    }
    const title = (product.seo_title as string) || `${product.name} | ${siteName}`;
    const description =
      (product.seo_description as string) ||
      stripHtml(String(product.short_description || product.description || '')).slice(0, 160) ||
      `Shop ${product.name} at ${siteName}.`;
    const images = Array.isArray(product.product_images)
      ? (product.product_images as { url?: string }[])
      : [];
    const image = images[0]?.url || absoluteAsset(BRAND_ASSETS.ogImage);

    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/product/${slug}` },
      openGraph: {
        title,
        description,
        url: `${siteUrl}/product/${slug}`,
        siteName,
        locale: 'en_GH',
        images: [{ url: image, width: 1200, height: 630, alt: String(product.name) }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch {
    return { title: `Product | ${siteName}` };
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
