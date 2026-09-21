import Image from 'next/image';
import { BRAND_NAME, LOGO_PATH, LOGO_CLASS_HEADER } from '@/lib/brand';

type LogoProps = {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export default function Logo({
  className = LOGO_CLASS_HEADER,
  width = 200,
  height = 80,
  priority = false,
}: LogoProps) {
  return (
    <Image
      src={LOGO_PATH}
      alt={BRAND_NAME}
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
      style={{ width: 'auto', height: 'auto', maxHeight: '100%' }}
    />
  );
}
