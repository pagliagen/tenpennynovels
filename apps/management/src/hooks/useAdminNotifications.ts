import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { usePermissionsStore } from '@/store/permissionsStore';
import { useAdminNotificationStore } from '@/store/adminNotificationStore';
import { useNotificationStore } from '@/store/notificationStore';
import { encodeFilter } from '@/lib/utils/urlFilters';

interface CharacterPendingEvent {
  characterId: string;
  characterName: string;
  userId: string;
  username: string;
  timestamp: string;
}

export function useAdminNotifications(): void {
  const socket = useSocket();
  const hasPermission = usePermissionsStore((s) => s.hasPermission);
  const addNotification = useAdminNotificationStore((s) => s.addNotification);
  const triggerShake = useAdminNotificationStore((s) => s.triggerShake);
  const toastInfo = useNotificationStore((s) => s.info);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/audio/notification.mp3');
      audioRef.current.volume = 0.5;
    }
  }, []);

  useEffect(() => {
    const canApprove = hasPermission('characters.approve');
    if (!canApprove) return;

    const handlePendingApproval = (data: CharacterPendingEvent) => {
      const filterHash = encodeFilter({ search: data.characterName });
      const link = `/characters/character-pending#filter=${filterHash}`;

      const wasAdded = addNotification({
        type: 'character_pending_approval',
        title: 'Nuovo personaggio in attesa',
        message: `${data.characterName} (${data.username}) ha inviato un personaggio per l'approvazione`,
        characterId: data.characterId,
        characterName: data.characterName,
        timestamp: data.timestamp,
        link
      });

      if (!wasAdded) return;

      toastInfo(
        `${data.characterName} (${data.username}) in attesa di approvazione`,
        'Nuovo personaggio'
      );

      triggerShake();

      if (audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        } catch {
          // Browser blocked autoplay
        }
      }
    };

    socket.on('character_pending_approval', handlePendingApproval);

    return () => {
      socket.off('character_pending_approval', handlePendingApproval);
    };
  }, [socket, hasPermission, addNotification, triggerShake, toastInfo]);
}
