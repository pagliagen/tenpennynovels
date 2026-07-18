import { logger } from '@/lib/logger';
/**
 * Audio notification utilities
 * Plays notification sounds for in-game events
 */

/**
 * Play notification sound
 * Uses audio files in /public/audio/
 */
export function playNotificationSound(volume: number = 0.5): void {
  try {
    // Random between 001 and 002
    const soundFile = Math.random() > 0.5
      ? '/audio/new-notification-001.mp3'
      : '/audio/new-notification-002.mp3';

    const audio = new Audio(soundFile);
    audio.volume = volume;
    audio.play().catch(err => {
      logger.warn('Failed to play notification sound:', { err });
    });
  } catch (error) {
    logger.error('Audio playback error:', { error });
  }
}
