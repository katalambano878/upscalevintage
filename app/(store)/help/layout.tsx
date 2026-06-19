import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata('help');

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
