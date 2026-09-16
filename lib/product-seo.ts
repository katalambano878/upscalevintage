/** Shared helpers to generate product SEO fields. */

const GENERIC_CATEGORIES = new Set([
  'new',
  'uncategorized',
  'general',
  'other',
  'category',
  'test',
  'default',
]);

export function slugifyProduct(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function stripHtml(value: string): string {
  return (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clipAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace >= Math.floor(max * 0.55) ? cut.slice(0, lastSpace) : cut).trim();
}

function usableCategory(name?: string | null): string {
  const category = (name || '').trim();
  if (!category || GENERIC_CATEGORIES.has(category.toLowerCase())) return '';
  return category;
}

export type ProductSeoInput = {
  name: string;
  description?: string | null;
  categoryName?: string | null;
  siteName?: string | null;
};

export type ProductSeoFields = {
  seo_title: string;
  seo_description: string;
  tags: string[];
  slug: string;
};

export function buildProductSeo(input: ProductSeoInput): ProductSeoFields {
  const siteName = (input.siteName || process.env.NEXT_PUBLIC_SITE_NAME || 'Upscale Vintage').trim();
  const name = (input.name || '').trim() || 'Product';
  const category = usableCategory(input.categoryName);
  const plainDesc = stripHtml(input.description || '');

  const titleParts = [name];
  if (category) titleParts.push(category);
  titleParts.push(siteName);
  const seo_title = clipAtWord(titleParts.join(' | '), 60);

  let seo_description = plainDesc;
  if (!seo_description) {
    const where = category ? ` in ${category}` : '';
    seo_description = `Shop ${name}${where} at ${siteName}. Fast delivery across Ghana.`;
  }
  seo_description = clipAtWord(seo_description, 160);

  const tags = Array.from(
    new Set(
      [name, category, siteName, 'Ghana', 'buy online Ghana']
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );

  return {
    seo_title,
    seo_description,
    tags,
    slug: slugifyProduct(name),
  };
}
