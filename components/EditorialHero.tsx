import { HERO_IMAGE_VERSION } from '@/lib/brand';

interface EditorialHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  image: string;
}

export default function EditorialHero({ eyebrow, title, subtitle, image }: EditorialHeroProps) {
  return (
    <section className="relative isolate flex min-h-[300px] items-end overflow-hidden bg-black text-white md:min-h-[380px]">
      <img
        src={`${image}?v=${HERO_IMAGE_VERSION}`}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15" />
      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10 md:py-16">
        <p className="text-sm font-medium text-brand-champagne">{eyebrow}</p>
        <h1 className="mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-white/75">{subtitle}</p>
        )}
      </div>
    </section>
  );
}
