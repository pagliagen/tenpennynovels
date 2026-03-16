/**
 * Staff Ticket Detail View Component
 *
 * Staff view for ticket with quick actions
 *
 * @module components/tickets/StaffTicketDetailView
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useTicketMessages } from '@/hooks/useTickets';
import { TicketStatusBadge } from './TicketStatusBadge';
import { useRouter } from 'next/router';

interface StaffTicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

export function StaffTicketDetailView({ ticketId, onBack }: StaffTicketDetailViewProps) {
  const [replyContent, setReplyContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: messages = [], isLoading } = useTicketMessages(ticketId);

  // Fetch ticket details
  const { data: ticket } = useQuery({
    queryKey: ['tickets', 'staff', ticketId],
    queryFn: async () => {
      const response = await api.get<{ ticket: any }>(`/admin/tickets/${ticketId}`);
      return response.ticket;
    }
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      return await api.post<{ message: any }>(`/admin/tickets/${ticketId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', ticketId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'staff'] });
      setReplyContent('');
    }
  });

  // Take ticket mutation
  const takeMutation = useMutation({
    mutationFn: async () => {
      return await api.put<{ ticket: any }>(`/admin/tickets/${ticketId}/assign`, { assignToMe: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'staff', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'staff'] });
    }
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!replyContent.trim() || replyMutation.isPending) return;

    try {
      await replyMutation.mutateAsync(replyContent.trim());
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleTakeTicket = async () => {
    try {
      await takeMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to take ticket:', error);
    }
  };

  const handleGoToCharacterPending = () => {
    router.push('/characters/character-pending');
  };

  const canReply = ticket && ticket.status !== 'closed';
  const isAssignedToMe = ticket?.assignedTo?.isMe;
  const isUnassigned = !ticket?.assignedTo;
  const isCharacterApproval = ticket?.category === 'character_approval';

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
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isUnassigned && (
                  <button
                    onClick={handleTakeTicket}
                    disabled={takeMutation.isPending}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: takeMutation.isPending ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: takeMutation.isPending ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {takeMutation.isPending ? 'Assegnazione...' : '✋ Prendi in Carico'}
                  </button>
                )}
                {isCharacterApproval && (
                  <button
                    onClick={handleGoToCharacterPending}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Vai a Character Pending
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
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

            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Da: {ticket.createdBy?.characterName || 'N/A'}
              {' • '}
              Creato il {new Date(ticket.createdAt).toLocaleString('it-IT')}
              {ticket.assignedTo && (
                <span style={{ marginLeft: '0.5rem' }}>
                  • Assegnato a: {ticket.assignedTo.name}
                </span>
              )}
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
      {canReply && isAssignedToMe && (
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', backgroundColor: 'white' }}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Scrivi la tua risposta (staff)..."
            disabled={replyMutation.isPending}
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
              disabled={!replyContent.trim() || replyMutation.isPending}
              style={{
                padding: '0.5rem 1.5rem',
                backgroundColor: replyMutation.isPending || !replyContent.trim() ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: replyMutation.isPending || !replyContent.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {replyMutation.isPending ? 'Invio...' : 'Invia Risposta'}
            </button>
          </div>
        </div>
      )}

      {!isAssignedToMe && !isUnassigned && (
        <div style={{ padding: '1rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fef3c7', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#92400e', fontSize: '0.875rem' }}>
            Questo ticket è assegnato a {ticket?.assignedTo?.name}. Usa il pannello Gestionale per riassegnare o rispondere.
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
        justifyContent: isStaff ? 'flex-end' : 'flex-start',
        marginBottom: '1rem'
      }}
    >
      <div
        style={{
          maxWidth: '70%',
          padding: '0.75rem 1rem',
          backgroundColor: isStaff ? '#3b82f6' : 'white',
          color: isStaff ? 'white' : '#1f2937',
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
