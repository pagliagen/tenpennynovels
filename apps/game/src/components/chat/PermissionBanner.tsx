/**
 * Permission Banner Component
 *
 * Displays status-specific message when character cannot write in chat.
 * Replaces MessageInput when character status is not APPROVED.
 *
 * @module components/chat/PermissionBanner
 * @since 2.0.0
 */

'use client';

import type { CharacterStatus } from '@/types/character';
import styles from '@/styles/components/chat/chat.module.scss';

/**
 * Permission Banner Props
 */
interface PermissionBannerProps {
  /** Character status (DRAFT, PENDING_APPROVAL, DELETED) */
  status: CharacterStatus;
}

/**
 * Permission Banner Component
 *
 * Shows why user cannot write in chat with status-specific message.
 *
 * @param {PermissionBannerProps} props - Component props
 * @returns {JSX.Element} Permission banner
 */
export function PermissionBanner({ status }: PermissionBannerProps): JSX.Element {
  // Status-specific messages
  const messages: Record<CharacterStatus, { icon: string; text: string }> = {
    DRAFT: {
      icon: '⚠️',
      text: 'Il tuo personaggio è ancora in fase di creazione. Completa la scheda per interagire nella chat.',
    },
    PENDING_APPROVAL: {
      icon: '⏳',
      text: "Il tuo personaggio è in attesa di approvazione da parte dello staff. Non puoi ancora interagire nella chat.",
    },
    APPROVED: {
      icon: '✅',
      text: '', // Should never show
    },
    DELETED: {
      icon: '❌',
      text: 'Questo personaggio non è più attivo e non può interagire nella chat.',
    },
  };

  const message = messages[status] || {
    icon: '⚠️',
    text: `Il personaggio ha uno stato non riconosciuto (${status}). Contatta l'amministrazione.`,
  };

  return (
    <div className={styles.permissionBanner}>
      <span className={styles.permissionIcon}>{message.icon}</span>
      <span className={styles.permissionText}>{message.text}</span>
    </div>
  );
}
