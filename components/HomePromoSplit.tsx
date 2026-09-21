'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function nextDailyReset(): number {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return end.getTime();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function useFlashCountdown() {
  const [remaining, setRemaining] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, nextDailyReset() - Date.now());
      setRemaining({
        hours: Math.floor(diff / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
        seconds: Math.floor((diff % 60_000) / 1000),
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return remaining;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[3.25rem] text-center">
      <p className="text-[1.65rem] font-semibold tabular-nums leading-none tracking-tight text-white sm:text-[1.85rem]">
        {pad(value)}
      </p>
      <p className="mt-1.5 text-[11px] font-medium text-white/55">{label}</p>
    </div>
  );
}

export default function HomePromoSplit() {
  const { hours, minutes, seconds } = useFlashCountdown();

  return (
    <section className="bg-white py-10 md:py-16">
      <div className="mx-auto grid max-w-[1400px] gap-4 px-4 sm:px-6 lg:grid-cols-2 lg:gap-5">
        <article className="relative min-h-[260px] overflow-hidden rounded-[1.75rem] bg-[#F3F5F7] md:min-h-[300px]">
          <img
            src="/promo/accessories.png?v=bags"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
          />
          <div className="relative z-10 flex h-full max-w-[17rem] flex-col justify-center px-7 py-8 sm:px-9">
            <h2 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-tight text-brand-espresso sm:text-[2rem]">
              Bags & Accessories
            </h2>
            <p className="mt-3 max-w-[13.5rem] text-pretty text-[15px] leading-relaxed text-brand-cocoa/65">
              Statement bags, watches, and finishing touches from the import edit.
            </p>
            <Link
              href="/shop?category=accessories"
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand-espresso transition-colors duration-150 hover:text-black"
            >
              Shop Accessories
              <span aria-hidden>→</span>
            </Link>
          </div>
        </article>

        <article className="relative min-h-[260px] overflow-hidden rounded-[1.75rem] bg-[#07090D] md:min-h-[300px]">
          <img
            src="/promo/flash-deals.png?v=fashion"
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[80%_center]"
          />
          <div className="relative z-10 flex h-full max-w-[20rem] flex-col justify-center px-7 py-8 sm:px-9">
            <h2 className="text-balance text-[1.75rem] font-semibold leading-tight tracking-tight text-white sm:text-[2rem]">
              Flash Deals
            </h2>
            <p className="mt-3 max-w-[15rem] text-pretty text-[15px] leading-relaxed text-white/70">
              Limited-time fashion, bags, and import drops you don&apos;t want to miss.
            </p>
            <div className="mt-6 flex items-start gap-3" aria-label="Flash deal countdown">
              <CountdownUnit value={hours} label="Hours" />
              <span className="pt-0.5 text-xl font-semibold text-white/35" aria-hidden>
                :
              </span>
              <CountdownUnit value={minutes} label="Mins" />
              <span className="pt-0.5 text-xl font-semibold text-white/35" aria-hidden>
                :
              </span>
              <CountdownUnit value={seconds} label="Secs" />
            </div>
            <Link
              href="/shop?featured=true"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors duration-150 hover:text-white/80"
            >
              Shop Now
              <span aria-hidden>→</span>
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
