import { clientIp, ok, route } from '@/lib/api';
import { recordAudit } from '@/lib/audit';
import { destroySession, getCurrentUser, isStaff } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
    const user = await getCurrentUser();
    if (isStaff(user)) {
        await recordAudit({
            userId: user?.id,
            action: 'auth.logout',
            entityType: 'session',
            details: { email: user?.email, role: user?.role },
            ipAddress: clientIp(request),
        });
    }
    await destroySession();
    return ok({ signedOut: true });
});
