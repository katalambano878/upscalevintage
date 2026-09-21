"use client";

import Link from 'next/link';
import {
  APP_TITLE,
  CONTACT_ADDRESS,
  CONTACT_PHONE_DISPLAY,
  WHATSAPP_LINK,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from '@/lib/brand';
import BrandMark from './BrandMark';
import { useCMS } from '@/context/CMSContext';

const SHOP_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Categories', href: '/categories' },
  { label: 'About', href: '/about' },
];

const HELP_LINKS = [
  { label: 'Contact', href: '/contact' },
  { label: 'Track Order', href: '/order-tracking' },
  { label: 'Shipping', href: '/shipping' },
  { label: 'Returns & refunds', href: '/returns' },
  { label: 'FAQs', href: '/faqs' },
];

const LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

const socialButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white transition-colors duration-150 hover:border-brand-champagne hover:text-brand-champagne';

const linkClass =
  'text-xs sm:text-sm text-white/70 transition-colors duration-150 hover:text-brand-champagne';

export default function Footer() {
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || APP_TITLE;
  const contactPhone = getSetting('contact_phone') || CONTACT_PHONE_DISPLAY;
  const contactAddress = getSetting('contact_address') || CONTACT_ADDRESS;
  const socialInstagram = getSetting('social_instagram') || INSTAGRAM_URL;
  const phoneHref = `tel:${contactPhone.replace(/\s/g, '')}`;

  return (
    <footer className="mt-10 bg-black pb-24 text-white lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="shrink-0" aria-label={`${siteName} homepage`}>
              <BrandMark tone="dark" className="h-16 sm:h-[4.5rem]" />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href={socialInstagram}
              target="_blank"
              rel="noopener noreferrer"
              className={socialButtonClass}
              aria-label="Instagram"
            >
              <i className="ri-instagram-line text-base" />
            </a>
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={socialButtonClass}
              aria-label="WhatsApp"
            >
              <i className="ri-whatsapp-line text-base" />
            </a>
            <a href={phoneHref} className={socialButtonClass} aria-label="Call us">
              <i className="ri-phone-line text-base" />
            </a>
          </div>
        </div>

        <nav
          className="mt-6 grid grid-cols-3 gap-x-4 gap-y-5 sm:mt-8 sm:gap-x-8"
          aria-label="Footer navigation"
        >
          <div>
            <p className="mb-2.5 text-xs font-semibold text-brand-champagne">Shop</p>
            <ul className="space-y-1.5">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2.5 text-xs font-semibold text-brand-champagne">Help</p>
            <ul className="space-y-1.5">
              {HELP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2.5 text-xs font-semibold text-brand-champagne">Legal</p>
            <ul className="space-y-1.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-white/60 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <i className="ri-map-pin-line shrink-0 text-brand-champagne" />
            <span className="truncate">{contactAddress}</span>
          </span>
          <a href={phoneHref} className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-champagne">
            <i className="ri-phone-line shrink-0 text-brand-champagne" />
            {contactPhone}
          </a>
          <a
            href={socialInstagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-brand-champagne"
          >
            <i className="ri-instagram-line shrink-0 text-brand-champagne" />
            {INSTAGRAM_HANDLE}
          </a>
        </div>

        <div className="mt-5 flex flex-col gap-2 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {siteName}
          </p>
        </div>
      </div>
    </footer>
  );
}
