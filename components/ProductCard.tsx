'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';

const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  pink: '#EC4899', purple: '#A855F7', brown: '#92400E', beige: '#D4C5A9',
  grey: '#6B7280', gray: '#6B7280', cream: '#FFFDD0', teal: '#14B8A6',
  maroon: '#800000', coral: '#FF7F50', burgundy: '#800020', olive: '#808000',
  tan: '#D2B48C', khaki: '#C3B091', charcoal: '#36454F', ivory: '#FFFFF0',
  gold: '#C5A46A', silver: '#C0C0C0', rose: '#FF007F', lavender: '#E6E6FA',
  mint: '#98FB98', peach: '#FFDAB9', wine: '#722F37', denim: '#1560BD',
  nude: '#E3BC9A', camel: '#C19A6B', sage: '#BCB88A', rust: '#B7410E',
  mustard: '#FFDB58', plum: '#8E4585', lilac: '#C8A2C8', stone: '#928E85',
  sand: '#C2B280', taupe: '#483C32', mauve: '#E0B0FF', sky: '#87CEEB',
  forest: '#228B22', cobalt: '#0047AB', emerald: '#50C878', scarlet: '#FF2400',
  aqua: '#00FFFF', turquoise: '#40E0D0', indigo: '#4B0082', crimson: '#DC143C',
  magenta: '#FF00FF', cyan: '#00FFFF', chocolate: '#7B3F00', coffee: '#6F4E37',
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
}

function formatPrice(value: number) {
  return `GH\u20B5${value.toFixed(2)}`;
}

function ProductPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(!src);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F6F6F6] text-brand-champagne">
        <i className="ri-image-line text-3xl" aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
      onError={() => setFailed(true)}
    />
  );
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  badge,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = [],
}: ProductCardProps) {
  const { addToCart } = useCart();
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice && originalPrice > displayPrice
    ? Math.round((1 - displayPrice / originalPrice) * 100)
    : 0;

  return (
    <article className="group flex h-full flex-col">
      <Link href={`/product/${slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-[#F6F6F6]">
        <ProductPhoto src={image} alt={name} />

        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {badge && (
            <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-champagne">
              {badge}
            </span>
          )}
          {discount > 0 && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-black">
              -{discount}%
            </span>
          )}
        </div>

        {!inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-black px-4 py-2 text-xs font-medium text-white">Sold out</span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pt-3">
        <Link href={`/product/${slug}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug tracking-tight text-brand-espresso transition-colors duration-150 group-hover:text-brand-champagne">
            {name}
          </h3>
        </Link>

        {colorVariants.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {colorVariants.slice(0, 5).map((color) => (
              <button
                key={color.name}
                type="button"
                title={color.name}
                onClick={() => setActiveColor(activeColor === color.name ? null : color.name)}
                className={`h-3.5 w-3.5 rounded-full border ${
                  activeColor === color.name ? 'ring-2 ring-brand-champagne ring-offset-2' : 'border-black/10'
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        )}

        <p className="mt-1.5 flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold tabular-nums text-brand-espresso">
            {hasVariants && minVariantPrice ? `From ${formatPrice(minVariantPrice)}` : formatPrice(price)}
          </span>
          {originalPrice && originalPrice > displayPrice && (
            <span className="text-xs tabular-nums text-brand-mauve line-through">{formatPrice(originalPrice)}</span>
          )}
        </p>

        <div className="mt-3">
          {hasVariants ? (
            <Link
              href={`/product/${slug}`}
              className="inline-flex h-9 w-full items-center justify-center rounded-full border border-black text-[13px] font-medium text-black transition-colors duration-150 hover:bg-black hover:text-brand-champagne"
            >
              Choose options
            </Link>
          ) : (
            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq })}
              className="inline-flex h-9 w-full items-center justify-center rounded-full bg-black text-[13px] font-medium text-white transition-colors duration-150 hover:bg-brand-champagne hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {moq > 1 ? `Add ${moq}` : 'Add to bag'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
