import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  const gate = await allow(request, 'categories.manage');
  if (gate.denied) return gate.denied;
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
    await noteAction(request, gate.auth.user?.id, 'category.update', 'category', id, {
      name: row?.name,
    });
    return NextResponse.json(row);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const gate = await allow(request, 'categories.manage');
  if (gate.denied) return gate.denied;
  const { id } = await context.params;
  try {
    await query(`UPDATE products SET category_id = NULL WHERE category_id = $1::uuid`, [id]);
    await query(`DELETE FROM categories WHERE id = $1::uuid`, [id]);
    await noteAction(request, gate.auth.user?.id, 'category.delete', 'category', id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
