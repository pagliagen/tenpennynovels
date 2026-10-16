/**
 * Apertura/chiusura della finestra "Presenti" (utility `presenti` del window manager).
 *
 * Lo stato "aperta" è derivato dal window manager, non duplicato in un altro store:
 * una finestra minimizzata non conta come aperta (non è visibile).
 */

import { useCallback } from 'react';

import { useWindowManagerStore } from '@/store/windowManagerStore';

const UTILITY_NAME = 'presenti';

export function usePresenceWindow(): { isOpen: boolean; open: () => void; close: () => void } {
  const windowId = useWindowManagerStore(
    (s) =>
      s.windows.find(
        (w) => w.type === 'utility' && w.data.type === 'utility' && w.data.utilityName === UTILITY_NAME
      )
  );
  const openWindow = useWindowManagerStore((s) => s.openWindow);
  const closeWindow = useWindowManagerStore((s) => s.closeWindow);

  const open = useCallback(() => openWindow('utility', { utilityName: UTILITY_NAME }), [openWindow]);
  const close = useCallback(() => {
    if (windowId) closeWindow(windowId.id);
  }, [windowId, closeWindow]);

  return { isOpen: !!windowId && !windowId.isMinimized, open, close };
}
