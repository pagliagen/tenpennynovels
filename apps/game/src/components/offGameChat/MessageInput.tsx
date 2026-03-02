/**
 * Message Input Component
 *
 * Textarea with Enter to send, debounced typing indicator.
 * Character limit: 2000 chars.
 *
 * @module components/offGameChat/MessageInput
 * @since 2.0.0
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useSendTypingIndicator } from '@/hooks/useOffGameChat';
import styles from '@/styles/components/offGameChat/OffGameChat.module.scss';

interface MessageInputProps {
  chatId: string;
  onSend: (content: string) => void;
  disabled: boolean;
}

const MAX_LENGTH = 2000;
const TYPING_TIMEOUT = 3000; // Stop typing after 3s of inactivity

export function MessageInput({ chatId, onSend, disabled }: MessageInputProps): JSX.Element {
  const [content, setContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendTypingIndicator = useSendTypingIndicator();

  // Send typing indicator
  useEffect(() => {
    if (isTyping) {
      sendTypingIndicator.mutate({ chatId, isTyping: true });
    }

    return () => {
      if (isTyping) {
        sendTypingIndicator.mutate({ chatId, isTyping: false });
      }
    };
  }, [isTyping, chatId]);

  // Handle content change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Trigger typing indicator
    if (newContent && !isTyping) {
      setIsTyping(true);
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, TYPING_TIMEOUT);
  };

  // Handle send
  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setContent('');
    setIsTyping(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.messageInput}>
      <textarea
        className={styles.textInput}
        placeholder="Scrivi un messaggio..."
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        maxLength={MAX_LENGTH}
        rows={1}
      />
      <button
        className={styles.sendButton}
        onClick={handleSend}
        disabled={!content.trim() || disabled}
        title="Invia"
      >
        🚀
      </button>
    </div>
  );
}
