import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { canAny } from '@/lib/permissions';
import { allow } from '@/lib/staff-gate';
import { syncProductMedia } from '@/lib/data/catalog-sync';
import { PRODUCT_VARIANTS_JSON_SQL } from '@/lib/product-variants';
import { ensureUniqueProductSlug } from '@/lib/unique-product-slug';

const PRODUCT_SELECT = `
  p.*,
  CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) END AS categories,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('id', pi.id, 'url', pi.url, 'position', pi.position, 'alt_text', pi.alt_text) ORDER BY pi.position)
     FROM product_images pi WHERE pi.product_id = p.id),
    '[]'::jsonb
  ) AS product_images,
  ${PRODUCT_VARIANTS_JSON_SQL},
  (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id) AS variants_count
`;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('q')?.trim();

  const auth = await allow(request, ['products.manage', 'inventory.manage', 'sales.manage', 'pos.use', 'orders.view']);
  const isStaff = !auth.denied && (auth.auth.role === 'admin' || auth.auth.role === 'staff');
  const canSeeFullCatalog = Boolean(auth.auth.user && canAny(auth.auth.user, ['products.manage', 'inventory.manage', 'sales.manage']));

  if (status && status !== 'active' && !canSeeFullCatalog) {
    return NextResponse.json({ error: isStaff ? 'You do not have permission to do that.' : 'Unauthorized' }, { status: isStaff ? 403 : 401 });
  }

  const params: unknown[] = [];
  const where: string[] = [];

  const effectiveStatus = status || (isStaff ? null : 'active');
  if (effectiveStatus && effectiveStatus !== 'all') {
    params.push(effectiveStatus);
    where.push(`p.status = $${params.length}::product_status`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length} OR COALESCE(p.sku, '') ILIKE $${params.length} OR COALESCE(c.name, '') ILIKE $${params.length})`
    );
  }

  let orderSql = 'p.created_at DESC';
  if (sort === 'price_asc') orderSql = 'p.price ASC';
  if (sort === 'price_desc') orderSql = 'p.price DESC';
  if (sort === 'name') orderSql = 'p.name ASC';
  if (sort === 'stock') orderSql = 'p.quantity ASC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const result = await query(
      `SELECT ${PRODUCT_SELECT}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ORDER BY ${orderSql}`,
      params
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[catalog/products GET]', err);
    return NextResponse.json({ error: 'Failed to list products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await allow(request, 'products.manage');
  if (gate.denied) return gate.denied;
  const auth = gate.auth;

  try {
    const body = await request.json();
    const {
      name,
      slug,
      price,
      category_id,
      status = 'draft',
      description,
      short_description,
      quantity = 0,
      sale_price,
      compare_at_price,
      featured = false,
      metadata = {},
      sku,
      seo_title,
      seo_description,
      tags,
    } = body;

    const productName = String(name || '').trim();
    const productSlug = await ensureUniqueProductSlug(String(slug || productName));
    const numericPrice = Number(price);
    const allowedStatus = new Set(['active', 'draft', 'archived']);
    const productStatus = allowedStatus.has(String(status).toLowerCase())
      ? String(status).toLowerCase()
      : 'draft';
    const category =
      typeof category_id === 'string' && /^[0-9a-f-]{36}$/i.test(category_id) ? category_id : null;

    if (!productName || !productSlug || !Number.isFinite(numericPrice)) {
      return NextResponse.json(
        { error: 'Name, URL slug, and a valid price are required.' },
        { status: 400 }
      );
    }

    const created = await queryOne(
      `INSERT INTO products (
         name, slug, price, category_id, status, description, short_description,
         quantity, sale_price, compare_at_price, featured, metadata, sku,
         seo_title, seo_description, tags, moq
       )
       VALUES (
         $1, $2, $3, $4::uuid, $5::product_status, $6, $7,
         $8, $9, $10, $11, $12::jsonb, $13,
         $14, $15, $16::text[], $17
       )
       RETURNING *`,
      [
        productName,
        productSlug,
        numericPrice,
        category,
        productStatus,
        description || null,
        short_description || null,
        Number(quantity) || 0,
        sale_price === '' || sale_price == null ? null : Number(sale_price),
        compare_at_price === '' || compare_at_price == null ? null : Number(compare_at_price),
        Boolean(featured),
        JSON.stringify(metadata || {}),
        sku || null,
        seo_title || null,
        seo_description || null,
        Array.isArray(tags) ? tags : [],
        Number(body.moq) > 0 ? Number(body.moq) : 1,
      ]
    );

    if (!created) {
      return NextResponse.json({ error: 'Create failed' }, { status: 500 });
    }

    if (body.images || body.variants) {
      await syncProductMedia(created.id as string, body.images, body.variants);
    }

    await noteAction(request, auth.user?.id, 'product.create', 'product', String(created.id), {
      name: created.name,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '23505') {
      return NextResponse.json({ error: 'A product with that slug or SKU already exists.' }, { status: 409 });
    }
    if (code === '22P02' || code === '23514') {
      return NextResponse.json({ error: 'One of the product values is not valid.' }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Create failed';
    console.error('[catalog/products POST]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
