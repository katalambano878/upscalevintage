"use client";

import Link from 'next/link';
import {
  APP_TITLE,
  FOOTER_TAGLINE,
  LOGO_PATH,
  LOGO_CLASS_HEADER,
  CONTACT_ADDRESS,
  CONTACT_PHONE_DISPLAY,
  WHATSAPP_LINK,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  SNAPCHAT_HANDLES,
} from '@/lib/brand';
import { useCMS } from '@/context/CMSContext';

export default function Footer() {
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || APP_TITLE;
  const siteLogo = getSetting('site_logo') || LOGO_PATH;
  const contactPhone = getSetting('contact_phone') || CONTACT_PHONE_DISPLAY;
  const contactAddress = getSetting('contact_address') || CONTACT_ADDRESS;
  const socialInstagram = getSetting('social_instagram') || INSTAGRAM_URL;

  return (
    <footer className="relative mt-16 z-0">
      <div className="absolute inset-0 bg-brand-cream/80 backdrop-blur-md rounded-t-[3rem] -z-10 overflow-hidden border-t border-white/60 shadow-[0_-8px_30px_rgba(107,62,46,0.03)]">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand-champagne/30 to-transparent" />
      </div>

      <div className="text-brand-espresso pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

            <div className="lg:col-span-1 space-y-6">
              <Link href="/" className="inline-block group">
                <img
                  src={siteLogo}
                  alt={siteName}
                  className={`${LOGO_CLASS_HEADER} max-w-[200px] drop-shadow-sm group-hover:opacity-80 transition-opacity duration-300`}
                />
              </Link>
              <p className="text-brand-cocoa/80 leading-relaxed text-sm font-light">
                {FOOTER_TAGLINE}
              </p>

              <div className="space-y-2 text-sm text-brand-cocoa/80">
                <p className="flex items-start gap-2">
                  <i className="ri-map-pin-line text-brand-espresso mt-0.5" />
                  {contactAddress}
                </p>
                <p>
                  <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="hover:text-brand-mauve transition-colors">
                    <i className="ri-phone-line text-brand-espresso mr-2" />
                    {contactPhone}
                  </a>
                </p>
                <p>
                  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-brand-mauve transition-colors">
                    <i className="ri-whatsapp-line text-brand-espresso mr-2" />
                    WhatsApp
                  </a>
                </p>
                <p>
                  <a href={socialInstagram} target="_blank" rel="noopener noreferrer" className="hover:text-brand-mauve transition-colors">
                    <i className="ri-instagram-line text-brand-espresso mr-2" />
                    {INSTAGRAM_HANDLE}
                  </a>
                </p>
                <p className="text-brand-cocoa/60 text-xs">
                  Snapchat: {SNAPCHAT_HANDLES.join(' · ')}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <a
                  href={socialInstagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-white/50 border border-brand-nude rounded-full flex items-center justify-center text-brand-espresso hover:bg-brand-espresso hover:text-brand-cream transition-all duration-300 hover:-translate-y-0.5"
                  aria-label="Instagram"
                >
                  <i className="ri-instagram-line text-lg" />
                </a>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-white/50 border border-brand-nude rounded-full flex items-center justify-center text-brand-espresso hover:bg-brand-espresso hover:text-brand-cream transition-all duration-300 hover:-translate-y-0.5"
                  aria-label="WhatsApp"
                >
                  <i className="ri-whatsapp-line text-lg" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-3 grid sm:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h4 className="font-serif text-lg text-brand-espresso tracking-wide">Shop</h4>
                <ul className="space-y-2.5 text-brand-cocoa/80 text-sm font-light">
                  <li><Link href="/" className="hover:text-brand-mauve transition-colors">Home</Link></li>
                  <li><Link href="/shop" className="hover:text-brand-mauve transition-colors">Products</Link></li>
                  <li><Link href="/categories" className="hover:text-brand-mauve transition-colors">Categories</Link></li>
                  <li><Link href="/shop?sort=newest" className="hover:text-brand-mauve transition-colors">New Arrivals</Link></li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-serif text-lg text-brand-espresso tracking-wide">Support</h4>
                <ul className="space-y-2.5 text-brand-cocoa/80 text-sm font-light">
                  <li><Link href="/contact" className="hover:text-brand-mauve transition-colors">Contact Us</Link></li>
                  <li><Link href="/order-tracking" className="hover:text-brand-mauve transition-colors">Track Order</Link></li>
                  <li><Link href="/shipping" className="hover:text-brand-mauve transition-colors">Shipping</Link></li>
                  <li><Link href="/returns" className="hover:text-brand-mauve transition-colors">Returns</Link></li>
                  <li><Link href="/faqs" className="hover:text-brand-mauve transition-colors">FAQs</Link></li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-serif text-lg text-brand-espresso tracking-wide">Brand</h4>
                <ul className="space-y-2.5 text-brand-cocoa/80 text-sm font-light">
                  <li><Link href="/about" className="hover:text-brand-mauve transition-colors">About Us</Link></li>
                  <li><Link href="/shop?featured=true" className="hover:text-brand-mauve transition-colors">Featured</Link></li>
                  <li><Link href="/shop?category=imported" className="hover:text-brand-mauve transition-colors">Imported Finds</Link></li>
                  <li><Link href="/privacy" className="hover:text-brand-mauve transition-colors">Privacy</Link></li>
                  <li><Link href="/terms" className="hover:text-brand-mauve transition-colors">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-brand-nude mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-brand-cocoa/60 tracking-wide">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <p className="italic font-display text-brand-espresso/80">Everyday glam. Curated finds.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
