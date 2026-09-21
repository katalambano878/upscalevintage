import { NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { noteAction } from '@/lib/audit';
import { allow } from '@/lib/staff-gate';

const MAX_PRODUCTS = 500;

function productIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)).slice(0, MAX_PRODUCTS);
}

export async function POST(request: Request) {
  const gate = await allow(request, 'sales.manage');
  if (gate.denied) return gate.denied;
  const auth = gate.auth;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const ids = productIds(body?.product_ids);

  if (!ids.length) {
    return NextResponse.json({ error: 'Select at least one product.' }, { status: 400 });
  }

  if (action !== 'apply' && action !== 'clear') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const percent = Number(body?.percent);
  if (action === 'apply' && (!Number.isFinite(percent) || percent <= 0 || percent >= 100)) {
    return NextResponse.json({ error: 'Enter a discount between 1 and 99 percent.' }, { status: 400 });
  }

  try {
    const updated = await transaction(async (client) => {
      if (action === 'clear') {
        const products = await client.query(
          `UPDATE products
              SET sale_price = NULL, updated_at = now()
            WHERE id = ANY($1::uuid[])`,
          [ids]
        );
        await client.query(
          `UPDATE product_variants
              SET sale_price = NULL
            WHERE product_id = ANY($1::uuid[])`,
          [ids]
        );
        return products.rowCount ?? 0;
      }

      const products = await client.query(
        `UPDATE products
            SET sale_price = ROUND((price * (1 - $2::numeric / 100))::numeric, 2),
                updated_at = now()
          WHERE id = ANY($1::uuid[])
            AND price > 0
            AND ROUND((price * (1 - $2::numeric / 100))::numeric, 2) > 0
            AND ROUND((price * (1 - $2::numeric / 100))::numeric, 2) < price`,
        [ids, percent]
      );
      await client.query(
        `UPDATE product_variants
            SET sale_price = ROUND((price * (1 - $2::numeric / 100))::numeric, 2)
          WHERE product_id = ANY($1::uuid[])
            AND price > 0
            AND ROUND((price * (1 - $2::numeric / 100))::numeric, 2) > 0
            AND ROUND((price * (1 - $2::numeric / 100))::numeric, 2) < price`,
        [ids, percent]
      );
      return products.rowCount ?? 0;
    });

    await noteAction(request, auth.user?.id, action === 'clear' ? 'sale.clear' : 'sale.apply', 'product', null, {
      count: updated,
      percent: action === 'apply' ? percent : undefined,
    });

    return NextResponse.json({ updated });
  } catch (err: unknown) {
    console.error('[admin/sales/products]', err);
    return NextResponse.json({ error: 'Could not update sale prices.' }, { status: 500 });
  }
}
