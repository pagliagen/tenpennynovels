/**
 * Window Component
 *
 * Generic draggable window shell for all window types.
 * Handles dragging, minimize, close, z-index management.
 *
 * Content is rendered based on window.type via children prop.
 *
 * @module components/windows/Window
 * @since 2.0.0
 */

'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';
import classNames from 'classnames';

import { useAudioManagerStore } from '@/store/audioManagerStore';
import { useCharacterSheetHeaderStore } from '@/store/characterSheetHeaderStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/windows/Window.module.scss';
import { WindowState } from '@/types/window-manager';

/**
 * Window Props
 *
 * @interface WindowProps
 * @since 2.0.0
 */
interface WindowProps {
  /** Window state from WindowManagerStore */
  windowState: WindowState;

  /** Type-specific content to render */
  children: ReactNode;
}

/**
 * Window Component
 *
 * Generic draggable window shell.
 *
 * @component
 * @param {WindowProps} props - Component props
 * @returns {JSX.Element} Window component
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <Window windowState={windowState}>
 *   <CharacterSheetContent characterId={windowState.data.characterId} />
 * </Window>
 * ```
 */
export function Window({ windowState, children }: WindowProps): JSX.Element {
  const { updatePosition, focusWindow, minimizeWindow, closeWindow } = useWindowManagerStore();

  // Tasto musica: solo per le schede personaggio che hanno un audioTheme registrato
  // (vedi CharacterSheetContent → audioManagerStore). Suona solo la scheda in primo piano.
  const sheetCharacterId = windowState.type === 'characterSheet' && windowState.data.type === 'characterSheet'
    ? windowState.data.characterId
    : null;
  const audioRegistration = useAudioManagerStore((s) => (sheetCharacterId ? s.registrations[sheetCharacterId] : undefined));
  const isActiveAudioWindow = useAudioManagerStore((s) => !!sheetCharacterId && s.activeCharacterId === sheetCharacterId);
  const manuallyPaused = useAudioManagerStore((s) => s.manuallyPaused);
  const togglePause = useAudioManagerStore((s) => s.togglePause);
  const hasTrack = !!audioRegistration?.audioUrl;
  const isPlayingHere = isActiveAudioWindow && !manuallyPaused;

  // Tasto "Modifica Scheda": la scheda si registra da sola (CharacterSheetPGPrincipale)
  // con se il viewer può modificare e il callback che apre il suo modale di edit.
  const headerRegistration = useCharacterSheetHeaderStore((s) => (sheetCharacterId ? s.registrations[sheetCharacterId] : undefined));
  const canEditSheet = !!headerRegistration?.canEdit;

  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Determine if mobile (no dragging on mobile)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * Handle Mouse Down on Header (Start Drag)
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return; // No dragging on mobile

    setIsDragging(true);

    // Calculate offset from mouse to window top-left
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    // Bring to front
    focusWindow(windowState.id);
  };

  /**
   * Handle Dragging (Mouse Move)
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate new position
      let newX = e.clientX - dragOffsetRef.current.x;
      let newY = e.clientY - dragOffsetRef.current.y;

      // Clamp to viewport (prevent dragging offscreen)
      const maxX = window.innerWidth - windowState.size.width;
      const maxY = window.innerHeight - 100; // Keep header visible

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      updatePosition(windowState.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, windowState.id, windowState.size.width, updatePosition]);

  /**
   * Handle Focus Click (Bring to Front)
   */
  const handleFocusClick = () => {
    focusWindow(windowState.id);
  };

  /**
   * Get Window Title Based on Type
   */
  const getWindowTitle = (): string => {
    switch (windowState.type) {
      case 'characterSheet':
        return windowState.data.type === 'characterSheet'
          ? windowState.data.characterName || 'Loading...'
          : 'Character Sheet';
      case 'messageOnGame':
        return windowState.data.type === 'messageOnGame'
          ? windowState.data.conversationTitle || 'Messaggio IN-GAME'
          : 'Messaggio IN-GAME';
      case 'messageOffGame':
        return windowState.data.type === 'messageOffGame'
          ? windowState.data.conversationTitle || 'Messaggio OFF-GAME'
          : 'Messaggio OFF-GAME';
      case 'utility':
        if (windowState.data.type === 'utility') {
          switch (windowState.data.utilityName) {
            case 'character-directory':
              return '📖 Anagrafica Personaggi';
            case 'character-faceclaim':
              return '🎭 Gestione Prestavolto';
            default:
              return windowState.data.utilityName;
          }
        }
        return 'Utility';
      default:
        return 'Window';
    }
  };

  return (
    <div
      className={`${styles.window} ${isMobile ? styles.mobile : ''}`}
      style={{
        left: isMobile ? 0 : windowState.position.x,
        top: isMobile ? 0 : windowState.position.y,
        width: isMobile ? '100vw' : windowState.size.width,
        height: isMobile ? '100vh' : windowState.size.height,
        zIndex: windowState.zIndex,
      }}
      onClick={handleFocusClick}
    >
      {/* Window Header */}
      <div
        className={classNames(
          styles.header,
          isMobile ? styles.headerNoDrag : isDragging ? styles.headerGrabbing : styles.headerGrab
        )}
        onMouseDown={handleMouseDown}
      >
        <span className={styles.title}>{getWindowTitle()}</span>

        <div className={styles.actions}>
          {canEditSheet && (
            <button
              className={styles.minimizeBtn}
              onClick={(e) => {
                e.stopPropagation();
                headerRegistration?.openEdit();
              }}
              aria-label="Modifica scheda"
              title="Modifica scheda"
            >
              <span>✏️</span>
            </button>
          )}

          {hasTrack && (
            <button
              className={styles.minimizeBtn}
              onClick={(e) => {
                e.stopPropagation();
                togglePause();
              }}
              aria-label={isPlayingHere ? 'Pausa musica' : 'Riproduci musica'}
              title={isPlayingHere ? 'Pausa musica' : 'Riproduci musica'}
            >
              <span>{isPlayingHere ? '⏸' : '♪'}</span>
            </button>
          )}

          <button
            className={styles.minimizeBtn}
            onClick={(e) => {
              e.stopPropagation();
              minimizeWindow(windowState.id);
            }}
            aria-label="Minimize"
            title="Minimize"
          >
            <span>−</span>
          </button>

          <button
            className={styles.closeBtn}
            onClick={(e) => {
              e.stopPropagation();
              closeWindow(windowState.id);
            }}
            aria-label="Close"
            title="Close"
          >
            <span>×</span>
          </button>
        </div>
      </div>

      {/* Window Body (Type-Specific Content) */}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
