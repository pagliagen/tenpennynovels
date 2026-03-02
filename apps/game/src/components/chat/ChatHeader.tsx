/**
 * Chat Header Component
 *
 * Displays location name, back button, and occupant count.
 * Victorian-themed header for chat pages.
 *
 * @module components/chat/ChatHeader
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';
import styles from '@/styles/components/chat/chat.module.scss';

/**
 * Chat Header Props
 */
interface ChatHeaderProps {
  /** Location name to display */
  locationName: string;

  /** Location slug (for back navigation) */
  locationSlug: string;

  /** Number of characters present (optional) */
  occupantCount?: number;
}

/**
 * Chat Header Component
 *
 * Header bar for chat pages with back navigation.
 *
 * @param {ChatHeaderProps} props - Component props
 * @returns {JSX.Element} Chat header
 */
export function ChatHeader({ locationName, locationSlug, occupantCount }: ChatHeaderProps): JSX.Element {
  const router = useRouter();

  const handleBack = () => {
    router.push(`/locations/${locationSlug}`);
  };

  return (
    <header className={styles.chatHeader}>
      <button type="button" className={styles.backButton} onClick={handleBack} aria-label="Back to location">
        ← Torna Alla Location
      </button>

      <h1 className={styles.locationName}>{locationName}</h1>

      {occupantCount !== undefined && occupantCount > 0 && (
        <div className={styles.occupantCount} aria-label={`${occupantCount} presenti`}>
          <span>👥</span>
          <span>{occupantCount}</span>
        </div>
      )}
    </header>
  );
}
