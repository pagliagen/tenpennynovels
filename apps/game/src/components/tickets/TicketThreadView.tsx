/**
 * Ticket Thread View Component
 *
 * Displays ticket messages thread and reply form
 *
 * @module components/tickets/TicketThreadView
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useTicketMessages, useAddTicketMessage, useCloseTicket, useUserTickets } from '@/hooks/useTickets';
import styles from '@/styles/components/tickets/TicketThreadView.module.scss';

import { TicketStatusBadge } from './TicketStatusBadge';
import { logger } from '@/lib/logger';

interface TicketThreadViewProps {
  ticketId: string;
  onBack: () => void;
}

export function TicketThreadView({ ticketId, onBack }: TicketThreadViewProps) {
  const [replyContent, setReplyContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useTicketMessages(ticketId);
  const { data: tickets = [] } = useUserTickets();
  const addMessage = useAddTicketMessage();
  const closeTicket = useCloseTicket();

  const ticket = tickets.find(t => t._id === ticketId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!replyContent.trim() || addMessage.isPending) return;

    try {
      await addMessage.mutateAsync({
        ticketId,
        content: replyContent.trim()
      });
      setReplyContent('');
    } catch (error) {
      logger.error('Failed to send message:', { error });
    }
  };

  const handleCloseTicket = async () => {
    if (!confirm('Sei sicuro di voler chiudere questo ticket?')) return;

    try {
      await closeTicket.mutateAsync({ ticketId });
      onBack();
    } catch (error) {
      logger.error('Failed to close ticket:', { error });
    }
  };

  const canReply = ticket && ticket.status !== 'closed';
  const canSend = !!replyContent.trim() && !addMessage.isPending;

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.backBtn}>
          ← Torna alla lista
        </button>

        {ticket && (
          <div>
            <div className={styles.headerRow}>
              <h2 className={styles.headerTitle}>{ticket.title}</h2>
              {ticket.status !== 'closed' && (
                <button
                  type="button"
                  onClick={handleCloseTicket}
                  disabled={closeTicket.isPending}
                  className={styles.closeBtn}
                >
                  {closeTicket.isPending ? 'Chiusura...' : 'Chiudi Ticket'}
                </button>
              )}
            </div>

            <div className={styles.badgeRow}>
              <TicketStatusBadge status={ticket.status} />
              <span className={styles.categoryChip}>
                {ticket.categoryLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Thread */}
      <div className={styles.thread}>
        {isLoading && (
          <div className={styles.stateMessage}>
            Caricamento messaggi...
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className={styles.stateMessage}>
            Nessun messaggio
          </div>
        )}

        {!isLoading && messages.map((message) => (
          <MessageBubble key={message._id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Form */}
      {canReply && (
        <div className={styles.replyBar}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Scrivi la tua risposta..."
            disabled={addMessage.isPending}
            className={styles.replyTextarea}
          />
          <div className={styles.replyActions}>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!canSend}
              className={styles.sendBtn}
            >
              {addMessage.isPending ? 'Invio...' : 'Invia Risposta'}
            </button>
          </div>
        </div>
      )}

      {!canReply && ticket?.status === 'closed' && (
        <div className={styles.closedBanner}>
          <p className={styles.closedText}>
            Questo ticket è stato chiuso. Non è possibile inviare nuovi messaggi.
          </p>
        </div>
      )}
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: any;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isStaff = message.sender.type === 'staff';

  return (
    <div className={isStaff ? styles.bubbleRowStaff : styles.bubbleRowUser}>
      <div className={isStaff ? styles.bubbleStaff : styles.bubbleUser}>
        <div className={styles.bubbleSender}>
          {message.sender.name} {isStaff && '(Staff)'}
        </div>
        <div className={styles.bubbleContent}>
          {message.content}
        </div>
        <div className={styles.bubbleTime}>
          {new Date(message.sentAt).toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}
