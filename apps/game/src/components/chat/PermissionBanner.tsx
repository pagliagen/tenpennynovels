/**
 * Permission Banner Component
 *
 * Displays message when character cannot write in chat due to missing permissions.
 * Replaces MessageInput when character lacks game:chat:send permission.
 *
 * @module components/chat/PermissionBanner
 * @since 2.0.0
 */

'use client';

import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/chat/chat.module.scss';

/**
 * Permission Banner Component
 *
 * Shows why user cannot write in chat based on character playerStatus.
 * Uses game permissions system to determine access.
 *
 * @returns {JSX.Element} Permission banner
 */
export function PermissionBanner(): JSX.Element {
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const playerStatus = selectedCharacter?.playerStatus;

  // Determine message based on playerStatus
  let icon = '⚠️';
  let text = 'Non hai i permessi necessari per interagire nella chat.';

  if (playerStatus === 'draft') {
    icon = '⚠️';
    text = 'Il tuo personaggio è ancora in fase di creazione. Completa la scheda per interagire nella chat.';
  } else if (playerStatus === 'pending') {
    icon = '⏳';
    text = 'Il tuo personaggio è in attesa di approvazione da parte dello staff. Non puoi ancora interagire nella chat.';
  }

  return (
    <div className={styles.permissionBanner}>
      <span className={styles.permissionIcon}>{icon}</span>
      <span className={styles.permissionText}>{text}</span>
    </div>
  );
}
