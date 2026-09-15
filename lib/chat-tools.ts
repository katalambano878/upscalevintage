/**
 * Chat assistant tool implementations for the Upscale Vintage storefront.
 *
 * Each exported function corresponds to one "function-calling" tool the LLM
 * (Groq Llama) can invoke from /api/chat. They all run server-side and
 * query Supabase directly using the schema in
 * supabase/migrations/*_complete_schema.sql.
 *
 * Schema notes (different from generic e-commerce):
 *   - orders.email            (no separate guest_email column)
 *   - orders.total            (no grand_total alias)
 *   - coupons.code/type/value (the "discounts" table does not exist here)
 *   - order_items.product_name (not name_snapshot)
 *   - order_items.unit_price, .total_price (not line_total)
 *
 * Payments are handled exclusively through Moolre (Mobile Money) because
 * that is what the existing /api/payment/moolre route uses.
 */

import { query, queryOne, transaction } from './db';
import { trackOrder as fetchTrackedOrder } from '@/lib/data/orders';
import {
    BRAND_NAME,
    TAGLINE,
    SUPPORT_EMAIL,
    CONTACT_PHONE_DISPLAY,
    CONTACT_PHONE,
    WHATSAPP_LINK,
} from './brand';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChatProduct = {
    id: string;
    name: string;
    slug: string;
    price: number;
    image: string;
    quantity: number;
    maxStock: number;
    moq: number;
    inStock: boolean;
};

export type ChatOrder = {
    id: string;
    order_number: string;
    status: string;
    payment_status: string;
    total: number;
    created_at: string;
    tracking_number?: string;
    items: { name: string; quantity: number; price: number }[];
};

export type ChatCoupon = {
    valid: boolean;
    code: string;
    reason?: string;
    type?: string;
    value?: number;
    minimum_purchase?: number;
    maximum_discount?: number;
    expires?: string;
};

export type ChatTicket = {
    id: string;
    ticket_number: number;
    status: string;
    subject: string;
};

export type ChatReturn = {
    id: string;
    status: string;
    order_number: string;
    reason: string;
};

export type ChatCustomerProfile = {
    name: string;
    email: string;
    total_orders: number;
    total_spent: number;
    last_order_at: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const PRODUCT_SELECT = `
  id, name, slug, status, description, price, compare_at_price, quantity, moq,
  product_variants(id, name, price, compare_at_price, quantity),
  product_images(url, position)
`;

// ─── String helpers (search-term normalization) ───────────────────────────

function uniqueStrings(arr: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of arr) {
        const norm = s.trim().toLowerCase();
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        out.push(norm);
    }
    return out;
}

/**
 * Given a list of words, return them plus simple singular/plural variants so
 * "cars" → ["cars","car"] and "boxes" → ["boxes","boxe","box"].
 * Crude on purpose; covers the 95% of real-world product searches.
 */
function expandStems(words: string[]): string[] {
    const out: string[] = [];
    for (const raw of words) {
        const w = raw.toLowerCase().trim();
        if (w.length < 3) continue;
        out.push(w);
        if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y');
        else if (w.endsWith('es') && w.length > 4) out.push(w.slice(0, -2));
        else if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1));
        else out.push(w + 's');
    }
    return uniqueStrings(out);
}

// ─── 0. Get Store Categories (ground truth for the AI) ─────────────────────

export interface StoreCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
}

export interface CatalogSummaryItem {
    name: string;
    slug: string;
    price: number;
    inStock: boolean;
    categoryName: string | null;
    categorySlug: string | null;
}

/**
 * Returns every active category currently in the database. The chat route
 * injects this list into the system prompt so the AI always grounds its
 * answers about "what do you sell?" / "do you carry X?" in the real catalog
 * rather than guessing from the brand description.
 */
export async function getStoreCategories(_supabase?: unknown): Promise<StoreCategory[]> {
    try {
        const rows = await query<{ id: string; name: string; slug: string; description: string | null }>(
            `SELECT id, name, slug, description
               FROM categories
              WHERE status = 'active'
              ORDER BY position ASC NULLS LAST, name ASC`
        );
        return rows.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            description: c.description || null,
        }));
    } catch (error) {
        console.error('[ChatTools] getStoreCategories error:', error);
        return [];
    }
}

/**
 * Returns a compact summary of every active product (capped at `limit`,
 * default 60) along with its category so the AI knows the live catalog at
 * a glance. Used to ground answers about whether specific items are
 * available without triggering a full search_products tool call for every
 * yes/no question.
 */
export async function getStoreCatalogSummary(_supabase?: unknown, limit = 60): Promise<CatalogSummaryItem[]> {
    try {
        const rows = await query<{
            name: string;
            slug: string;
            price: number;
            quantity: number;
            category: { name: string; slug: string } | null;
        }>(
            `SELECT p.name, p.slug, p.price, p.quantity,
                    CASE WHEN c.id IS NULL THEN NULL
                         ELSE jsonb_build_object('name', c.name, 'slug', c.slug)
                    END AS category
               FROM products p
               LEFT JOIN categories c ON c.id = p.category_id
              WHERE p.status = 'active'
              ORDER BY p.rating_avg DESC NULLS LAST, p.created_at DESC
              LIMIT $1`,
            [limit]
        );
        return rows.map((p) => ({
            name: p.name,
            slug: p.slug,
            price: Number(p.price) || 0,
            inStock: (p.quantity ?? 0) > 0,
            categoryName: p.category?.name ?? null,
            categorySlug: p.category?.slug ?? null,
        }));
    } catch (error) {
        console.error('[ChatTools] getStoreCatalogSummary error:', error);
        return [];
    }
}

/**
 * Compute the best (lowest) effective price for a product, considering its
 * variants and any compare_at_price set on the product itself.
 */
function effectivePrice(p: any): number {
    const base = Number(p?.price) || 0;
    const variants: any[] = Array.isArray(p?.product_variants) ? p.product_variants : [];
    if (variants.length === 0) {
        return base;
    }
    const variantPrices = variants
        .map((v) => Number(v?.price))
        .filter((n) => Number.isFinite(n) && n > 0);
    if (variantPrices.length === 0) return base;
    return Math.min(...variantPrices);
}

/**
 * Total purchasable stock = main product quantity + sum of variants quantity.
 * The storefront treats either side as available; we mirror that here.
 */
function totalStock(p: any): number {
    const main = Number(p?.quantity) || 0;
    const variants: any[] = Array.isArray(p?.product_variants) ? p.product_variants : [];
    const variantSum = variants.reduce((acc, v) => acc + (Number(v?.quantity) || 0), 0);
    if (variants.length === 0) return main;
    return Math.max(main, variantSum);
}

function firstImage(p: any): string {
    const imgs: any[] = Array.isArray(p?.product_images) ? p.product_images : [];
    const sorted = [...imgs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return sorted[0]?.url || '';
}

function mapProduct(p: any): ChatProduct {
    const stock = totalStock(p);
    const moq = Math.max(1, Number(p?.moq) || 1);
    return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: effectivePrice(p),
        image: firstImage(p),
        quantity: stock,
        maxStock: stock,
        moq,
        inStock: stock >= moq,
    };
}

// ─── 1. Search Products ─────────────────────────────────────────────────────

async function loadActiveProducts(whereSql: string, params: unknown[], limit: number): Promise<ChatProduct[]> {
    const rows = await query<Record<string, unknown>>(
        `SELECT p.id, p.name, p.slug, p.status, p.description, p.price, p.compare_at_price, p.quantity, p.moq,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price, 'compare_at_price', v.compare_at_price, 'quantity', v.quantity))
                  FROM product_variants v WHERE v.product_id = p.id
                ), '[]'::jsonb) AS product_variants,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('url', i.url, 'position', i.position) ORDER BY i.position)
                  FROM product_images i WHERE i.product_id = p.id
                ), '[]'::jsonb) AS product_images
           FROM products p
          WHERE p.status = 'active' AND ${whereSql}
          ORDER BY p.rating_avg DESC NULLS LAST
          LIMIT $${params.length + 1}`,
        [...params, limit]
    );
    return rows.map((p) => mapProduct(p));
}

export async function searchProducts(_supabase: unknown, searchQuery: string, limit = 4): Promise<ChatProduct[]> {
    const term = (searchQuery || '').trim();
    if (!term) return [];

    const phrase = `%${term}%`;
    let found = await loadActiveProducts(
        `(p.name ILIKE $1 OR p.description ILIKE $1 OR COALESCE(p.brand, '') ILIKE $1)`,
        [phrase],
        limit
    );
    if (found.length) return found;

    const words = expandStems(term.toLowerCase().split(/\s+/));
    for (const word of words) {
        const w = `%${word}%`;
        found = await loadActiveProducts(
            `(p.name ILIKE $1 OR p.description ILIKE $1 OR COALESCE(p.brand, '') ILIKE $1)`,
            [w],
            limit
        );
        if (found.length) return found;
    }

    const candidates = uniqueStrings([
        term,
        term.replace(/s$/i, ''),
        ...term.split(/\s+/).filter((w) => w.length >= 3),
        ...term.split(/\s+/).map((w) => w.replace(/s$/i, '')).filter((w) => w.length >= 3),
    ]);

    for (const candidate of candidates) {
        const cat = await queryOne<{ id: string }>(
            `SELECT id FROM categories WHERE status = 'active' AND name ILIKE $1 LIMIT 1`,
            [`%${candidate}%`]
        );
        if (!cat) continue;
        found = await loadActiveProducts(`p.category_id = $1::uuid`, [cat.id], limit);
        if (found.length) return found;
    }

    return [];
}

// ─── 2. Get Product for Cart ────────────────────────────────────────────────

export async function getProductForCart(_supabase: unknown, slugOrId: string): Promise<ChatProduct | null> {
    if (!slugOrId?.trim()) return null;
    const trimmed = slugOrId.trim();
    const row = await queryOne<Record<string, unknown>>(
        `SELECT p.id, p.name, p.slug, p.status, p.description, p.price, p.compare_at_price, p.quantity, p.moq,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price, 'compare_at_price', v.compare_at_price, 'quantity', v.quantity))
                  FROM product_variants v WHERE v.product_id = p.id
                ), '[]'::jsonb) AS product_variants,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('url', i.url, 'position', i.position) ORDER BY i.position)
                  FROM product_images i WHERE i.product_id = p.id
                ), '[]'::jsonb) AS product_images
           FROM products p
          WHERE p.status = 'active'
            AND (p.id::text = $1 OR p.slug = $1)
          LIMIT 1`,
        [trimmed]
    );
    if (!row) return null;
    return mapProduct(row);
}

// ─── 3. Track Order ─────────────────────────────────────────────────────────

export async function trackOrder(_supabase: unknown, orderNumber: string, email: string): Promise<ChatOrder | null> {
    if (!orderNumber?.trim() || !email?.trim()) return null;
    const num = orderNumber.trim();
    const emailLower = email.trim().toLowerCase();

    const row = await fetchTrackedOrder(emailLower, num);
    if (!row) return null;

    const meta = (row.metadata || {}) as Record<string, unknown>;
    const items = (row.order_items || []) as Array<Record<string, unknown>>;

    return {
        id: String(row.id),
        order_number: String(row.order_number),
        status: String(row.status),
        payment_status: String(row.payment_status || 'pending'),
        total: Number(row.total) || 0,
        created_at: String(row.created_at),
        tracking_number: typeof meta.tracking_number === 'string' ? meta.tracking_number : undefined,
        items: items.map((i) => ({
            name: String(i.product_name || 'Item'),
            quantity: Number(i.quantity) || 0,
            price: Number(i.unit_price) || 0,
        })),
    };
}

// ─── 4. Get Customer Orders ─────────────────────────────────────────────────

export async function getCustomerOrders(_supabase: unknown, userId: string, limit = 5): Promise<ChatOrder[]> {
    if (!userId) return [];

    const data = await query<Record<string, unknown>>(
        `SELECT o.id, o.order_number, o.status, o.payment_status, o.total, o.created_at, o.metadata,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'product_name', oi.product_name,
                    'quantity', oi.quantity,
                    'unit_price', oi.unit_price,
                    'total_price', oi.total_price
                  ) ORDER BY oi.created_at)
                  FROM order_items oi WHERE oi.order_id = o.id
                ), '[]'::jsonb) AS order_items
           FROM orders o
          WHERE o.user_id = $1::uuid
          ORDER BY o.created_at DESC
          LIMIT $2`,
        [userId, limit]
    );

    return data.map((o) => {
        const items = Array.isArray(o.order_items) ? o.order_items : [];
        return {
            id: String(o.id ?? ''),
            order_number: String(o.order_number ?? ''),
            status: String(o.status ?? ''),
            payment_status: String(o.payment_status || 'pending'),
            total: Number(o.total) || 0,
            created_at: String(o.created_at ?? ''),
            tracking_number: undefined,
            items: items.map((i: { product_name?: string; quantity?: number; unit_price?: number }) => ({
                name: i.product_name || 'Item',
                quantity: Number(i.quantity) || 0,
                price: Number(i.unit_price) || 0,
            })),
        };
    });
}

// ─── 5. Check Coupon ────────────────────────────────────────────────────────

export async function checkCoupon(_supabase: unknown, code: string, cartTotal?: number): Promise<ChatCoupon> {
    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) return { valid: false, code: trimmed, reason: 'No code provided.' };

    const data = await queryOne<Record<string, unknown>>(
        `SELECT * FROM coupons WHERE upper(code) = upper($1) LIMIT 1`,
        [trimmed]
    );
    if (!data) {
        return { valid: false, code: trimmed, reason: 'This coupon code does not exist.' };
    }

    const isActive = data.is_active !== false;
    const now = new Date();
    const start = data.start_date ? new Date(String(data.start_date)) : null;
    const end = data.end_date ? new Date(String(data.end_date)) : null;
    const usageLimit = data.usage_limit;
    const usageCount = Number(data.usage_count ?? 0);

    const minPurchase = Number(data.minimum_purchase ?? 0) || 0;
    const maxDisc = data.maximum_discount != null ? Number(data.maximum_discount) : undefined;
    // upscalevintage uses an enum: 'percentage' | 'fixed_amount' | 'free_shipping'.
    // Normalize so the UI can render a single label.
    const rawType = data.type as string;
    const type =
        rawType === 'percentage'
            ? 'percentage'
            : rawType === 'fixed_amount'
              ? 'fixed'
              : rawType === 'free_shipping'
                ? 'free_shipping'
                : rawType || 'percentage';
    const value = Number(data.value ?? 0);

    if (!isActive) return { valid: false, code: trimmed, reason: 'This coupon is no longer active.' };
    if (start && start > now) return { valid: false, code: trimmed, reason: 'This coupon is not yet valid.' };
    if (end && end < now) return { valid: false, code: trimmed, reason: 'This coupon has expired.' };
    if (usageLimit != null && usageCount >= Number(usageLimit)) {
        return { valid: false, code: trimmed, reason: 'This coupon has reached its usage limit.' };
    }
    if (cartTotal !== undefined && minPurchase > 0 && cartTotal < minPurchase) {
        return {
            valid: false,
            code: trimmed,
            reason: `Minimum purchase of GH₵${minPurchase.toFixed(2)} required.`,
        };
    }

    return {
        valid: true,
        code: trimmed,
        type,
        value,
        minimum_purchase: minPurchase || undefined,
        maximum_discount: maxDisc,
        expires: data.end_date ? String(data.end_date) : undefined,
    };
}

// ─── 6. Create Support Ticket ───────────────────────────────────────────────

export async function createSupportTicket(
    _supabase: unknown,
    params: { userId?: string; email: string; subject: string; description: string; category?: string },
): Promise<ChatTicket | null> {
    const { userId, email, subject, description, category } = params;
    if (!email || !subject || !description) return null;

    try {
        const ticket = await queryOne<{ id: string; ticket_number: number; status: string; subject: string }>(
            `INSERT INTO support_tickets (user_id, email, subject, description, category, status, priority)
             VALUES ($1::uuid, $2, $3, $4, $5, 'open', 'medium')
             RETURNING id, ticket_number, status, subject`,
            [userId || null, email, subject, description, category || 'other']
        );

        if (!ticket) return null;

        try {
            await query(
                `INSERT INTO support_messages (ticket_id, user_id, message, is_internal)
                 VALUES ($1::uuid, $2::uuid, $3, false)`,
                [ticket.id, userId || null, description]
            );
        } catch {
            /* ignore */
        }

        return {
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            status: ticket.status,
            subject: ticket.subject,
        };
    } catch (e) {
        console.error('[ChatTools] createSupportTicket:', e);
        return null;
    }
}

// ─── 7. Initiate Return ─────────────────────────────────────────────────────

export async function initiateReturn(
    _supabase: unknown,
    params: { userId: string; orderId: string; reason: string; description: string },
): Promise<ChatReturn | null> {
    const { userId, orderId, reason, description } = params;
    if (!userId || !orderId) return null;

    try {
        const order = await queryOne<{ id: string; order_number: string; status: string; created_at: string; user_id: string }>(
            `SELECT id, order_number, status::text AS status, created_at, user_id::text AS user_id
               FROM orders WHERE id = $1::uuid`,
            [orderId]
        );

        if (!order || order.user_id !== userId || order.status !== 'delivered') return null;

        const daysSince = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 30) return null;

        const ret = await queryOne<{ id: string; status: string }>(
            `INSERT INTO return_requests (order_id, user_id, reason, description, status)
             VALUES ($1::uuid, $2::uuid, $3, $4, 'pending')
             RETURNING id, status`,
            [orderId, userId, reason, description]
        );

        if (!ret) return null;

        return { id: ret.id, status: ret.status, order_number: order.order_number, reason };
    } catch (e) {
        console.error('[ChatTools] initiateReturn:', e);
        return null;
    }
}

// ─── 8. Get Recommendations ─────────────────────────────────────────────────

export async function getRecommendations(_supabase: unknown, context?: string): Promise<ChatProduct[]> {
    const ctx = context?.trim();
    const rows = ctx
        ? await loadActiveProducts(`(p.name ILIKE $1 OR p.description ILIKE $1)`, [`%${ctx}%`], 8)
        : await query<Record<string, unknown>>(
              `SELECT p.id, p.name, p.slug, p.status, p.description, p.price, p.compare_at_price, p.quantity, p.moq,
                      COALESCE((
                        SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price, 'compare_at_price', v.compare_at_price, 'quantity', v.quantity))
                        FROM product_variants v WHERE v.product_id = p.id
                      ), '[]'::jsonb) AS product_variants,
                      COALESCE((
                        SELECT jsonb_agg(jsonb_build_object('url', i.url, 'position', i.position) ORDER BY i.position)
                        FROM product_images i WHERE i.product_id = p.id
                      ), '[]'::jsonb) AS product_images
                 FROM products p
                WHERE p.status = 'active'
                ORDER BY p.featured DESC, p.rating_avg DESC NULLS LAST, p.review_count DESC NULLS LAST
                LIMIT 8`
          ).then((r) => r.map((p) => mapProduct(p)));

    const mapped = (ctx ? rows : rows).filter((p) => p.inStock);
    return mapped.slice(0, 4);
}

// ─── 9. Get Store Info ──────────────────────────────────────────────────────

const STORE_INFO: Record<string, string> = {
    shipping: `We deliver across Ghana. Fees and timing are confirmed at checkout based on your region. Visit /shipping for the full policy.`,
    returns: `Refunds may be approved for defective or damaged items, order mix-ups, items already sold out, or packages misplaced in store. Exchanges must be completed within 24 hours of purchase, and items must arrive unworn, undamaged and in original packaging with tags. See /returns for the full policy.`,
    payment: `We accept secure Mobile Money checkout via Moolre (GHS). Guest checkout is supported.`,
    contact: `Reach ${BRAND_NAME}:\n- Email: ${SUPPORT_EMAIL}\n- Phone: ${CONTACT_PHONE_DISPLAY} (+233${CONTACT_PHONE.replace(/^0/, '')})\n- WhatsApp: ${WHATSAPP_LINK}`,
    about: `${BRAND_NAME} — ${TAGLINE} We offer fashion, bags, accessories, lifestyle finds, beauty picks, home appliances and special imports.`,
    delivery_times: `Standard delivery is typically 1-3 business days in Accra and 3-7 days outside Accra. Final estimates are shown at checkout.`,
    hours: `Shop online anytime. For fastest help, use this chat or WhatsApp ${WHATSAPP_LINK}.`,
};

export function getStoreInfo(topic: string): string {
    const key = (topic || '').toLowerCase().replace(/[^a-z_]/g, '');
    const match = Object.keys(STORE_INFO).find((k) => key.includes(k));
    if (match) return STORE_INFO[match];
    return Object.values(STORE_INFO).join('\n\n');
}

// ─── 10. Get Customer Profile ───────────────────────────────────────────────

export async function getCustomerProfile(_supabase: unknown, userId: string): Promise<ChatCustomerProfile | null> {
    if (!userId) return null;

    const profile = await queryOne<{ full_name: string | null; email: string }>(
        `SELECT p.full_name, u.email
           FROM profiles p
           JOIN users u ON u.id = p.id
          WHERE p.id = $1::uuid`,
        [userId]
    );
    if (!profile) return null;

    const orders = await query<{ total: number; created_at: string; payment_status: string }>(
        `SELECT total, created_at, payment_status::text AS payment_status FROM orders WHERE user_id = $1::uuid`,
        [userId]
    );

    let totalSpent = 0;
    let orderCount = 0;
    let lastAt: string | null = null;
    for (const o of orders || []) {
        if (o.payment_status === 'paid') {
            totalSpent += Number(o.total) || 0;
            orderCount++;
            if (!lastAt || o.created_at > lastAt) lastAt = o.created_at;
        }
    }

    return {
        name: profile.full_name || profile.email?.split('@')[0] || 'Customer',
        email: profile.email || '',
        total_orders: orderCount,
        total_spent: totalSpent,
        last_order_at: lastAt,
    };
}

// ─── 11. Create Order from Chat ─────────────────────────────────────────────

export type ChatOrderResult = {
    success: boolean;
    orderNumber?: string;
    total?: number;
    paymentUrl?: string;
    message: string;
};

interface ChatOrderItem {
    productId: string;
    quantity: number;
}

interface ChatShippingInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    region: string;
}

const DELIVERY_COSTS: Record<string, number> = {
    standard: 20,
    express: 40,
    pickup: 0,
};

const MAX_ITEMS_PER_ORDER = 20;
const MAX_QUANTITY_PER_ITEM = 10;
const MAX_FIELD_LENGTH = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;

const orderRateMap = new Map<string, { count: number; resetAt: number }>();
const ORDER_RATE_LIMIT = 3;
const ORDER_RATE_WINDOW_MS = 300_000;

function checkOrderRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = orderRateMap.get(key);
    if (!entry || now > entry.resetAt) {
        orderRateMap.set(key, { count: 1, resetAt: now + ORDER_RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= ORDER_RATE_LIMIT) return false;
    entry.count++;
    return true;
}

function sanitize(input: string): string {
    return input
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+=/gi, '')
        .trim()
        .slice(0, MAX_FIELD_LENGTH);
}

function generateOrderNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `ORD-${ts}-${rand}`;
}

export async function createChatOrder(
    supabaseFallback: any,
    params: {
        items: ChatOrderItem[];
        shipping: ChatShippingInfo;
        deliveryMethod: string;
        paymentMethod: string;
        userId?: string | null;
    },
): Promise<ChatOrderResult> {
    // Use service-role client so we can write to orders/order_items/payments
    // regardless of the (possibly anon) chat caller's RLS.
    const { items, shipping, deliveryMethod, paymentMethod, userId } = params;

    if (!items?.length) {
        return { success: false, message: 'No items provided. Please add products to your cart first.' };
    }
    if (items.length > MAX_ITEMS_PER_ORDER) {
        return { success: false, message: `Too many items. Maximum ${MAX_ITEMS_PER_ORDER} items per order.` };
    }
    if (
        !shipping.firstName ||
        !shipping.lastName ||
        !shipping.email ||
        !shipping.phone ||
        !shipping.address ||
        !shipping.city ||
        !shipping.region
    ) {
        return {
            success: false,
            message:
                'Missing shipping information. Please provide first name, last name, email, phone, address, city, and region.',
        };
    }
    if (!EMAIL_RE.test(shipping.email)) return { success: false, message: 'Please provide a valid email address.' };
    if (!PHONE_RE.test(shipping.phone)) return { success: false, message: 'Please provide a valid phone number.' };

    for (const item of items) {
        if (!UUID_RE.test(item.productId)) {
            return { success: false, message: 'Invalid product reference. Please try again.' };
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
            return { success: false, message: `Invalid quantity. Must be between 1 and ${MAX_QUANTITY_PER_ITEM}.` };
        }
    }

    if (!['standard', 'express', 'pickup'].includes(deliveryMethod)) {
        return { success: false, message: 'Invalid delivery method.' };
    }
    // upscalevintage only supports Moolre out of the box. We still allow "cod"
    // as a placeholder for stores that toggle it on later.
    if (!['moolre', 'cod'].includes(paymentMethod)) {
        return { success: false, message: 'Invalid payment method. Only Moolre Mobile Money or Cash on Delivery are supported here.' };
    }

    const rateLimitKey = shipping.email.toLowerCase().trim();
    if (!checkOrderRateLimit(rateLimitKey)) {
        return { success: false, message: 'Too many orders placed recently. Please wait a few minutes before trying again.' };
    }

    const sanitizedShipping: ChatShippingInfo = {
        firstName: sanitize(shipping.firstName),
        lastName: sanitize(shipping.lastName),
        email: shipping.email.toLowerCase().trim().slice(0, MAX_FIELD_LENGTH),
        phone: shipping.phone.replace(/[^0-9+\-() ]/g, '').slice(0, 20),
        address: sanitize(shipping.address),
        city: sanitize(shipping.city),
        region: sanitize(shipping.region),
    };

    const shippingCost = DELIVERY_COSTS[deliveryMethod];

    try {
        const productIds = items.map((i) => i.productId);
        const products = await query<Record<string, unknown>>(
            `SELECT p.id, p.name, p.slug, p.status, p.description, p.price, p.compare_at_price, p.quantity, p.moq,
                    COALESCE((
                      SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'price', v.price, 'sku', v.sku, 'compare_at_price', v.compare_at_price, 'quantity', v.quantity))
                      FROM product_variants v WHERE v.product_id = p.id
                    ), '[]'::jsonb) AS product_variants,
                    COALESCE((
                      SELECT jsonb_agg(jsonb_build_object('url', i.url, 'position', i.position) ORDER BY i.position)
                      FROM product_images i WHERE i.product_id = p.id
                    ), '[]'::jsonb) AS product_images
               FROM products p
              WHERE p.status = 'active' AND p.id = ANY($1::uuid[])`,
            [productIds]
        );

        if (!products.length) {
            return { success: false, message: 'Could not find the requested products. They may no longer be available.' };
        }

        const productMap = new Map<string, Record<string, unknown>>(products.map((p) => [String(p.id), p]));

        for (const item of items) {
            const p = productMap.get(item.productId);
            if (!p) return { success: false, message: `Product not found: ${item.productId}` };
            const stock = totalStock(p);
            if (stock < item.quantity) {
                return {
                    success: false,
                    message: `Sorry, "${p.name}" only has ${stock} units in stock, but you requested ${item.quantity}.`,
                };
            }
        }

        let subtotal = 0;
        const lineDetails: { product: any; variant: any | null; qty: number; unit: number }[] = [];

        for (const item of items) {
            const p = productMap.get(item.productId)!;
            const variants: any[] = Array.isArray(p.product_variants) ? p.product_variants : [];
            // Pick the cheapest variant by default, mirroring the storefront's
            // "default option" UX. Falls back to the product price.
            const sortedVars = [...variants].sort((a: any, b: any) => Number(a.price) - Number(b.price));
            const v = sortedVars[0] || null;
            const unit = v ? Number(v.price) : Number(p.price);
            if (!Number.isFinite(unit) || unit <= 0) {
                return { success: false, message: `Product "${p.name}" has no valid price.` };
            }
            subtotal += unit * item.quantity;
            lineDetails.push({ product: p, variant: v, qty: item.quantity, unit });
        }

        const total = subtotal + shippingCost;
        const orderNumber = generateOrderNumber();

        const shippingAddress = {
            firstName: sanitizedShipping.firstName,
            lastName: sanitizedShipping.lastName,
            fullName: `${sanitizedShipping.firstName} ${sanitizedShipping.lastName}`.trim(),
            address1: sanitizedShipping.address,
            address2: '',
            city: sanitizedShipping.city,
            state: sanitizedShipping.region,
            region: sanitizedShipping.region,
            country: 'Ghana',
            postalCode: '',
            phone: sanitizedShipping.phone,
            email: sanitizedShipping.email,
        };

        const order = await queryOne<{ id: string }>(
            `INSERT INTO orders (
               order_number, user_id, email, phone, status, payment_status, currency,
               subtotal, tax_total, shipping_total, discount_total, total,
               shipping_method, payment_method, payment_provider, shipping_address, billing_address, notes
             ) VALUES (
               $1, $2::uuid, $3, $4, 'pending'::order_status, 'pending'::payment_status, 'GHS',
               $5, 0, $6, 0, $7,
               $8, $9, $10, $11::jsonb, $12::jsonb, $13
             ) RETURNING id`,
            [
                orderNumber,
                userId || null,
                sanitizedShipping.email,
                sanitizedShipping.phone,
                subtotal,
                shippingCost,
                total,
                deliveryMethod,
                paymentMethod,
                paymentMethod === 'moolre' ? 'moolre' : null,
                JSON.stringify(shippingAddress),
                JSON.stringify(shippingAddress),
                `Chat checkout — delivery: ${deliveryMethod}, pay: ${paymentMethod}`,
            ]
        );

        if (!order) {
            return { success: false, message: 'Failed to create order. Please try checkout on the website.' };
        }

        for (const row of lineDetails) {
            await query(
                `INSERT INTO order_items (
                   order_id, product_id, variant_id, product_name, variant_name, sku,
                   unit_price, quantity, total_price
                 ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)`,
                [
                    order.id,
                    row.product.id,
                    row.variant?.id || null,
                    row.product.name,
                    row.variant?.name || null,
                    row.variant?.sku || null,
                    row.unit,
                    row.qty,
                    row.unit * row.qty,
                ]
            );
        }

        if (paymentMethod === 'cod') {
            return {
                success: true,
                orderNumber,
                total,
                message: `Order ${orderNumber} placed! Total GH₵${total.toFixed(2)} (incl. GH₵${shippingCost.toFixed(2)} delivery). Cash on delivery — our team will confirm.`,
            };
        }

        // Moolre Mobile Money flow
        const moolreApiUser = process.env.MOOLRE_API_USER;
        const moolreApiPubkey = process.env.MOOLRE_API_PUBKEY;
        const moolreAccountNumber = process.env.MOOLRE_ACCOUNT_NUMBER;

        if (!moolreApiUser || !moolreApiPubkey || !moolreAccountNumber) {
            return {
                success: true,
                orderNumber,
                total,
                message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but Moolre is not configured on this site. Please complete checkout from the cart page or contact ${SUPPORT_EMAIL}.`,
            };
        }

        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const uniqueRef = `${orderNumber}-R${Date.now()}`;
        const payload: Record<string, unknown> = {
            type: 1,
            amount: total.toString(),
            email: process.env.MOOLRE_MERCHANT_EMAIL || sanitizedShipping.email,
            externalref: uniqueRef,
            callback: `${baseUrl}/api/payment/moolre/callback`,
            redirect: `${baseUrl}/order-success?order=${encodeURIComponent(orderNumber)}&payment_success=true`,
            reusable: '0',
            currency: 'GHS',
            accountnumber: moolreAccountNumber,
            metadata: {
                customer_email: sanitizedShipping.email,
                original_order_number: orderNumber,
            },
        };
        if (process.env.MOOLRE_CALLBACK_SECRET) {
            payload.secret = process.env.MOOLRE_CALLBACK_SECRET;
        }

        try {
            const response = await fetch('https://api.moolre.com/embed/link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-USER': moolreApiUser,
                    'X-API-PUBKEY': moolreApiPubkey,
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.status === 1 && result.data?.authorization_url) {
                return {
                    success: true,
                    orderNumber,
                    total,
                    paymentUrl: result.data.authorization_url,
                    message: `Order ${orderNumber} is ready. Total GH₵${total.toFixed(2)} (incl. GH₵${shippingCost.toFixed(2)} delivery). Complete Mobile Money payment with the secure Moolre link below.`,
                };
            }

            return {
                success: true,
                orderNumber,
                total,
                message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but we could not open Moolre. Try paying from your cart or contact ${SUPPORT_EMAIL}.`,
            };
        } catch (payErr: unknown) {
            console.error('[ChatTools] Moolre payment error:', payErr);
            return {
                success: true,
                orderNumber,
                total,
                message: `Order ${orderNumber} created (GH₵${total.toFixed(2)}), but the payment link failed. Use checkout on the site.`,
            };
        }
    } catch (err: any) {
        console.error('[ChatTools] createChatOrder:', err);
        return { success: false, message: 'Something went wrong. Please use the checkout page on the website.' };
    }
}

// Exported so the rule-based fallback in the chat route can reuse it
export { BRAND_NAME, TAGLINE, SUPPORT_EMAIL, CONTACT_PHONE_DISPLAY, WHATSAPP_LINK };
