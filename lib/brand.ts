/**
 * Upscale Vintage — trendy lifestyle import & social-commerce brand
 */
export const APP_TITLE = 'Upscale Vintage';
export const BRAND_NAME = 'Upscale Vintage';
export const SHORT_NAME = 'Upscale';
export const TAGLINE = 'Good things. A brighter you.';

/** Default on-page body copy tone (use with class `brand-body`) */
export const BRAND_INTRO =
  'Upscale Vintage is a curated lifestyle and retail destination, bringing together fashion, accessories, home essentials and carefully sourced imports.';

export const BRAND_INTRO_SECONDARY =
  'We are passionate about discovering quality pieces that combine style, functionality and value — from statement fashion and bags to home appliances and everyday lifestyle essentials.';

export const BRAND_INTRO_TERTIARY =
  'With a focus on quality, trusted sourcing and exceptional finds, we make it easier to discover products you’ll love, all in one place.';
export const SITE_URL_DEFAULT = 'https://upscalevintage.shop';
export const LOGO_PATH = '/brand-mark.png';
export const OG_IMAGE_PATH = '/og-image.png';

export const CONTACT_ADDRESS = 'Hatso Agbogba Salasi Junction, Accra, Ghana';
export const CONTACT_PHONE = '0545035799';
export const CONTACT_PHONE_DISPLAY = '054 503 5799';
export const CONTACT_WHATSAPP = '0545035799';
export const WHATSAPP_LINK = 'https://wa.me/233545035799';

export const INSTAGRAM_HANDLE = '@upscale_vintage12';
export const INSTAGRAM_URL = 'https://instagram.com/upscale_vintage12';
export const SNAPCHAT_HANDLE = 'upscalevintage2';
export const SNAPCHAT_URL = `https://www.snapchat.com/add/${SNAPCHAT_HANDLE}`;
export const SNAPCHAT_HANDLES = ['@upscalevintage2'];

export const SUPPORT_EMAIL = 'hello@upscalevintage.com';
export const ADMIN_EMAIL_DEFAULT = 'hello@upscalevintage.com';
export const EMAIL_FROM_DEFAULT = 'Upscale Vintage <hello@upscalevintage.com>';

export const CURRENCY = 'GHS';
export const CURRENCY_SYMBOL = 'GH₵';
export const SUPABASE_PROJECT_REF = 'YOUR_PROJECT_ID';

/** Typography: Plus Jakarta Sans (UI + display) + Caveat (hand notes) */
export const FONTS = {
  display: 'Plus Jakarta Sans',
  sans: 'Plus Jakarta Sans',
  script: 'Caveat',
} as const;

/** Brand palette — black, white, and a lady's gold */
export const COLORS = {
  primary: '#111111',
  secondary: '#FFFFFF',
  accent: '#C5A46A',
  highlight: '#6B6B6B',
  background: '#FFFFFF',
  text: '#111111',
} as const;

export const LOGO_CLASS_HEADER = 'h-10 md:h-12 w-auto object-contain';

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Categories', href: '/categories' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact Us', href: '/contact' },
] as const;

export const NAV_LINKS_OPTIONAL = [
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
] as const;

export const FOOTER_TAGLINE = 'Good things. A brighter you.';

/** Homepage hero — editorial lifestyle (bust cache when images change) */
export const HERO_IMAGE_VERSION = '20260921h';
export const HERO_IMAGES = [
  '/hero/hero-home-1.jpg',
  '/hero/hero-home-2.jpg',
  '/hero/hero-home-3.png',
] as const;

/** Generated page heroes — no people, black/white/gold boutique aesthetic */
export const PAGE_HERO_IMAGES = {
  categories: '/hero/hero-categories.png',
  shop: '/hero/hero-shop.png',
  blog: '/hero/hero-blog.png',
  about: '/hero/hero-about.png',
  contact: '/hero/hero-contact.png',
  cart: '/hero/hero-shop.png',
  wishlist: '/hero/hero-categories.png',
  returns: '/hero/hero-contact.png',
} as const;

export const HOME_CATEGORIES = [
  { id: 'fashion', name: 'Fashion Picks', subtitle: 'Trending everyday style', slug: 'fashion', tint: 'from-[#A6A089]/80 via-[#EDE3D7]/60 to-[#FAF7F2]' },
  { id: 'bags', name: 'Bags & Accessories', subtitle: 'Statement finishing touches', slug: 'accessories', tint: 'from-[#C8A46A]/70 via-[#EDE3D7]/50 to-[#A6A089]/40' },
  { id: 'lifestyle', name: 'Lifestyle Finds', subtitle: 'Curated living favorites', slug: 'lifestyle', tint: 'from-[#EDE3D7] via-[#FAF7F2] to-[#A6A089]/30' },
  { id: 'imports', name: 'Trending Imports', subtitle: 'Fresh sourced arrivals', slug: 'imported', tint: 'from-[#8A6A58]/50 via-[#A6A089]/40 to-[#C8A46A]/30' },
  { id: 'beauty', name: 'Beauty & Care', subtitle: 'Self-care & grooming picks', slug: 'beauty', tint: 'from-[#A6A089]/90 via-[#EDE3D7]/70 to-[#FAF7F2]' },
  { id: 'appliances', name: 'Home Appliances', subtitle: 'Smart living essentials', slug: 'home-appliances', tint: 'from-[#8A6A58]/45 via-[#EDE3D7]/55 to-[#FAF7F2]' },
  { id: 'cars', name: 'Car Deals', subtitle: 'Special imported picks', slug: 'luxury-cars', tint: 'from-[#8A6A58]/60 via-[#4A403B]/40 to-[#C8A46A]/25' },
] as const;

export const META_DESCRIPTION =
  'Upscale Vintage: trending lifestyle destination and import plug in Ghana. Shop fashion, home appliances, bags, accessories, and curated imports online.';

/** Official refund & exchange policy (storefront) */
export const REFUND_POLICY = {
  title: 'Refund policy',
  refundIntro: 'A refund may be approved when one of the following applies:',
  refundReasons: [
    'A defective or damaged item was delivered.',
    'There was a mix up in your order.',
    'You paid for an item that was already sold out.',
    'A package was misplaced in store.',
  ],
  exchangeTitle: 'Exchange requirements',
  exchangeBody:
    'All items must be received unworn, undamaged, free from blemish, and in original packaging with tags still attached to qualify for an exchange.',
  exchangeWindow:
    'Exchanges must be completed within 24 hours of purchase. After that window, exchange eligibility is no longer valid.',
  finalNote:
    'If an item is received outside the criteria stated above, a return or exchange cannot be processed, regardless of circumstance. For a smooth process, please ensure your return meets these terms and conditions before you send items back.',
  contactCta: 'Questions? Contact us on WhatsApp or visit our store in Accra.',
} as const;
