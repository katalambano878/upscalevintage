import 'server-only';

interface Requirement {
    name: string;
    required: boolean;
    validate?: (value: string) => string | null;
    hint: string;
}

const REQUIREMENTS: Requirement[] = [
    {
        name: 'DATABASE_URL',
        required: true,
        hint: 'PostgreSQL connection string.',
        validate: (value) =>
            /^postgres(ql)?:\/\//.test(value) ? null : 'must start with postgres:// or postgresql://',
    },
    {
        name: 'AUTH_SECRET',
        required: true,
        hint: 'Signs session cookies. Generate 48 random bytes.',
        validate: (value) => (value.length >= 32 ? null : 'must be at least 32 characters'),
    },
    {
        name: 'NEXT_PUBLIC_APP_URL',
        required: true,
        hint: 'Absolute public URL, used in emails, SMS links and SEO metadata.',
        validate: (value) => (/^https?:\/\//.test(value) ? null : 'must start with http:// or https://'),
    },
    { name: 'MOOLRE_SMS_API_KEY', required: false, hint: 'SMS notifications are skipped when unset.' },
    { name: 'RESEND_API_KEY', required: false, hint: 'Email notifications are skipped when unset.' },
    { name: 'UPLOAD_DIR', required: false, hint: 'Defaults to public/uploads, which is not persistent.' },
    { name: 'CRON_SECRET', required: false, hint: 'Required before enabling /api/cron endpoints.' },
];

export interface ConfigReport {
    ok: boolean;
    errors: string[];
    warnings: string[];
}

export function checkConfig(): ConfigReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const requirement of REQUIREMENTS) {
        const value = process.env[requirement.name]?.trim();

        if (!value) {
            const message = `${requirement.name} is not set — ${requirement.hint}`;
            if (requirement.required) errors.push(message);
            else warnings.push(message);
            continue;
        }

        const problem = requirement.validate?.(value);
        if (problem) errors.push(`${requirement.name} ${problem}.`);
    }

    for (const key of Object.keys(process.env)) {
        if (!key.startsWith('NEXT_PUBLIC_')) continue;
        if (/(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|_KEY$)/.test(key) && key !== 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY') {
            errors.push(`${key} looks like a secret but is exposed to the browser by its NEXT_PUBLIC_ prefix.`);
        }
    }

    return { ok: errors.length === 0, errors, warnings };
}

export function assertConfig(): void {
    const report = checkConfig();

    for (const warning of report.warnings) {
        console.warn(`[config] ${warning}`);
    }

    if (!report.ok) {
        throw new Error(
            `Invalid configuration:\n${report.errors.map((line) => `  - ${line}`).join('\n')}\n\n` +
            `See .env.example for the full list.`
        );
    }
}
