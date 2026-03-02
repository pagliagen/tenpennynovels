/**
 * Typing Indicator Component
 *
 * Shows "Alice is typing..." or "Alice, Bob are typing..." with animated dots.
 *
 * @module components/offGameChat/TypingIndicator
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

interface TypingIndicatorProps {
  typingUsers: string[]; // Character names
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps): JSX.Element | null {
  if (typingUsers.length === 0) return null;

  const typingText =
    typingUsers.length === 1
      ? `${typingUsers[0]} sta scrivendo`
      : typingUsers.length === 2
      ? `${typingUsers[0]} e ${typingUsers[1]} stanno scrivendo`
      : `${typingUsers[0]} e altri stanno scrivendo`;

  return (
    <div className={styles.typingIndicator}>
      {typingText}
      <span className={styles.dots}>...</span>
    </div>
  );
}
