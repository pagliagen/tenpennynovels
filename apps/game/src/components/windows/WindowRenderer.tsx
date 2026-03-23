/**
 * Window Renderer Component
 *
 * Renders all open windows from WindowManagerStore.
 * Routes window content based on window.type.
 *
 * @module components/windows/WindowRenderer
 * @since 2.0.0
 */

'use client';

import { useWindowManagerStore } from '@/store/windowManagerStore';

import { CharacterSheetContent } from './contents/CharacterSheetContent';
import { MessageOffGameContent } from './contents/MessageOffGameContent';
import { MessageOnGameContent } from './contents/MessageOnGameContent';
import { UtilityContent } from './contents/UtilityContent';
import { Window } from './Window';

/**
 * Window Renderer Component
 *
 * Iterates over all open windows and renders generic Window shell
 * with type-specific content based on window.type.
 *
 * @component
 * @returns {JSX.Element | null} Rendered windows or null if no windows open
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * // In MainLayout or _app.tsx
 * <WindowRenderer />
 * ```
 */
export function WindowRenderer(): JSX.Element | null {
  const { windows } = useWindowManagerStore();

  // Only render non-minimized windows
  const visibleWindows = windows.filter((w) => !w.isMinimized);

  if (visibleWindows.length === 0) {
    return null;
  }

  return (
    <>
      {visibleWindows.map((window) => (
        <Window key={window.id} windowState={window}>
          {/* Route content based on window type */}
          {window.type === 'characterSheet' && window.data.type === 'characterSheet' && (
            <CharacterSheetContent characterId={window.data.characterId} />
          )}

          {window.type === 'messageOnGame' && window.data.type === 'messageOnGame' && (
            <MessageOnGameContent
              conversationId={window.data.conversationId}
              initialView={window.data.initialView}
              prefilledRecipientId={window.data.prefilledRecipientId}
              prefilledRecipientName={window.data.prefilledRecipientName}
            />
          )}

          {window.type === 'messageOffGame' && window.data.type === 'messageOffGame' && (
            <MessageOffGameContent
              conversationId={window.data.conversationId}
              initialView={window.data.initialView}
              prefilledRecipientId={window.data.prefilledRecipientId}
              prefilledRecipientName={window.data.prefilledRecipientName}
            />
          )}

          {window.type === 'utility' && window.data.type === 'utility' && (
            <UtilityContent utilityName={window.data.utilityName} data={window.data} />
          )}
        </Window>
      ))}
    </>
  );
}
