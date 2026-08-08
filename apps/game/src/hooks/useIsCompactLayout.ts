'use client';

import { useEffect, useState } from 'react';

/**
 * Sotto questa soglia la sidebar collassa a drawer (GameLayout) e la Bacheca
 * prende tutta la larghezza invece del 50vw laterale (ForumModal.module.scss
 * ha lo stesso valore nella sua media query - tienili allineati).
 */
export const COMPACT_LAYOUT_BREAKPOINT = 1500;

/**
 * True sotto COMPACT_LAYOUT_BREAKPOINT. Unica fonte di verità condivisa tra
 * i componenti che devono sapere se sono in layout compatto (GameLayout,
 * ForumModal, ...) - evita resize listener duplicati con soglie che possono
 * disallinearsi nel tempo.
 */
export function useIsCompactLayout(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const checkLayout = () => setIsCompact(window.innerWidth < COMPACT_LAYOUT_BREAKPOINT);
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  return isCompact;
}

/**
 * Sotto questa soglia la struttura desktop (topbar a icone fisse, sidebar a
 * drawer, Bacheca overlay) lascia il posto allo shell mobile a 3 pannelli
 * (Presenti | Game | Bacheca via MobileTabBar) - vedi GameLayout.tsx. Soglia
 * indipendente da COMPACT_LAYOUT_BREAKPOINT: 1024-1499px continua a
 * funzionare come oggi (drawer sidebar, Bacheca full-width), sotto i 1024
 * cambia la struttura stessa, non solo le dimensioni.
 */
export const MOBILE_SHELL_BREAKPOINT = 1024;

export function useIsMobileShell(): boolean {
  const [isMobileShell, setIsMobileShell] = useState(false);

  useEffect(() => {
    const checkLayout = () => setIsMobileShell(window.innerWidth < MOBILE_SHELL_BREAKPOINT);
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  return isMobileShell;
}
