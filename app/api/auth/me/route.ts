import { ok, route } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
    const user = await getCurrentUser();
    return ok({ user });
});
