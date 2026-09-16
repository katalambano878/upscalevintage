import { queryOne } from '@/lib/db';
import { slugifyProduct } from '@/lib/product-seo';

export async function ensureUniqueProductSlug(raw: string, excludeId?: string): Promise<string> {
  const base = slugifyProduct(raw) || `product-${Date.now().toString(36)}`;
  let candidate = base;
  let n = 2;

  for (;;) {
    const clash = excludeId
      ? await queryOne<{ id: string }>(
          `SELECT id FROM products WHERE slug = $1 AND id <> $2::uuid LIMIT 1`,
          [candidate, excludeId]
        )
      : await queryOne<{ id: string }>(`SELECT id FROM products WHERE slug = $1 LIMIT 1`, [candidate]);

    if (!clash) return candidate;
    candidate = `${base}-${n++}`;
  }
}
