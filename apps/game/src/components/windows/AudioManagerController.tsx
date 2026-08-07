/**
 * Audio Manager Controller
 *
 * Componente invisibile, montato una volta sola, che possiede l'unico
 * elemento <audio> dell'app e lo tiene sincronizzato con la scheda
 * personaggio in primo piano (vedi audioManagerStore per la logica).
 *
 * @module components/windows/AudioManagerController
 * @since 2.0.0
 */

'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useAudioManagerStore } from '@/store/audioManagerStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import { logger } from '@/lib/logger';

export function AudioManagerController(): null {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }
    const audio = audioRef.current;

    if (!activeUrl || manuallyPaused) {
      audio.pause();
      return;
    }

    if (!unlocked) return; // aspetta il primo gesto utente

    if (audio.src !== activeUrl) {
      audio.src = activeUrl;
    }
    audio.play().catch((err) => {
      logger.debug('[AudioManager] play() bloccato dal browser', { args: [err] });
    });

    return () => {
      audio.pause();
    };
  }, [activeUrl, unlocked, manuallyPaused]);

  // Ferma tutto allo smontaggio dell'app
  useEffect(() => () => audioRef.current?.pause(), []);

  return null;
}
