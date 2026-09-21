import { APP_TITLE } from '@/lib/brand';

interface BrandMarkProps {
  className?: string;
  /** `dark` is the white monogram for black backgrounds. */
  tone?: 'light' | 'dark';
}

export default function BrandMark({ className = '', tone = 'light' }: BrandMarkProps) {
  const src = tone === 'dark' ? '/brand-mark-on-dark.png' : '/brand-mark.png';

  return (
    <img
      src={src}
      alt={APP_TITLE}
      className={`h-12 w-auto object-contain ${className}`}
    />
  );
}
