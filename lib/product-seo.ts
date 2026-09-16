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

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'your',
  'our',
  'a',
  'an',
  'of',
  'in',
  'to',
  'on',
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

export function usableCategory(name?: string | null): string {
  const category = (name || '').trim();
  if (!category || GENERIC_CATEGORIES.has(category.toLowerCase())) return '';
  return category;
}

export type ProductSeoInput = {
  name: string;
  description?: string | null;
  categoryName?: string | null;
  siteName?: string | null;
  focusKeyword?: string | null;
};

export type ProductSeoFields = {
  seo_title: string;
  seo_description: string;
  tags: string[];
  slug: string;
  focus_keyword: string;
};

export type SeoTitleTemplate = 'brand' | 'buy-ghana' | 'category';

export function defaultFocusKeyword(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  return words.slice(0, 3).join(' ').trim();
}

export function buildSeoTitle(
  input: ProductSeoInput,
  template: SeoTitleTemplate = 'buy-ghana'
): string {
  const siteName = (input.siteName || process.env.NEXT_PUBLIC_SITE_NAME || 'Upscale Vintage').trim();
  const name = (input.name || '').trim() || 'Product';
  const category = usableCategory(input.categoryName);
  const raw =
    template === 'brand'
      ? `${name} | ${siteName}`
      : template === 'category' && category
        ? `${name} – ${category} | ${siteName}`
        : `Buy ${name} Online in Ghana | ${siteName}`;
  return clipAtWord(raw, 60);
}

export function buildProductSeo(input: ProductSeoInput): ProductSeoFields {
  const siteName = (input.siteName || process.env.NEXT_PUBLIC_SITE_NAME || 'Upscale Vintage').trim();
  const name = (input.name || '').trim() || 'Product';
  const category = usableCategory(input.categoryName);
  const plainDesc = stripHtml(input.description || '');
  const focus = (input.focusKeyword || defaultFocusKeyword(name) || name).trim();

  const seo_title = buildSeoTitle(input, 'buy-ghana');

  let seo_description = plainDesc;
  if (!seo_description) {
    const where = category ? ` in ${category}` : '';
    seo_description = `Shop ${name}${where} at ${siteName}. Fast delivery across Ghana.`;
  }
  if (focus && !seo_description.toLowerCase().includes(focus.toLowerCase())) {
    seo_description = clipAtWord(`${focus}: ${seo_description}`, 160);
  } else {
    seo_description = clipAtWord(seo_description, 160);
  }

  const nameTokens = name
    .split(/[\s,/|-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t.toLowerCase()));

  const tags = Array.from(
    new Set([name, focus, category, ...nameTokens, siteName, 'Ghana', 'buy online Ghana'].map((t) => t.trim()).filter(Boolean))
  ).slice(0, 12);

  return {
    seo_title,
    seo_description,
    tags,
    slug: slugifyProduct(name),
    focus_keyword: focus,
  };
}

export type SeoCheck = {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
};

export function scoreProductSeo(input: {
  name: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  focusKeyword?: string;
  hasImage?: boolean;
}): { score: number; checks: SeoCheck[] } {
  const focus = (input.focusKeyword || '').trim().toLowerCase();
  const title = input.seoTitle.trim();
  const desc = input.seoDescription.trim();
  const slug = input.slug.trim();
  const titleHasFocus = !!focus && title.toLowerCase().includes(focus);
  const descHasFocus = !!focus && desc.toLowerCase().includes(focus);
  const slugHasFocus = !!focus && slug.includes(slugifyProduct(focus));

  const checks: SeoCheck[] = [
    { id: 'name', label: 'Product name is at least 4 characters', ok: input.name.trim().length >= 4, weight: 10 },
    { id: 'slug', label: 'Slug is clean and at least 3 characters', ok: /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3, weight: 15 },
    { id: 'title-len', label: 'Title is 30–60 characters', ok: title.length >= 30 && title.length <= 60, weight: 15 },
    { id: 'desc-len', label: 'Description is 110–160 characters', ok: desc.length >= 110 && desc.length <= 160, weight: 15 },
    { id: 'focus', label: 'Focus keyword is set', ok: focus.length >= 2, weight: 10 },
    { id: 'focus-title', label: 'Focus keyword appears in the title', ok: titleHasFocus, weight: 10 },
    { id: 'focus-desc', label: 'Focus keyword appears in the description', ok: descHasFocus, weight: 10 },
    { id: 'focus-slug', label: 'Focus keyword appears in the slug', ok: slugHasFocus, weight: 5 },
    { id: 'keywords', label: 'At least 3 keywords', ok: input.keywords.filter(Boolean).length >= 3, weight: 5 },
    { id: 'image', label: 'Primary image is set for social preview', ok: Boolean(input.hasImage), weight: 5 },
  ];

  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  return { score, checks };
}
