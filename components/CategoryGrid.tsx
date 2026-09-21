'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface CategoryCardData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
}

const BLURBS: Record<string, string> = {
  fashion: 'Everyday style and statement pieces.',
  accessories: 'Bags, watches, and finishing touches.',
  beauty: 'Care and beauty finds worth keeping.',
  lifestyle: 'Pieces chosen for how she lives.',
  imported: 'Fresh arrivals from the import edit.',
  'home-appliances': 'Home essentials, sourced with care.',
  'luxury-cars': 'Special imported picks.',
};

function CategoryCard({
  category,
  featured,
}: {
  category: CategoryCardData;
  featured: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(!category.image);
  const description = typeof category.description === 'string' ? category.description.trim() : '';
  const blurb = description || BLURBS[category.slug] || 'Browse this collection.';

  return (
    <Link
      href={`/shop?category=${category.slug}`}
      className={`group block ${featured ? 'md:col-span-2' : ''}`}
    >
      <article
        className={`relative overflow-hidden rounded-[1.5rem] bg-black ${
          featured ? 'min-h-[320px] md:min-h-[420px]' : 'min-h-[280px] md:min-h-[360px]'
        }`}
      >
        {!imageFailed && category.image && (
          <img
            src={category.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />
        <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-champagne">Collection</p>
          <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {category.name}
          </h2>
          <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-white/70">{blurb}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors duration-150 group-hover:text-brand-champagne">
            Shop
            <span aria-hidden>→</span>
          </span>
        </div>
      </article>
    </Link>
  );
}

export default function CategoryGrid({ categories }: { categories: CategoryCardData[] }) {
  if (categories.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-black/10 px-6 py-16 text-center">
        <p className="text-lg text-brand-cocoa/70">Collections will appear here once they are added.</p>
        <Link href="/shop" className="btn-luxury-primary mt-6">
          Shop all
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      {categories.map((category, index) => (
        <CategoryCard key={category.id} category={category} featured={index === 0} />
      ))}
    </div>
  );
}
