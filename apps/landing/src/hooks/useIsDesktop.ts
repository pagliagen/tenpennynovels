/**
 * useIsDesktop Hook
 *
 * Returns whether the viewport is at or above the given breakpoint (desktop).
 * Uses matchMedia for SSR-safe, resize-aware detection.
 *
 * **Use Cases**:
 * - Conditionally render Desktop vs Mobile layout (e.g. VictorianLayout)
 * - Show/hide UI chunks by viewport without CSS-only hiding
 *
 * **SSR**: Returns false during SSR; updates on mount and on resize.
 *
 * @module hooks/useIsDesktop
 */

import { useState, useEffect } from 'react';

/** Default breakpoint: 768px (matches design token $breakpoint-md) */
const DEFAULT_BREAKPOINT_PX = 768;

/**
 * Hook: is viewport desktop (width >= breakpoint)?
 *
 * @param breakpointPx - Min width in pixels for "desktop" (default 768)
 * @returns true if viewport width >= breakpointPx, false otherwise
 *
 * @example
 * ```tsx
 * const isDesktop = useIsDesktop(768);
 * return isDesktop ? <DesktopLayout /> : <MobileLayout />;
 * ```
 */
export function useIsDesktop(breakpointPx: number = DEFAULT_BREAKPOINT_PX): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const query = `(min-width: ${breakpointPx}px)`;
    const media = window.matchMedia(query);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDesktop(e.matches);
    };

    setIsDesktop(media.matches);
    media.addEventListener('change', handleChange);

    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [breakpointPx]);

  return isDesktop;
}
