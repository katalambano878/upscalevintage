'use client';

import { useEffect } from 'react';

import { APP_TITLE } from '@/lib/brand';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${APP_TITLE}` : `${APP_TITLE} | Curated Luxury & Lifestyle`;
  }, [title]);
}
