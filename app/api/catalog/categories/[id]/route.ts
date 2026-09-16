import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const auth = await verifyAuth(request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const sets: string[] = [];
  const params: unknown[] = [id];
  let i = 2;
  try {
    for (const key of ['name', 'slug', 'description', 'image_url', 'status', 'position', 'metadata', 'parent_id'] as const) {
      if (key in body) {
        if (key === 'status') {
          sets.push(`${key} = $${i}::category_status`);
          params.push(body[key]);
        } else if (key === 'metadata') {
          sets.push(`${key} = $${i}::jsonb`);
          params.push(JSON.stringify(body[key]));
        } else if (key === 'parent_id') {
          const parent = body[key];
          sets.push(`${key} = $${i}::uuid`);
          params.push(typeof parent === 'string' && /^[0-9a-f-]{36}$/i.test(parent) ? parent : null);
        } else {
          sets.push(`${key} = $${i}`);
          params.push(body[key]);
        }
        i++;
      }
    }
    if (!sets.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
    sets.push('updated_at = now()');
    const row = await queryOne(`UPDATE categories SET ${sets.join(', ')} WHERE id = $1::uuid RETURNING *`, params);
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await verifyAuth(_request, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    await query(`UPDATE products SET category_id = NULL WHERE category_id = $1::uuid`, [id]);
    await query(`DELETE FROM categories WHERE id = $1::uuid`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
