'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/client/api';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';
import HorizontalScroll from '@/components/HorizontalScroll';
import NewsletterSection from '@/components/NewsletterSection';
import HomePromoSplit from '@/components/HomePromoSplit';
import HomeHero from '@/components/HomeHero';
import { usePageTitle } from '@/hooks/usePageTitle';

const CATEGORY_TINTS = [
  'from-[#EFEAE3] via-[#FAF8F5] to-[#F3EFE9]',
  'from-[#F3EFE9] via-white to-[#EFEAE3]',
  'from-[#FAF8F5] via-[#EFEAE3] to-white',
  'from-[#E8E2DA] via-[#FAF8F5] to-[#F3EFE9]',
  'from-[#FAF8F5] via-white to-[#EFEAE3]',
  'from-[#EFEAE3] via-[#F7F5F2] to-white',
] as const;

type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  metadata?: { featured?: boolean } | string | null;
};

function isFeaturedCategory(category: StoreCategory) {
  const raw = category.metadata;
  if (!raw) return false;

  let metadata: { featured?: unknown } = {};
  if (typeof raw === 'string') {
    try {
      metadata = JSON.parse(raw) as { featured?: unknown };
    } catch {
      return false;
    }
  } else {
    metadata = raw;
  }

  return metadata.featured === true;
}

const CATEGORY_CARD_CLASS =
  'flex-shrink-0 w-[72vw] max-w-[300px] sm:w-[280px] md:w-[300px] lg:w-[320px]';

export default function HomeClient() {
  usePageTitle('');
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  useEffect(() => {
    async function fetchHomeData() {
      const [productsResult, categoriesResult] = await Promise.all([
        apiGet<unknown[]>('/api/storefront/products?featured=true&limit=8'),
        fetch('/api/storefront/categories').then((r) => (r.ok ? r.json() : [])),
      ]);

      if (productsResult.error) {
        console.error('Error fetching featured products:', productsResult.error.message);
      } else {
        setFeaturedProducts((productsResult.data as unknown[]) || []);
      }
      setProductsLoading(false);

      if (!Array.isArray(categoriesResult)) {
        console.error('Error fetching categories');
      } else {
        setCategories((categoriesResult as StoreCategory[]).filter(isFeaturedCategory));
      }
      setCategoriesLoading(false);
    }

    fetchHomeData();
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <HomeHero />

      <section className="relative bg-white py-20 md:py-28">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <AnimatedSection className="mb-14">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="brand-eyebrow">Shop by category</span>
              <Link
                href="/categories"
                aria-label="View all categories"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-brand-espresso transition-colors duration-150 hover:bg-brand-espresso hover:text-white"
              >
                <i className="ri-arrow-right-line text-lg" />
              </Link>
            </div>
            <h2 className="text-4xl font-semibold tracking-tight text-brand-espresso sm:text-5xl">
              Curated for you
            </h2>
          </AnimatedSection>

          {categoriesLoading ? (
            <div className="-mx-4 sm:-mx-6">
              <HorizontalScroll aria-label="Loading categories" className="px-4 sm:px-6" autoScrollSpeed={16}>
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`${CATEGORY_CARD_CLASS} aspect-[4/5] animate-pulse rounded-3xl bg-[#F3EFE9]`}
                  />
                ))}
              </HorizontalScroll>
            </div>
          ) : categories.length > 0 ? (
            <AnimatedSection>
              <div className="-mx-4 sm:-mx-6">
                <HorizontalScroll aria-label="Shop by category" className="px-4 sm:px-6" autoScrollSpeed={16}>
                  {categories.map((category, index) => (
                    <Link
                      href={`/shop?category=${category.slug}`}
                      key={category.id}
                      className={`group block ${CATEGORY_CARD_CLASS}`}
                      draggable={false}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#F3EFE9]">
                        {category.image_url ? (
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            draggable={false}
                          />
                        ) : (
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${CATEGORY_TINTS[index % CATEGORY_TINTS.length]} transition-transform duration-700 ease-out group-hover:scale-105`}
                          />
                        )}
                        <div
                          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 from-20% to-transparent"
                          aria-hidden
                        />
                        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-6 md:p-8">
                          <span className="mb-1.5 text-xs font-medium text-white/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            Shop now
                          </span>
                          <h3 className="mb-2 text-2xl font-semibold leading-tight text-white md:text-3xl">
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="line-clamp-2 text-sm font-medium text-white/90 sm:text-base">
                              {category.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </HorizontalScroll>
              </div>
            </AnimatedSection>
          ) : null}
        </div>
      </section>

      <section className="bg-[#FAF8F5] py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="mb-14 text-center">
            <span className="brand-eyebrow mb-3 block">Handpicked</span>
            <h2 className="text-4xl font-semibold tracking-tight text-brand-espresso sm:text-5xl">
              Featured Products
            </h2>
          </AnimatedSection>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {[...Array(4)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : featuredProducts.length > 0 ? (
            <AnimatedGrid className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {featuredProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants
                  ? Math.min(...variants.map((v: any) => v.price || product.price))
                  : undefined;
                const totalVariantStock = hasVariants
                  ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0)
                  : 0;
                const effectiveStock = hasVariants ? totalVariantStock : product.quantity;

                const colorVariants: ColorVariant[] = [];
                const seenColors = new Set<string>();
                for (const v of variants) {
                  const colorName = (v as any).option2;
                  if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                    const hex = getColorHex(colorName);
                    if (hex) {
                      seenColors.add(colorName.toLowerCase().trim());
                      colorVariants.push({ name: colorName.trim(), hex });
                    }
                  }
                }

                const primaryImage = [...(product.product_images || [])].sort(
                  (a: { position?: number }, b: { position?: number }) =>
                    (a.position ?? 0) - (b.position ?? 0)
                )[0]?.url;

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.compare_at_price}
                    image={primaryImage || ''}
                    rating={product.rating_avg || 5}
                    reviewCount={product.review_count || 0}
                    badge={product.featured ? 'Featured' : undefined}
                    inStock={effectiveStock > 0}
                    maxStock={effectiveStock || 50}
                    moq={product.moq || 1}
                    hasVariants={hasVariants}
                    minVariantPrice={minVariantPrice}
                    colorVariants={colorVariants}
                  />
                );
              })}
            </AnimatedGrid>
          ) : (
            <p className="py-12 text-center font-light text-brand-mauve">New featured pieces arriving soon.</p>
          )}

          {(featuredProducts.length > 0 || !productsLoading) && (
            <div className="mt-14 text-center">
              <Link href="/shop" className="btn-luxury-primary">
                View All Products
              </Link>
            </div>
          )}
        </div>
      </section>

      <HomePromoSplit />
      <NewsletterSection />
    </main>
  );
}
