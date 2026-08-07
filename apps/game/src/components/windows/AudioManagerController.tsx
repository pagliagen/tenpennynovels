/**
 * Audio Manager Controller
 *
 * Componente invisibile, montato una volta sola, che possiede l'unico player
 * YouTube dell'app e lo tiene sincronizzato con la scheda personaggio in
 * primo piano (vedi audioManagerStore per la logica di selezione).
 *
 * Lo staff inserisce in audioTheme un link YouTube (non un file audio
 * diretto): serve quindi la IFrame Player API di YouTube, non un tag
 * <audio> nativo che non può riprodurre una pagina/video YouTube.
 *
 * @module components/windows/AudioManagerController
 * @since 2.0.0
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';

import { extractYouTubeVideoId, loadYouTubeIframeApi } from '@/lib/youtube';
import { useAudioManagerStore } from '@/store/audioManagerStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import { logger } from '@/lib/logger';

export function AudioManagerController(): JSX.Element {
  // Wrapper "stabile" gestito da React: non viene mai toccato dopo il mount.
  // L'API YouTube sostituisce l'elemento che le passiamo con un <iframe> proprio,
  // manipolando il DOM fuori dal controllo di React — se le passassimo direttamente
  // questo nodo React perderebbe traccia del DOM reale e al primo re-render
  // lancerebbe "Failed to execute 'insertBefore'/'removeChild' on 'Node'".
  // Soluzione: dentro il wrapper creiamo a mano (non via JSX) un div "usa e getta"
  // che l'API può sostituire liberamente, mai referenziato dal fiber di React.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);

  const windows = useWindowManagerStore((s) => s.windows);
  const { registrations, unlocked, manuallyPaused, setActiveCharacterId, unlock } = useAudioManagerStore();

  // Sblocca al primo gesto utente qualsiasi, ovunque nella pagina (policy autoplay browser)
  useEffect(() => {
    if (unlocked) return;
    const handler = () => unlock();
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [unlocked, unlock]);

  // Crea il player YouTube una sola volta (nascosto: serve solo l'audio)
  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeApi().then(() => {
      if (cancelled || !wrapperRef.current || playerRef.current) return;

      // Nodo creato a mano, mai visto da React: sicuro da lasciare sostituire
      // all'API YouTube senza che il fiber di React se ne accorga o interferisca.
      const mountNode = document.createElement('div');
      wrapperRef.current.appendChild(mountNode);

      const YT = (window as any).YT;
      playerRef.current = new YT.Player(mountNode, {
        height: '0',
        width: '0',
        playerVars: { autoplay: 0, controls: 0 },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
          },
          onError: (e: any) => {
            logger.debug('[AudioManager] errore player YouTube', { args: [e] });
          }
        }
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      playerReadyRef.current = false;
      // Il player.destroy() rimuove già il proprio iframe; svuotiamo comunque il
      // wrapper per sicurezza, senza toccare wrapperRef.current stesso (quello resta a React).
      if (wrapperRef.current) wrapperRef.current.innerHTML = '';
    };
  }, []);

  // Finestra scheda personaggio in primo piano tra quelle aperte (non minimizzate)
  const activeCharacterId = useMemo(() => {
    const sheetWindows = windows
      .filter((w) => w.type === 'characterSheet' && !w.isMinimized && w.data.type === 'characterSheet')
      .sort((a, b) => b.zIndex - a.zIndex);
    return sheetWindows[0]?.data.type === 'characterSheet' ? sheetWindows[0].data.characterId : null;
  }, [windows]);

  useEffect(() => {
    setActiveCharacterId(activeCharacterId);
  }, [activeCharacterId, setActiveCharacterId]);

  const activeUrl = activeCharacterId ? registrations[activeCharacterId]?.audioUrl : undefined;
  const activeVideoId = extractYouTubeVideoId(activeUrl);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) return;

    if (!activeVideoId || manuallyPaused || !unlocked) {
      player.pauseVideo?.();
      return;
    }

    if (currentVideoIdRef.current !== activeVideoId) {
      currentVideoIdRef.current = activeVideoId;
      player.loadVideoById(activeVideoId);
    } else {
      player.playVideo?.();
    }
  }, [activeVideoId, unlocked, manuallyPaused]);

  // Nascosto: serve solo per l'audio, non per la UI (niente display:none: alcuni
  // browser sospendono/limitano gli iframe nascosti così, meglio 0x0 fuori schermo)
  return <div ref={wrapperRef} style={{ position: 'fixed', width: 0, height: 0, overflow: 'hidden', left: -9999 }} />;
}
