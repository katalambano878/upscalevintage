'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import ProductCard, { type ColorVariant } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { getColorHex } from '@/components/ProductCard';
import { cachedQuery } from '@/lib/query-cache';

import { getProductCardPricing } from '@/lib/pricing';
import { HERO_IMAGE_VERSION, PAGE_HERO_IMAGES } from '@/lib/brand';

function ShopContent() {
  usePageTitle('Shop All Products');
  const searchParams = useSearchParams();
  const salesActive = false;

  // State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([{ id: 'all', name: 'All Products', count: 0 }]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [sortBy, setSortBy] = useState('popular');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const productsPerPage = 9;

  // Initialize from URL params
  useEffect(() => {
    const category = searchParams.get('category');
    const sort = searchParams.get('sort');
    const search = searchParams.get('search');

    if (category) setSelectedCategory(category);
    if (sort) setSortBy(sort);
    // Search is handled in the fetch function via searchParams directly or we could add a state for it
  }, [searchParams]);

  // Fetch Categories from cached API
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/storefront/categories');
        if (res.ok) {
          const data = await res.json();
          if (data) setCategories(data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  // Fetch Products
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const search = searchParams.get('search');

        // Build cache key from all filter params
        const cacheKey = `shop:${selectedCategory}:${search || ''}:${priceRange.join('-')}:${selectedRating}:${sortBy}:${page}:sale:${salesActive}`;

        const { data, count, error } = await cachedQuery<{ data: any[] | null; count: number | null; error: unknown }>(
          cacheKey,
          async () => {
            const categoryParam =
              selectedCategory !== 'all' ? `&category=${encodeURIComponent(selectedCategory)}` : '';
            const res = await fetch(`/api/storefront/products?limit=500${categoryParam}`);
            if (!res.ok) {
              return { data: null, count: 0, error: new Error('Failed to load products') };
            }
            let list: any[] = await res.json();

            if (search) {
              const q = search.toLowerCase();
              list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.slug?.toLowerCase().includes(q));
            }

            if (priceRange[1] < 5000) {
              list = list.filter((p) => Number(p.price) >= priceRange[0] && Number(p.price) <= priceRange[1]);
            }

            if (selectedRating > 0) {
              list = list.filter((p) => Number(p.rating_avg || 0) >= selectedRating);
            }

            switch (sortBy) {
              case 'price-low':
                list.sort((a, b) => Number(a.price) - Number(b.price));
                break;
              case 'price-high':
                list.sort((a, b) => Number(b.price) - Number(a.price));
                break;
              case 'rating':
                list.sort((a, b) => Number(b.rating_avg || 0) - Number(a.rating_avg || 0));
                break;
              default:
                list.sort(
                  (a, b) =>
                    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
                );
            }

            const total = list.length;
            const from = (page - 1) * productsPerPage;
            const pageSlice = list.slice(from, from + productsPerPage);
            return { data: pageSlice, count: total, error: null };
          },
          2 * 60 * 1000
        );

        if (error) throw error;

        if (data) {
          const formattedProducts = data.map((p: any) => {
            const variants = p.product_variants || [];
            const hasVariants = variants.length > 0;
            const pricing = getProductCardPricing(p, salesActive);
            const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
            const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
            // Extract unique colors from option2
            const colorVariants: ColorVariant[] = [];
            const seenColors = new Set<string>();
            for (const v of variants) {
              const colorName = v.option2;
              if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                const hex = getColorHex(colorName);
                if (hex) {
                  seenColors.add(colorName.toLowerCase().trim());
                  colorVariants.push({ name: colorName.trim(), hex });
                }
              }
            }

            return {
              id: p.id,           // Product UUID for cart/orders
              slug: p.slug,       // Slug for navigation
              name: p.name,
              price: pricing.price,
              originalPrice: pricing.originalPrice,
              image: p.product_images?.[0]?.url || '',
              rating: p.rating_avg || 0,
              reviewCount: 0, // Need to implement reviews relation
              badge: pricing.saleBadge ? 'Sale' : undefined,
              inStock: effectiveStock > 0,
              maxStock: effectiveStock || 50,
              moq: p.moq || 1,
              category: p.categories?.name,
              hasVariants,
              minVariantPrice: pricing.minVariantPrice,
              colorVariants
            };
          });
          setProducts(formattedProducts);
          setTotalProducts(count || 0);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedCategory, priceRange, selectedRating, sortBy, page, searchParams, categories, salesActive]);

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  const collections = categories.filter(
    (category) => category.slug && category.slug !== 'new' && category.slug !== 'new-category' && !category.parent_id
  );

  const selectCategory = (slug: string) => {
    setSelectedCategory(slug);
    setPage(1);
    setIsFilterOpen(false);
  };

  return (
    <main className="min-h-screen bg-white">
      <section className="relative isolate flex min-h-[280px] items-end overflow-hidden bg-black text-white md:min-h-[340px]">
        <img
          src={`${PAGE_HERO_IMAGES.shop}?v=${HERO_IMAGE_VERSION}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
          <p className="text-sm font-medium text-brand-champagne">Shop</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">All products</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80 sm:text-base">
            Fashion, bags, beauty, and home imports.
          </p>
        </div>
      </section>

      <div className="sticky top-[calc(76px+env(safe-area-inset-top,0px))] z-30 flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
        >
          <i className="ri-filter-3-line" aria-hidden />
          Filters
        </button>
        <span className="text-sm tabular-nums text-brand-mauve">{totalProducts} products</span>
      </div>

      <section className="mx-auto flex max-w-[1440px] gap-10 px-4 py-10 sm:px-6 lg:px-10">
        <aside className={`${isFilterOpen ? 'fixed inset-0 z-50 overflow-y-auto bg-white p-6' : 'hidden'} lg:block lg:w-60 lg:shrink-0 lg:p-0`}>
          <div className="lg:sticky lg:top-[calc(76px+env(safe-area-inset-top,0px)+1.5rem)]">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" className="min-h-11 min-w-11">
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Category</p>
            <div className="mt-3 space-y-1">
              <button
                type="button"
                onClick={() => selectCategory('all')}
                className={`block w-full border-l-2 py-2 pl-3 text-left text-sm ${
                  selectedCategory === 'all' ? 'border-brand-champagne font-medium text-brand-espresso' : 'border-transparent text-brand-cocoa/80'
                }`}
              >
                All products
              </button>
              {collections.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => selectCategory(category.slug)}
                  className={`block w-full border-l-2 py-2 pl-3 text-left text-sm ${
                    selectedCategory === category.slug
                      ? 'border-brand-champagne font-medium text-brand-espresso'
                      : 'border-transparent text-brand-cocoa/80 hover:text-brand-espresso'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="mt-8 border-t border-black/[0.06] pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">
                Price · GH₵{priceRange[1].toLocaleString()}
              </p>
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={priceRange[1]}
                onChange={(e) => {
                  setPriceRange([0, parseInt(e.target.value, 10)]);
                  setPage(1);
                }}
                aria-label="Maximum price"
                className="mt-4 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#F4F2EE] accent-brand-champagne"
              />
              <div className="mt-2 flex justify-between text-xs text-brand-mauve">
                <span>GH₵0</span>
                <span>GH₵5,000</span>
              </div>
            </div>

            <div className="mt-8 border-t border-black/[0.06] pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand-champagne">Rating</p>
              <div className="mt-3 space-y-1">
                {[4, 3, 2, 1].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => {
                      setSelectedRating(rating === selectedRating ? 0 : rating);
                      setPage(1);
                    }}
                    className={`flex w-full items-center gap-2 py-1.5 text-sm ${
                      selectedRating === rating ? 'font-medium text-brand-espresso' : 'text-brand-cocoa/80'
                    }`}
                  >
                    <span className="text-brand-champagne">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                    <span>& up</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="mt-8 h-11 w-full rounded-full bg-black text-sm font-medium text-white lg:hidden"
            >
              Show products
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-brand-mauve">
              Showing <span className="font-medium tabular-nums text-brand-espresso">{products.length}</span> of{' '}
              <span className="font-medium tabular-nums text-brand-espresso">{totalProducts}</span> products
            </p>
            <label className="flex items-center gap-2 text-sm text-brand-mauve">
              Sort by
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-brand-espresso outline-none"
              >
                <option value="popular">Most popular</option>
                <option value="new">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Highest rated</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(6)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4" data-product-shop>
              {products.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">No products found</h2>
              <p className="mt-2 text-sm text-brand-mauve">Try another category or clear the filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setPriceRange([0, 5000]);
                  setSelectedRating(0);
                  setPage(1);
                }}
                className="mt-6 inline-flex h-11 items-center rounded-full bg-black px-6 text-sm font-medium text-white"
              >
                Clear filters
              </button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-14 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 disabled:opacity-40"
                aria-label="Previous page"
              >
                <i className="ri-arrow-left-s-line text-xl"></i>
              </button>
              <span className="text-sm font-medium tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 disabled:opacity-40"
                aria-label="Next page"
              >
                <i className="ri-arrow-right-s-line text-xl"></i>
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-store-navy border-t-transparent rounded-full animate-spin"></div></div>}>
      <ShopContent />
    </Suspense>
  );
}