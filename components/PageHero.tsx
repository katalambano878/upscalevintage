import { HERO_IMAGE_VERSION, HERO_IMAGES } from '@/lib/brand';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
}

const LEGACY_HERO_IMAGES: Record<string, string> = {
  '/hero-fashion-bg.jpg': HERO_IMAGES[0],
  '/hero-tee-graphic.jpg': HERO_IMAGES[2],
};

function resolveHeroSrc(backgroundImage?: string) {
  if (backgroundImage && LEGACY_HERO_IMAGES[backgroundImage]) {
    return LEGACY_HERO_IMAGES[backgroundImage];
  }
  if (backgroundImage?.startsWith('/hero/')) {
    return backgroundImage;
  }
  return HERO_IMAGES[0];
}

export default function PageHero({ title, subtitle, backgroundImage }: PageHeroProps) {
  const src = resolveHeroSrc(backgroundImage);

  return (
    <div className="relative overflow-hidden flex items-center justify-center min-h-[65vh] md:min-h-[55vh] bg-brand-espresso">
      <img
        src={`${src}?v=${HERO_IMAGE_VERSION}`}
        alt=""
        width={1024}
        height={576}
        decoding="async"
        className="hero-slide-media absolute inset-0 w-full h-full"
      />
      <div className="absolute inset-0 bg-black/35 pointer-events-none" aria-hidden />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24 text-center z-10 flex flex-col items-center">
        <span className="inline-block py-1.5 px-4 mb-5 text-white text-xs sm:text-sm font-sans font-medium tracking-normal [word-spacing:0.08em] border border-white/25 rounded-full bg-white/10 backdrop-blur-md">
          Upscale Vintage
        </span>
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-semibold text-white mb-6 leading-[1.15] tracking-normal [word-spacing:0.08em]">
          {title}
        </h1>
        {subtitle && (
          <p className="font-sans text-lg sm:text-xl text-white/90 leading-relaxed max-w-2xl mx-auto text-center tracking-normal [word-spacing:0.06em]">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
