import 'server-only';
import { query } from '@/lib/db';
import { clientIp } from '@/lib/api';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordAudit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  const entityId = input.entityId && UUID_RE.test(input.entityId) ? input.entityId : null;
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb, $6)`,
      [
        input.userId || null,
        input.action,
        input.entityType,
        entityId,
        JSON.stringify(input.details || {}),
        input.ipAddress || null,
      ]
    );
  } catch (err) {
    console.error('[audit]', err);
  }
}

export function noteAction(
  request: Request,
  userId: string | null | undefined,
  action: string,
  entityType: string,
  entityId?: unknown,
  details?: Record<string, unknown>
) {
  return recordAudit({
    userId,
    action,
    entityType,
    entityId: typeof entityId === 'string' ? entityId : null,
    details,
    ipAddress: clientIp(request),
  });
}
