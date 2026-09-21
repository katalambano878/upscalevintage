'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  background_color: string;
  text_color: string;
  button_text?: string;
  button_url?: string;
}

const DEFAULT_ITEMS = [
  { icon: 'ri-shopping-bag-3-line', text: 'Fashion, bags, beauty & home imports' },
  { icon: 'ri-map-pin-line', text: 'Shop with us in Accra' },
  { icon: 'ri-whatsapp-line', text: 'Order on WhatsApp' },
] as const;

export default function AnnouncementBar() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [banners.length]);

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/storefront/banners?position=top');
      if (!res.ok) return;
      const data = (await res.json()) as Banner[];
      setBanners(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching banners:', error);
    }
  };

  const dismissBanner = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    setCurrentIndex(0);
  };

  const visibleBanners = banners.filter((b) => !dismissed.has(b.id));

  if (visibleBanners.length === 0) {
    const loop = [...DEFAULT_ITEMS, ...DEFAULT_ITEMS];

    return (
      <div className="bg-black text-white">
        <div className="overflow-hidden sm:hidden" aria-label="Store announcements">
          <div className="announcement-marquee flex w-max items-center py-2.5">
            {loop.map((item, index) => (
              <p
                key={`${item.text}-${index}`}
                className="flex shrink-0 items-center gap-2 px-5 text-[13px] font-medium"
                aria-hidden={index >= DEFAULT_ITEMS.length}
              >
                <i className={`${item.icon} text-sm text-brand-champagne`} aria-hidden />
                <span>{item.text}</span>
                <span className="ml-5 text-brand-champagne/70" aria-hidden>
                  ·
                </span>
              </p>
            ))}
          </div>
        </div>

        <div className="mx-auto hidden max-w-[1440px] grid-cols-3 divide-x divide-white/10 px-6 py-2.5 text-[13px] font-medium sm:grid">
          {DEFAULT_ITEMS.map((item) => (
            <p key={item.text} className="flex items-center justify-center gap-2">
              <i className={`${item.icon} text-sm text-brand-champagne`} aria-hidden />
              <span>{item.text}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }

  const currentBanner = visibleBanners[currentIndex % visibleBanners.length];

  return (
    <div
      className="relative py-2.5 px-4 text-center text-sm"
      style={{
        backgroundColor: currentBanner.background_color,
        color: currentBanner.text_color,
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-4">
        <p className="font-medium">
          {currentBanner.title}
          {currentBanner.subtitle && <span className="ml-2 opacity-90">{currentBanner.subtitle}</span>}
        </p>

        {currentBanner.button_text && currentBanner.button_url && (
          <Link
            href={currentBanner.button_url}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              backgroundColor: currentBanner.text_color,
              color: currentBanner.background_color,
            }}
          >
            {currentBanner.button_text}
          </Link>
        )}
      </div>

      <button
        onClick={() => dismissBanner(currentBanner.id)}
        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
        style={{ color: currentBanner.text_color }}
        aria-label="Dismiss banner"
      >
        <i className="ri-close-line"></i>
      </button>

      {visibleBanners.length > 1 && (
        <div className="absolute left-4 top-1/2 flex -translate-y-1/2 gap-1">
          {visibleBanners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 w-1.5 rounded-full ${
                idx === currentIndex % visibleBanners.length ? 'opacity-100' : 'opacity-40'
              }`}
              style={{ backgroundColor: currentBanner.text_color }}
              aria-label={`Go to banner ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
