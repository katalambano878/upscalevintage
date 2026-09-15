import {
  APP_TITLE,
  BRAND_NAME,
  CONTACT_ADDRESS,
  CONTACT_PHONE,
  LOGO_PATH,
  META_DESCRIPTION,
  OG_IMAGE_PATH,
  SITE_URL_DEFAULT,
  SUPPORT_EMAIL,
} from '@/lib/brand';

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '').trim();
  const isProd = process.env.NODE_ENV === 'production';
  const looksLikeLocalhost = (url: string | undefined): boolean =>
    !!url && /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);
  if (configured && !(isProd && looksLikeLocalhost(configured))) {
    return configured;
  }
  return SITE_URL_DEFAULT.replace(/\/+$/, '');
}

export const SITE_LEGAL_NAME = BRAND_NAME;
export const SITE_DEFAULT_TITLE = APP_TITLE;
export const SITE_DEFAULT_DESCRIPTION = META_DESCRIPTION;

export const BRAND_ASSETS = {
  logo: LOGO_PATH,
  logo512: '/icon-512.png',
  ogImage: OG_IMAGE_PATH,
  appleTouchIcon: '/apple-touch-icon.png',
  favicon32: '/favicon-32.png',
  favicon16: '/favicon-16.png',
  icon192: '/icon-192.png',
  icon512: '/icon-512.png',
  iconMaskable192: '/icon-maskable-192.png',
  iconMaskable512: '/icon-maskable-512.png',
} as const;

export function absoluteAsset(path: string): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function resolveSiteLogo(stored?: string | null): string {
  const value = stored?.trim();
  if (!value) return BRAND_ASSETS.logo;
  if (value.includes('supabase.co/storage')) return BRAND_ASSETS.logo;
  return value;
}

export const SITE_CONTACT = {
  email: SUPPORT_EMAIL,
  phonePrimary: CONTACT_PHONE,
  areaServed: 'GH',
  addressLocality: CONTACT_ADDRESS,
} as const;
