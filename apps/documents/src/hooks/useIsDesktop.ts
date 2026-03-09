import { useState, useEffect } from 'react';

const DEFAULT_BREAKPOINT_PX = 1024;

/**
 * SSR-safe hook that returns true when viewport width >= breakpointPx.
 * Returns false during SSR; updates on mount and on resize via matchMedia.
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
