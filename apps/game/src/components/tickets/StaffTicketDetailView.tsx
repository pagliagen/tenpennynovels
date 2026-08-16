/**
 * Staff Ticket Detail View Component
 *
 * Staff view for ticket with quick actions
 *
 * @module components/tickets/StaffTicketDetailView
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useRef } from 'react';

import { api } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/tickets/StaffTicketDetailView.module.scss';

import { TicketStatusBadge } from './TicketStatusBadge';
import { logger } from '@/lib/logger';


interface StaffTicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

export function StaffTicketDetailView({ ticketId, onBack }: StaffTicketDetailViewProps) {
  const [replyContent, setReplyContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?._id);

  // Dettagli + messaggi in un'unica chiamata: GET /admin/tickets/:id/messages
  // non esiste, e /game/tickets/:id/messages (uso precedente, useTicketMessages)
  // e' l'endpoint del giocatore con controllo ownership (createdBy===personaggio
  // loggato) - fallisce sempre per un ticket non proprio, cioe' quasi sempre
  // per lo staff. GET /admin/tickets/:id (getTicketDetails) restituisce gia'
  // { ticket, messages } senza quel vincolo.
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'staff', ticketId],
    queryFn: async () => {
      const response = await api.get<{ ticket: any; messages: any[] }>(`/admin/tickets/${ticketId}`);
      return response;
    }
  });
  const ticket = data?.ticket;
  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      return await api.post<{ message: any }>(`/admin/tickets/${ticketId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'staff', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', 'staff'] });
      setReplyContent('');
    }
  });

  // Take ticket mutation
  // PUT /admin/tickets/:id/assign richiede assignedTo+assignedToName (nessuno
  // shorthand assignToMe): l'endpoint corretto per l'auto-assegnazione e'
  // POST /admin/tickets/:id/take (TicketDashboardController.takeTicket),
  // senza body - assegna a req.user.userId.
  const takeMutation = useMutation({
    mutationFn: async () => {
      return await api.post<{ ticket: any }>(`/admin/tickets/${ticketId}/take`, {});
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
      logger.error('Failed to send message:', { error });
    }
  };

  const handleTakeTicket = async () => {
    try {
      await takeMutation.mutateAsync();
    } catch (error) {
      logger.error('Failed to take ticket:', { error });
    }
  };

  const handleGoToCharacterPending = () => {
    // /characters/character-pending vive in apps/management, non in
    // apps/game: router.push (SPA, stesso dominio) qui darebbe sempre 404.
    const managementUrl = process.env.NEXT_PUBLIC_MANAGEMENT_URL || '';
    window.open(`${managementUrl}/characters/character-pending`, '_blank', 'noopener,noreferrer');
  };

  const canReply = ticket && ticket.status !== 'closed';
  // GET /admin/tickets/:id (getTicketDetails) restituisce assignedTo:{id,name},
  // nessun campo isMe: va calcolato qui confrontando con lo user loggato.
  const isAssignedToMe = !!ticket?.assignedTo && ticket.assignedTo.id === currentUserId;
  const isUnassigned = !ticket?.assignedTo;
  const isCharacterApproval = ticket?.category === 'character_approval';

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" onClick={onBack} className={styles.backButton}>
          ← Torna alla lista
        </button>

        {ticket && (
          <div>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>{ticket.title}</h2>
              <div className={styles.headerActions}>
                {isUnassigned && (
                  <button
                    type="button"
                    onClick={handleTakeTicket}
                    disabled={takeMutation.isPending}
                    className={styles.takeButton}
                  >
                    {takeMutation.isPending ? 'Assegnazione...' : '✋ Prendi in Carico'}
                  </button>
                )}
                {isCharacterApproval && (
                  <button
                    type="button"
                    onClick={handleGoToCharacterPending}
                    className={styles.characterButton}
                  >
                    📋 Vai a Character Pending
                  </button>
                )}
              </div>
            </div>

            <div className={styles.metaRow}>
              <TicketStatusBadge status={ticket.status} />
              <span className={styles.categoryPill}>
                {ticket.categoryLabel}
              </span>
            </div>

            <div className={styles.metaLine}>
              Da: {ticket.createdBy?.name || 'N/A'}
              {' • '}
              Creato il {new Date(ticket.createdAt).toLocaleString('it-IT')}
              {ticket.assignedTo && (
                <span className={styles.metaAssigned}>
                  • Assegnato a: {ticket.assignedTo.name}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages Thread */}
      <div className={styles.thread}>
        {isLoading && (
          <div className={styles.centerMuted}>
            Caricamento messaggi...
          </div>
        )}

        {!isLoading && messages.length === 0 && (
          <div className={styles.centerMuted}>
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
        <div className={styles.replySection}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Scrivi la tua risposta (staff)..."
            disabled={replyMutation.isPending}
            className={styles.replyTextarea}
          />
          <div className={styles.replyActions}>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!replyContent.trim() || replyMutation.isPending}
              className={styles.sendButton}
            >
              {replyMutation.isPending ? 'Invio...' : 'Invia Risposta'}
            </button>
          </div>
        </div>
      )}

      {!isAssignedToMe && !isUnassigned && (
        <div className={styles.assignedBanner}>
          <p className={styles.assignedText}>
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
      className={`${styles.messageRow} ${isStaff ? styles.messageRowEnd : styles.messageRowStart}`}
    >
      <div
        className={`${styles.messageBubble} ${
          isStaff ? styles.messageBubbleStaff : styles.messageBubbleGuest
        }`}
      >
        <div className={styles.senderLine}>
          {message.sender.name} {isStaff && '(Staff)'}
        </div>
        <div className={styles.bodyLine}>
          {message.content}
        </div>
        <div className={styles.timeLine}>
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
