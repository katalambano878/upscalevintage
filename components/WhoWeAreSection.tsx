'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AnimatedSection from './AnimatedSection';
import {
  APP_TITLE,
  BRAND_INTRO,
  BRAND_INTRO_SECONDARY,
  BRAND_INTRO_TERTIARY,
  SNAPCHAT_HANDLE,
  SNAPCHAT_URL,
} from '@/lib/brand';

const MOCKUP_IMAGES = [
  '/about-mockup-1.png',
  '/about-mockup-2.png',
  '/about-mockup-3.png',
] as const;

const SLIDE_INTERVAL_MS = 3000;

export default function WhoWeAreSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % MOCKUP_IMAGES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="pt-20 pb-14 md:py-28 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <AnimatedSection className="order-2 lg:order-1">
            <span className="brand-eyebrow mb-4 block">Our vibe</span>
            <h2 className="mb-6 text-4xl font-semibold tracking-tight text-brand-espresso md:text-5xl">
              Who We Are
            </h2>
            <div className="space-y-5 brand-body">
              <p>{BRAND_INTRO}</p>
              <p>{BRAND_INTRO_SECONDARY}</p>
              <p>{BRAND_INTRO_TERTIARY}</p>
              <p className="text-brand-cocoa/90">
                Snapchat:{' '}
                <a
                  href={SNAPCHAT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-espresso hover:text-brand-mauve underline underline-offset-2"
                >
                  {SNAPCHAT_HANDLE}
                </a>
              </p>
              <div className="pt-2">
                <Link
                  href="/about"
                  className="inline-flex items-center text-brand-espresso font-semibold text-base sm:text-lg hover:text-brand-mauve transition-colors duration-300 group"
                >
                  <span className="border-b-2 border-brand-espresso/30 group-hover:border-brand-mauve transition-colors">
                    Learn more about us
                  </span>
                </Link>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection className="order-1 lg:order-2 relative" delay={200}>
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-soft relative group bg-brand-nude/40 border border-brand-nude">
              {MOCKUP_IMAGES.map((src, index) => (
                <div
                  key={src}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                  aria-hidden={index !== currentSlide}
                >
                  <img
                    src={src}
                    alt={`${APP_TITLE} lifestyle ${index + 1}`}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                    decoding={index === 0 ? 'sync' : 'async'}
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                  />
                </div>
              ))}

              <div className="absolute inset-0 bg-black/30 pointer-events-none z-[15]" aria-hidden />

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {MOCKUP_IMAGES.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setCurrentSlide(index)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      currentSlide === index
                        ? 'w-8 bg-white shadow-sm'
                        : 'w-2 bg-white/50 hover:bg-white/80'
                    }`}
                    aria-label={`Show slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="absolute -bottom-5 -left-5 hidden max-w-xs rounded-2xl border border-black/[0.06] bg-white p-5 md:block">
              <p className="font-script text-2xl leading-tight text-brand-espresso">Good things ahead</p>
              <p className="mt-1 text-sm font-medium text-brand-cocoa/70">Fashion · Home · Lifestyle</p>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
