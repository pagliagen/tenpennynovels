/**
 * MessageEditableContent
 *
 * Inline textarea for editing message content.
 * Auto-focuses and selects text on mount.
 */

import { useEffect, useRef } from 'react';
import styles from '@/styles/components/chat/MessageEditableContent.module.scss';

interface MessageEditableContentProps {
  content: string;
  onChange: (value: string) => void;
}

export function MessageEditableContent({ content, onChange }: MessageEditableContentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus and select all text
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  return (
    <div className={styles.messageContentEditing}>
      <textarea
        ref={textareaRef}
        className={styles.messageEditTextarea}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        maxLength={2000}
        rows={4}
        aria-label="Modifica contenuto messaggio"
      />
      <div className={styles.characterCounter}>
        {content.length} / 2000
      </div>
    </div>
  );
}
