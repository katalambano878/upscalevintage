import { APP_TITLE } from '@/lib/brand';

interface BrandMarkProps {
  className?: string;
  compact?: boolean;
}

export default function BrandMark({ className = '' }: BrandMarkProps) {
  return (
    <span className={`block truncate text-[1.35rem] font-semibold tracking-tight ${className || 'text-brand-espresso'}`}>
      {APP_TITLE}
    </span>
  );
}
