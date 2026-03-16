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
import { TicketStatusBadge } from './TicketStatusBadge';

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

  const ticket = tickets.find(t => t.id === ticketId);

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
      console.error('Failed to send message:', error);
    }
  };

  const handleCloseTicket = async () => {
    if (!confirm('Sei sicuro di voler chiudere questo ticket?')) return;

    try {
      await closeTicket.mutateAsync({ ticketId });
      onBack();
    } catch (error) {
      console.error('Failed to close ticket:', error);
    }
  };

  const canReply = ticket && ticket.status !== 'closed';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: 'white' }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#3b82f6',
            fontSize: '0.875rem',
            cursor: 'pointer',
            marginBottom: '0.5rem'
          }}
        >
          ← Torna alla lista
        </button>

        {ticket && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>{ticket.title}</h2>
              {ticket.status !== 'closed' && (
                <button
                  onClick={handleCloseTicket}
                  disabled={closeTicket.isPending}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: closeTicket.isPending ? 'not-allowed' : 'pointer',
                    opacity: closeTicket.isPending ? 0.5 : 1
                  }}
                >
                  {closeTicket.isPending ? 'Chiusura...' : 'Chiudi Ticket'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <TicketStatusBadge status={ticket.status} />
              <span style={{
                padding: '0.25rem 0.75rem',
                backgroundColor: '#f3f4f6',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                color: '#6b7280'
              }}>
                {ticket.categoryLabel}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Thread */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', backgroundColor: '#f9fafb' }}>
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Caricamento messaggi...
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Nessun messaggio
          </div>
        )}

        {!isLoading && messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Reply Form */}
      {canReply && (
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', backgroundColor: 'white' }}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Scrivi la tua risposta..."
            disabled={addMessage.isPending}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              marginBottom: '0.75rem'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSendMessage}
              disabled={!replyContent.trim() || addMessage.isPending}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: addMessage.isPending || !replyContent.trim() ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: addMessage.isPending || !replyContent.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {addMessage.isPending ? 'Invio...' : 'Invia Risposta'}
            </button>
          </div>
        </div>
      )}

      {!canReply && ticket?.status === 'closed' && (
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fef3c7', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#92400e', fontSize: '0.875rem' }}>
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
    <div
      style={{
        display: 'flex',
        justifyContent: isStaff ? 'flex-start' : 'flex-end',
        marginBottom: '1rem'
      }}
    >
      <div
        style={{
          maxWidth: '70%',
          padding: '0.75rem 1rem',
          backgroundColor: isStaff ? 'white' : '#3b82f6',
          color: isStaff ? '#1f2937' : 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem', opacity: 0.8 }}>
          {message.sender.name} {isStaff && '(Staff)'}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.875rem' }}>
          {message.content}
        </div>
        <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.7 }}>
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
