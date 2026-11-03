import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export type Layout = 'mobile' | 'tablet' | 'desktop';

/** desktop: three columns; tablet: drawer + floating panel; mobile: drawer + bottom sheet. */
export function useLayout(): Layout {
  const desktop = useMediaQuery('(min-width: 1100px)');
  const tablet = useMediaQuery('(min-width: 720px)');
  return desktop ? 'desktop' : tablet ? 'tablet' : 'mobile';
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
