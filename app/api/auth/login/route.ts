import { z } from 'zod';
import { clientIp, fail, ok, readJson, route } from '@/lib/api';
import { recordAudit } from '@/lib/audit';
import { createSession, isStaffRole } from '@/lib/auth';
import { authenticate } from '@/lib/repositories/users';
import { RATE_LIMITS, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(1, 'Enter your password.'),
});

export const POST = route(async (request) => {
    const limit = checkRateLimit(`login:${getClientIdentifier(request)}`, RATE_LIMITS.login);
    if (!limit.success) {
        return fail(
            `Too many sign-in attempts. Try again in ${limit.resetIn} seconds.`,
            429,
            'rate_limited'
        );
    }

    const { email, password } = await readJson(request, schema);
    const user = await authenticate(email, password);

    if (!user) {
        return fail('Email or password is incorrect.', 401, 'invalid_credentials');
    }

    const ipAddress = clientIp(request);
    await createSession(user.id, {
        userAgent: request.headers.get('user-agent'),
        ipAddress,
    });

    if (isStaffRole(user.role)) {
        await recordAudit({
            userId: user.id,
            action: 'auth.login',
            entityType: 'session',
            details: { email: user.email, role: user.role },
            ipAddress,
        });
    }

    return ok({ id: user.id, email: user.email, role: user.role });
});
