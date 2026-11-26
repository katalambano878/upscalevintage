import { z } from 'zod';
import { clientIp, fail, ok, readJson, route } from '@/lib/api';
import { createSession } from '@/lib/auth';
import { createUser } from '@/lib/repositories/users';
import { sendWelcomeMessage } from '@/lib/notifications';
import { validatePasswordStrength } from '@/lib/password';
import { RATE_LIMITS, checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(1, 'Choose a password.'),
    fullName: z.string().trim().min(2, 'Enter your name.').max(120).optional(),
    phone: z.string().trim().max(20).optional(),
});

export const POST = route(async (request) => {
    const limit = checkRateLimit(`register:${getClientIdentifier(request)}`, RATE_LIMITS.accountAction);
    if (!limit.success) {
        return fail(`Too many attempts. Try again in ${limit.resetIn} seconds.`, 429, 'rate_limited');
    }

    const input = await readJson(request, schema);

    const weakness = validatePasswordStrength(input.password);
    if (weakness) {
        return fail(weakness, 422, 'weak_password');
    }

    const user = await createUser({
        email: input.email,
        password: input.password,
        fullName: input.fullName ?? null,
        phone: input.phone ?? null,
    });

    await createSession(user.id, {
        userAgent: request.headers.get('user-agent'),
        ipAddress: clientIp(request),
    });

    // Best effort: a mail or SMS outage must not fail the sign-up.
    sendWelcomeMessage({
        email: user.email,
        firstName: (input.fullName || '').split(' ')[0] || 'there',
        phone: input.phone || undefined,
    }).catch((err) => console.error('[register] welcome message failed:', err));

    return ok({ id: user.id, email: user.email, role: user.role }, { status: 201 });
});
