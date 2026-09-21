import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { verifyAuth } from '@/lib/auth';
import { allow } from '@/lib/staff-gate';
import { listCategories } from '@/lib/data/products';

export async function GET(request: Request) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  const all = auth.authenticated;
  try {
    const rows = await listCategories(!all);
    return NextResponse.json(rows);
  } catch (err: unknown) {
    console.error('[catalog/categories GET]', err);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const gate = await allow(request, 'categories.manage');
  if (gate.denied) return gate.denied;

  const body = await request.json();
  const { name, slug, description, image_url, status = 'active', position = 0, metadata = {}, parent_id } = body;
  const categoryName = String(name || '').trim();
  const categorySlug = String(slug || categoryName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const categoryStatus = String(status).toLowerCase() === 'inactive' ? 'inactive' : 'active';
  const parent =
    typeof parent_id === 'string' && /^[0-9a-f-]{36}$/i.test(parent_id) ? parent_id : null;

  if (!categoryName || !categorySlug) {
    return NextResponse.json({ error: 'Name and slug are required.' }, { status: 400 });
  }

  try {
    const created = await queryOne(
      `INSERT INTO categories (name, slug, description, image_url, status, position, metadata, parent_id)
       VALUES ($1, $2, $3, $4, $5::category_status, $6, $7::jsonb, $8::uuid)
       RETURNING *`,
      [
        categoryName,
        categorySlug,
        description || null,
        image_url || null,
        categoryStatus,
        Number(position) || 0,
        JSON.stringify(metadata || {}),
        parent,
      ]
    );
    await noteAction(request, gate.auth.user?.id, 'category.create', 'category', created?.id, {
      name: categoryName,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '23505') {
      return NextResponse.json({ error: 'A category with that slug already exists.' }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Create failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
