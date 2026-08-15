import { logger } from '@/lib/logger';
import { useUIStore } from '@/store/uiStore';
/**
 * Audio notification utilities
 * Plays notification sounds for in-game events
 */

/**
 * Play notification sound
 *
 * Uses whichever file the user picked in Opzioni Chat (uiStore.chatNotificationSound,
 * one of the two files in /public/audio/, or 'none' to stay silent).
 */
export function playNotificationSound(volume: number = 0.5): void {
  const sound = useUIStore.getState().chatNotificationSound;
  if (sound === 'none') {
    return;
  }

  try {
    const audio = new Audio(`/audio/${sound}.mp3`);
    audio.volume = volume;
    audio.play().catch(err => {
      logger.warn('Failed to play notification sound:', { err });
    });
  } catch (error) {
    logger.error('Audio playback error:', { error });
  }
}
