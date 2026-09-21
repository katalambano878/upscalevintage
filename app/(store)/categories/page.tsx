import Link from 'next/link';
import CategoryGrid, { type CategoryCardData } from '@/components/CategoryGrid';
import { listCategories } from '@/lib/data/products';
import { HERO_IMAGE_VERSION, PAGE_HERO_IMAGES } from '@/lib/brand';

/** Runtime-only: build containers often lack DATABASE_URL. */
export const dynamic = 'force-dynamic';

const COLLECTION_ORDER = [
  'fashion',
  'accessories',
  'beauty',
  'lifestyle',
  'imported',
  'home-appliances',
  'luxury-cars',
] as const;

const HIDDEN_SLUGS = new Set(['new', 'new-category']);

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
};

export default async function CategoriesPage() {
  let rows: CategoryRow[] = [];

  try {
    rows = (await listCategories(true)) as CategoryRow[];
  } catch (err) {
    console.error('[categories] Failed to load categories:', err);
  }

  const categories: CategoryCardData[] = rows
    .filter((category) => !HIDDEN_SLUGS.has(category.slug))
    .sort((a, b) => {
      const aIndex = COLLECTION_ORDER.indexOf(a.slug as (typeof COLLECTION_ORDER)[number]);
      const bIndex = COLLECTION_ORDER.indexOf(b.slug as (typeof COLLECTION_ORDER)[number]);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    })
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      image: `/categories/${category.slug}.png`,
    }));

  return (
    <main className="bg-white">
      <section className="relative isolate min-h-[52vh] overflow-hidden bg-black text-white md:min-h-[58vh]">
        <img
          src={`${PAGE_HERO_IMAGES.categories}?v=${HERO_IMAGE_VERSION}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/10" />
        <div className="relative z-10 mx-auto flex min-h-[52vh] max-w-[1400px] flex-col justify-end px-4 py-12 sm:px-6 md:min-h-[58vh] md:py-16">
          <p className="text-sm font-medium text-brand-champagne">Collections</p>
          <h1 className="mt-3 max-w-xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
            Shop by category
          </h1>
          <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/75">
            Fashion, bags, beauty, and home imports, gathered in one place.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 md:pb-20 md:pt-14">
        <CategoryGrid categories={categories} />
      </section>

      <section className="bg-black">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:py-14">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Looking for something specific?</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">
              Browse the full shop, or message us and we will help you find it.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/shop" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-black">
              Shop all
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center rounded-full border border-brand-champagne/70 px-6 text-sm font-semibold text-brand-champagne"
            >
              Contact us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
