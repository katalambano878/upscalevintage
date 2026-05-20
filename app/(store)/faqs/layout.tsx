import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata('faqs');

export default function FaqsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
