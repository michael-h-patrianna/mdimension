/**
 * Media Query Hook
 * Provides reactive media query matching
 */

import { useState, useEffect } from 'react';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const BREAKPOINTS: Record<Breakpoint, string> = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  '2xl': '(min-width: 1536px)',
};

/**
 * Hook to match a media query
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Hook to check if screen is at or above a breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(BREAKPOINTS[breakpoint]);
}

/**
 * Hook to get the current breakpoint name
 */
export function useCurrentBreakpoint(): Breakpoint | null {
  const is2xl = useMediaQuery(BREAKPOINTS['2xl']);
  const isXl = useMediaQuery(BREAKPOINTS.xl);
  const isLg = useMediaQuery(BREAKPOINTS.lg);
  const isMd = useMediaQuery(BREAKPOINTS.md);
  const isSm = useMediaQuery(BREAKPOINTS.sm);

  if (is2xl) return '2xl';
  if (isXl) return 'xl';
  if (isLg) return 'lg';
  if (isMd) return 'md';
  if (isSm) return 'sm';
  return null;
}

/**
 * Hook to check if the device is mobile (below md breakpoint)
 */
export function useIsMobile(): boolean {
  return !useMediaQuery(BREAKPOINTS.md);
}

/**
 * Hook to check if the device is tablet (md to lg)
 */
export function useIsTablet(): boolean {
  const isMd = useMediaQuery(BREAKPOINTS.md);
  const isLg = useMediaQuery(BREAKPOINTS.lg);
  return isMd && !isLg;
}

/**
 * Hook to check if the device is desktop (lg and above)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(BREAKPOINTS.lg);
}
