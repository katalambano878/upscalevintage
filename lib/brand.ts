/**
 * Upscale Vintage — trendy lifestyle import & social-commerce brand
 */
export const APP_TITLE = 'Upscale Vintage';
export const BRAND_NAME = 'Upscale Vintage';
export const SHORT_NAME = 'Upscale';
export const TAGLINE =
  'Stylish fashion, accessories, and imported lifestyle finds curated for modern everyday glam.';
export const SITE_URL_DEFAULT = 'https://upscalevintage.com';
export const LOGO_PATH = '/logo.png';
export const OG_IMAGE_PATH = '/og-image.png';

export const CONTACT_ADDRESS = 'Hatso Agbogba Salasi Junction, Accra, Ghana';
export const CONTACT_PHONE = '0545035799';
export const CONTACT_PHONE_DISPLAY = '054 503 5799';
export const CONTACT_WHATSAPP = '0545035799';
export const WHATSAPP_LINK = 'https://wa.me/233545035799';

export const INSTAGRAM_HANDLE = '@upscale_vintage12';
export const INSTAGRAM_URL = 'https://instagram.com/upscale_vintage12';
export const SNAPCHAT_HANDLES = ['@limatlux', '@upscalevintage2'];

export const SUPPORT_EMAIL = 'hello@upscalevintage.com';
export const ADMIN_EMAIL_DEFAULT = 'hello@upscalevintage.com';
export const EMAIL_FROM_DEFAULT = 'Upscale Vintage <hello@upscalevintage.com>';

export const CURRENCY = 'GHS';
export const CURRENCY_SYMBOL = 'GH₵';
export const SUPABASE_PROJECT_REF = 'YOUR_PROJECT_ID';

/** Brand palette — warm, feminine, social-commerce friendly */
export const COLORS = {
  primary: '#6B3E2E',
  secondary: '#E8D7CC',
  accent: '#D4B06A',
  highlight: '#C58A94',
  background: '#FAF6F2',
  text: '#2E1F1B',
} as const;

export const LOGO_CLASS_HEADER = 'h-10 md:h-12 w-auto object-contain';

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Categories', href: '/categories' },
  { label: 'Products', href: '/shop' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
] as const;

export const NAV_LINKS_OPTIONAL = [
  { label: 'New Arrivals', href: '/shop?sort=newest' },
  { label: 'Featured', href: '/shop?featured=true' },
] as const;

export const FOOTER_TAGLINE =
  'Fashion, accessories, lifestyle finds, and imported picks curated for modern everyday style.';

/** Homepage hero slider images (lifestyle photography) */
export const HERO_IMAGES = ['/hero/hero-1.png', '/hero/hero-2.png'] as const;

export const HOME_CATEGORIES = [
  { id: 'fashion', name: 'Fashion Picks', subtitle: 'Trending everyday style', slug: 'fashion', tint: 'from-[#C58A94]/80 via-[#E8D7CC]/60 to-[#FAF6F2]' },
  { id: 'bags', name: 'Bags & Accessories', subtitle: 'Statement finishing touches', slug: 'accessories', tint: 'from-[#D4B06A]/70 via-[#E8D7CC]/50 to-[#C58A94]/40' },
  { id: 'lifestyle', name: 'Lifestyle Finds', subtitle: 'Curated living favorites', slug: 'lifestyle', tint: 'from-[#E8D7CC] via-[#FAF6F2] to-[#C58A94]/30' },
  { id: 'imports', name: 'Trending Imports', subtitle: 'Fresh sourced arrivals', slug: 'imported', tint: 'from-[#6B3E2E]/50 via-[#C58A94]/40 to-[#D4B06A]/30' },
  { id: 'beauty', name: 'Beauty & Glam', subtitle: 'Soft glam essentials', slug: 'beauty', tint: 'from-[#C58A94]/90 via-[#E8D7CC]/70 to-[#FAF6F2]' },
  { id: 'cars', name: 'Car Deals', subtitle: 'Special imported picks', slug: 'luxury-cars', tint: 'from-[#6B3E2E]/60 via-[#2E1F1B]/40 to-[#D4B06A]/25' },
] as const;

export const META_DESCRIPTION =
  'Shop curated fashion, designer bags, accessories, and imported lifestyle picks at Upscale Vintage. Trending arrivals and social-commerce style in Ghana.';
