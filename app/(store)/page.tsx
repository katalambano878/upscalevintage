import { buildPageMetadata } from '@/lib/seo';
import HomeClient from './HomeClient';

export const metadata = buildPageMetadata('home');

export default function HomePage() {
  return <HomeClient />;
}
