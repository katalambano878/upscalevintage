'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useCMS } from '@/context/CMSContext';
import AnnouncementBar from './AnnouncementBar';
import HeaderActions from './HeaderActions';
import { NAV_LINKS, NAV_LINKS_OPTIONAL } from '@/lib/brand';
import BrandMark from './BrandMark';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistCount, setWishlistCount] = useState(0);
  const { user } = useAuth();

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Upscale Vintage';
  const accountHref = user ? '/account' : '/auth/login';
  const pathname = usePathname();

  useEffect(() => {
    const updateWishlistCount = () => {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlistCount(wishlist.length);
    };

    updateWishlistCount();
    window.addEventListener('wishlistUpdated', updateWishlistCount);

    return () => {
      window.removeEventListener('wishlistUpdated', updateWishlistCount);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-50 border-b border-black/[0.05] bg-white/95 backdrop-blur-md">
        <div className="safe-area-top" />
        <nav aria-label="Main navigation" className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center">
            <button
              className="-ml-2 inline-flex min-h-11 min-w-11 items-center justify-center text-brand-espresso lg:hidden"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <i className="ri-menu-line text-2xl"></i>
            </button>
            <Link href="/" className="flex min-w-0 items-center" aria-label={`Go to ${siteName} homepage`}>
              <BrandMark className="h-11 sm:h-14" />
            </Link>
          </div>

          <div className="hidden items-center rounded-full bg-[#F4F2EE] p-1 lg:flex">
            {NAV_LINKS.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm transition-colors duration-150 ${
                    active ? 'bg-white font-medium text-brand-espresso shadow-sm' : 'text-brand-espresso/60 hover:text-brand-espresso'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center rounded-full border border-black/[0.08] pl-1 pr-1">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-espresso transition-colors duration-150 hover:text-brand-champagne"
              aria-label="Search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <i className={`${searchOpen ? 'ri-close-line' : 'ri-search-line'} text-lg`}></i>
            </button>
            <HeaderActions
              iconOnly
              accountHref={accountHref}
              wishlistCount={wishlistCount}
              cartCount={cartCount}
              onCartClick={() => setIsCartOpen(!isCartOpen)}
            />
          </div>
        </nav>
        {searchOpen && (
          <form onSubmit={handleSearch} className="border-t border-black/[0.05] bg-white px-4 py-3 sm:px-6 lg:px-10">
            <label className="mx-auto flex h-12 max-w-2xl items-center gap-3 rounded-full bg-[#F4F2EE] px-5">
              <span className="sr-only">Search products</span>
              <i className="ri-search-line text-lg text-brand-champagne" aria-hidden />
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fashion, bags, beauty..."
                className="h-full w-full bg-transparent text-sm text-brand-espresso outline-none placeholder:text-brand-mauve"
              />
            </label>
          </form>
        )}
      </header>

      <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 top-0 flex w-[85%] max-w-sm flex-col bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-black/[0.06] p-5">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center" aria-label={`Go to ${siteName} homepage`}>
                <BrandMark className="h-12" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="-mr-2 min-h-11 min-w-11 p-2 text-brand-mauve hover:text-brand-espresso"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <form onSubmit={handleSearch} className="border-b border-black/[0.06] p-5">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fashion, bags, beauty..."
                className="h-11 w-full rounded-full bg-[#F4F2EE] px-4 text-sm outline-none placeholder:text-brand-mauve focus:ring-1 focus:ring-brand-champagne"
              />
            </form>

            <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="block rounded-full px-4 py-3.5 text-base font-medium text-brand-espresso hover:bg-[#F4F2EE]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mx-4 my-3 h-px bg-black/[0.06]" />
              {NAV_LINKS_OPTIONAL.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-full px-4 py-3 text-sm text-brand-cocoa hover:bg-[#F4F2EE]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="mx-4 my-3 h-px bg-black/[0.06]" />
              {[
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'Wishlist', href: '/wishlist' },
                { label: 'My Account', href: '/account' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block rounded-full px-4 py-3 text-sm text-brand-mauve hover:bg-[#F4F2EE]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
