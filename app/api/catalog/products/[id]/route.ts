import { NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';
import { syncProductMedia } from '@/lib/data/catalog-sync';
import { ensureUniqueProductSlug } from '@/lib/unique-product-slug';

type Ctx = { params: Promise<{ id: string }> };

const PRODUCT_SELECT = `
  p.*,
  CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) END AS categories,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'position', pi.position, 'alt_text', pi.alt_text) ORDER BY pi.position)
     FROM product_images pi WHERE pi.product_id = p.id),
    '[]'::jsonb
  ) AS product_images,
  COALESCE(
    (SELECT jsonb_agg(to_jsonb(pv) ORDER BY pv.created_at)
     FROM product_variants pv WHERE pv.product_id = p.id),
    '[]'::jsonb
  ) AS product_variants
`;

export async function GET(_request: Request, context: Ctx) {
  const { id } = await context.params;
  try {
    const row = await queryOne(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id::text = $1 OR p.slug = $1
       LIMIT 1`,
      [id]
    );
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (err: unknown) {
    console.error('[catalog/products/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: Ctx) {
  const gate = await allow(request, ['products.manage', 'inventory.manage']);
  if (gate.denied) return gate.denied;
  const auth = gate.auth;

  const { id } = await context.params;
  const body = await request.json();
  const { images, variants, ...fields } = body;

  const allowed = [
    'name',
    'slug',
    'description',
    'short_description',
    'price',
    'sale_price',
    'compare_at_price',
    'cost_per_item',
    'sku',
    'quantity',
    'category_id',
    'status',
    'featured',
    'metadata',
    'tags',
    'seo_title',
    'seo_description',
    'brand',
    'moq',
  ] as const;

  const sets: string[] = [];
  const params: unknown[] = [id];
  let i = 2;

  for (const key of allowed) {
    if (key in fields) {
      if (key === 'status') {
        const nextStatus = String(fields[key] || '').toLowerCase();
        sets.push(`${key} = $${i}::product_status`);
        params.push(['active', 'draft', 'archived'].includes(nextStatus) ? nextStatus : 'draft');
      } else if (key === 'metadata') {
        // Merge so keys the admin form doesn't send (e.g. color_images) survive a save.
        sets.push(`${key} = COALESCE(${key}, '{}'::jsonb) || $${i}::jsonb`);
        const meta = fields[key];
        params.push(JSON.stringify(meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}));
      } else if (key === 'category_id') {
        const nextCategory = fields[key];
        sets.push(`${key} = $${i}::uuid`);
        params.push(
          typeof nextCategory === 'string' && /^[0-9a-f-]{36}$/i.test(nextCategory)
            ? nextCategory
            : null
        );
      } else if (key === 'tags') {
        sets.push(`${key} = $${i}::text[]`);
        params.push(Array.isArray(fields[key]) ? fields[key] : []);
      } else if (key === 'slug') {
        const uniqueSlug = await ensureUniqueProductSlug(String(fields[key] || fields.name || ''), id);
        sets.push(`${key} = $${i}`);
        params.push(uniqueSlug);
      } else {
        sets.push(`${key} = $${i}`);
        params.push(fields[key]);
      }
      i++;
    }
  }

  if (!sets.length && !images && !variants) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  sets.push('updated_at = now()');

  try {
    // One transaction: if a variant insert fails (say a duplicate SKU), the
    // product keeps its old photos and options instead of losing them.
    let updated = await transaction(async (client) => {
      let row = null;
      if (sets.length) {
        const result = await client.query(
          `UPDATE products SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING *`,
          params
        );
        row = result.rows[0] ?? null;
      }
      if (images || variants) {
        await syncProductMedia(id, images, variants, client);
      }
      return row;
    });
    if (!updated) {
      updated = await queryOne(`SELECT * FROM products WHERE id = $1::uuid`, [id]);
    }
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await noteAction(request, auth.user?.id, 'product.update', 'product', id, {
      name: updated.name,
    });

    return NextResponse.json(updated);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '23505') {
      return NextResponse.json({ error: 'A product with that slug or SKU already exists.' }, { status: 409 });
    }
    console.error('[catalog/products PATCH]', err);
    return NextResponse.json({ error: 'Could not save the product. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const gate = await allow(request, 'products.manage');
  if (gate.denied) return gate.denied;

  const { id } = await context.params;
  try {
    await query(`UPDATE order_items SET product_id = NULL, variant_id = NULL WHERE product_id = $1::uuid`, [id]);
    await query(`DELETE FROM review_images WHERE review_id IN (SELECT id FROM reviews WHERE product_id = $1::uuid)`, [id]);
    await query(`DELETE FROM reviews WHERE product_id = $1::uuid`, [id]);
    await query(`DELETE FROM cart_items WHERE product_id = $1::uuid`, [id]);
    await query(`DELETE FROM wishlist_items WHERE product_id = $1::uuid`, [id]);
    await query(`DELETE FROM product_images WHERE product_id = $1::uuid`, [id]);
    await query(`DELETE FROM product_variants WHERE product_id = $1::uuid`, [id]);
    const result = await query(`DELETE FROM products WHERE id = $1::uuid RETURNING id`, [id]);
    if (!result.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await noteAction(request, gate.auth.user?.id, 'product.delete', 'product', id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
