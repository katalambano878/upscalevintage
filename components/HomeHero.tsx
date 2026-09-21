'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HERO_IMAGES, HERO_IMAGE_VERSION } from '@/lib/brand';

const TRUST_ITEMS = [
  { icon: 'ri-leaf-line', label: 'Thoughtful choices' },
  { icon: 'ri-heart-line', label: 'Curated with care' },
  { icon: 'ri-star-line', label: 'Loved across Ghana' },
] as const;

const SLIDE_MS = 5500;

const SLIDES = [
  {
    image: HERO_IMAGES[0],
    eyebrow: 'Live beautifully every day',
    title: (
      <>
        Style for a
        <br />
        Brighter Tomorrow
      </>
    ),
    body: 'Discover thoughtfully chosen products for a happier, healthier, and more inspired you.',
  },
  {
    image: HERO_IMAGES[1],
    eyebrow: 'Fashion & bags',
    title: (
      <>
        New arrivals
        <br />
        worth dressing for
      </>
    ),
    body: 'Statement fashion, handbags, and finishing touches from the import edit.',
  },
  {
    image: HERO_IMAGES[2],
    eyebrow: 'Lifestyle imports',
    title: (
      <>
        Curated finds
        <br />
        for her home
      </>
    ),
    body: 'Beauty, home, and everyday luxury pieces chosen to live with — not just look at.',
  },
] as const;

export default function HomeHero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % SLIDES.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section
      className="relative isolate min-h-[70vh] overflow-hidden bg-black text-white lg:min-h-[calc(100svh-6rem)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Homepage highlights"
    >
      {SLIDES.map((slide, index) => (
        <div
          key={slide.image}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${
            index === active ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={index !== active}
        >
          <img
            src={`${slide.image}?v=${HERO_IMAGE_VERSION}`}
            alt=""
            width={1920}
            height={1080}
            decoding={index === 0 ? 'sync' : 'async'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className="h-full w-full object-cover object-[72%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/10" />
        </div>
      ))}

      <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-[1440px] flex-col justify-center px-4 py-16 sm:px-6 lg:min-h-[calc(100svh-6rem)] lg:px-10 xl:px-14">
        {SLIDES.map((slide, index) => (
          <div
            key={slide.eyebrow}
            className={`max-w-xl transition-opacity duration-700 ${
              index === active ? 'relative opacity-100' : 'pointer-events-none absolute opacity-0'
            }`}
          >
            <p className="mb-4 text-[15px] font-medium text-brand-champagne">{slide.eyebrow}</p>
            <h1 className="text-balance text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl md:text-[3.5rem] lg:text-[4.15rem]">
              {slide.title}
            </h1>
            <p className="mt-5 max-w-[24rem] text-pretty text-[15px] leading-relaxed text-white/80 sm:mt-6 sm:text-base">
              {slide.body}
            </p>
          </div>
        ))}

        <Link href="/shop" className="btn-luxury-primary mt-7 h-12 w-fit gap-2 px-8 sm:mt-8">
          Shop Now
          <i className="ri-arrow-right-line text-base" aria-hidden />
        </Link>
        <ul className="mt-10 hidden flex-wrap gap-x-6 gap-y-3 text-[13px] font-medium text-white/75 sm:mt-12 sm:flex">
          {TRUST_ITEMS.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-2">
              <i className={`${item.icon} text-[15px] text-brand-champagne`} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 sm:bottom-8">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.image}
            type="button"
            onClick={() => setActive(index)}
            className={`h-2 rounded-full transition-[width,background-color] duration-300 ${
              index === active ? 'w-8 bg-brand-champagne' : 'w-2 bg-white/50 hover:bg-white'
            }`}
            aria-label={`Show slide ${index + 1}`}
            aria-current={index === active}
          />
        ))}
      </div>
    </section>
  );
}
