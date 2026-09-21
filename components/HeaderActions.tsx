'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

interface HeaderActionsProps {
  accountHref: string;
  wishlistCount: number;
  cartCount: number;
  onCartClick: () => void;
  iconOnly?: boolean;
  tone?: 'dark' | 'light';
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 19.25c.7-3.1 3.2-5 6.5-5s5.8 1.9 6.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <path
        d="M12 19.25s-6.75-4.2-6.75-9.05A3.7 3.7 0 0 1 12 6.9a3.7 3.7 0 0 1 6.75 3.3C18.75 15.05 12 19.25 12 19.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
      <path
        d="M4.75 6.75h1.7l1.15 9.1h9.7l1.55-6.6H7.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.25" cy="18.35" r="1.15" fill="currentColor" />
      <circle cx="16.35" cy="18.35" r="1.15" fill="currentColor" />
    </svg>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-champagne px-1 text-[10px] font-semibold tabular-nums leading-none text-black">
      {count}
    </span>
  );
}

function ActionShell({
  children,
  className = '',
  tone = 'dark',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const color =
    tone === 'light'
      ? 'text-white hover:text-brand-champagne'
      : 'text-brand-espresso hover:text-brand-champagne';

  return (
    <span
      className={`inline-flex min-h-11 items-center gap-2 text-[13px] font-medium tracking-tight transition-colors duration-150 ${color} ${className}`}
    >
      {children}
    </span>
  );
}

export default function HeaderActions({
  accountHref,
  wishlistCount,
  cartCount,
  onCartClick,
  iconOnly = false,
  tone = 'dark',
}: HeaderActionsProps) {
  const labelClass = iconOnly ? 'sr-only' : 'hidden md:inline';

  return (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <Link href={accountHref} className="hidden sm:inline-flex" aria-label="Account">
        <ActionShell tone={tone}>
          <UserIcon />
          <span className={labelClass}>Account</span>
        </ActionShell>
      </Link>

      <Link href="/wishlist" className="relative hidden sm:inline-flex" aria-label="Wishlist">
        <ActionShell tone={tone}>
          <span className="relative inline-flex">
            <HeartIcon />
            {wishlistCount > 0 && <CountBadge count={wishlistCount} />}
          </span>
          <span className={labelClass}>Wishlist</span>
        </ActionShell>
      </Link>

      <button type="button" onClick={onCartClick} aria-label={`Cart, ${cartCount} items`}>
        <ActionShell tone={tone}>
          <span className="relative inline-flex">
            <CartIcon />
            <CountBadge count={cartCount} />
          </span>
          <span className={labelClass}>Cart</span>
        </ActionShell>
      </button>
    </div>
  );
}
