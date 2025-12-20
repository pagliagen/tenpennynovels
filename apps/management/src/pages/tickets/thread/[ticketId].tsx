// =============================================================================
// Ticket Thread View - Management Panel
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/ManagementLayout';
import { useAuth } from '@/lib/auth';
import { useAuditLogger } from '@/hooks/useAuditLogger';
import styles from '@/styles/pages/TicketThread.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface TicketMessage {
  _id: string;
  isStaffMessage: boolean;
  senderCharacterName: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

interface TicketDetails {
  _id: string;
  ticketId: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  characterName: string;
  assignedStaff?: {
    characterName: string;
  };
  department: string;
  messages: TicketMessage[];
}

const STATUS_CONFIG = {
  OPEN: { label: 'Aperto', color: '#4CAF50', icon: '🟢' },
  IN_PROGRESS: { label: 'In Lavorazione', color: '#FF9800', icon: '🔄' },
  WAITING_FOR_USER: { label: 'In Attesa', color: '#2196F3', icon: '⏳' },
  ESCALATED: { label: 'Escalato', color: '#FF5722', icon: '⬆️' },
  CLOSED: { label: 'Chiuso', color: '#9E9E9E', icon: '✅' }
};

const PRIORITY_CONFIG = {
  LOW: { label: 'Bassa', color: '#4CAF50' },
  MEDIUM: { label: 'Media', color: '#FF9800' },
  HIGH: { label: 'Alta', color: '#FF5722' },
  URGENT: { label: 'Urgente', color: '#E91E63' }
};

const CATEGORY_CONFIG = {
  RULE_VIOLATION: { label: '⚖️ Violazione Regole' },
  CHARACTER_ISSUE: { label: '👤 Problemi Personaggio' },
  TECHNICAL_BUG: { label: '🐛 Bug Tecnico' },
  GAMEPLAY_QUESTION: { label: '❓ Domande di Gioco' },
  ACCOUNT_ISSUE: { label: '🔐 Problemi Account' },
  CONTENT_REPORT: { label: '⚠️ Segnalazione Contenuti' },
  GENERAL_SUPPORT: { label: '🆘 Supporto Generale' }
};

const DEPARTMENT_OPTIONS = [
  { value: 'MODERATION', label: 'Moderazione' },
  { value: 'CHARACTER_REVIEW', label: 'Revisione Personaggi' },
  { value: 'TECHNICAL_SUPPORT', label: 'Supporto Tecnico' },
  { value: 'GAMEPLAY_SUPPORT', label: 'Supporto Gameplay' },
  { value: 'GENERAL_SUPPORT', label: 'Supporto Generale' }
];

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', { 
    day: '2-digit', 
    month: '2-digit', 
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function TicketThreadPage() {
  const router = useRouter();
  const { ticketId } = router.query;
  const { authContext } = useAuth();
  const { logAction } = useAuditLogger(authContext);
  
  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Show loading screen while checking authentication
  if (authContext.isLoading) {
    return (
      <ManagementLayout 
        title="Caricamento..." 
        authContext={authContext}
      >
        <div style={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(212, 175, 55, 0.3)',
            borderLeft: '4px solid #d4af37',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#e8e8e8' }}>Verifica autorizzazioni...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </ManagementLayout>
    );
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (ticketId && typeof ticketId === 'string') {
      fetchTicketDetails(ticketId);
    }
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const fetchTicketDetails = async (id: string) => {
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${id}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTicket(data.ticket);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      setError(error instanceof Error ? error.message : 'Errore durante il caricamento del ticket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !ticket) return;
    
    setIsSending(true);
    
    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticket.ticketId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      
      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }
      
      // Log the action
      await logAction('TICKET_MESSAGE_SENT', `Messaggio inviato su ticket ${ticket.ticketId}`);
      
      // Refresh ticket details to show new message
      await fetchTicketDetails(ticket.ticketId);
      setNewMessage('');
      
    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Errore durante l\'invio del messaggio');
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;

    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticket.ticketId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      // Log the action
      const statusLabel = STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label || newStatus;
      await logAction('TICKET_STATUS_CHANGED', `Stato ticket ${ticket.ticketId} cambiato a: ${statusLabel}`);

      // Refresh ticket details
      await fetchTicketDetails(ticket.ticketId);

    } catch (error) {
      console.error('Error updating ticket status:', error);
      setError(error instanceof Error ? error.message : 'Errore durante l\'aggiornamento dello stato');
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!ticket) return;

    try {
      const response = await fetch(`${API_GATEWAY_URL}/admin/tickets/${ticket.ticketId}/priority`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priority: newPriority }),
      });

      if (!response.ok) {
        throw new Error(`Errore ${response.status}: ${response.statusText}`);
      }

      // Log the action
      const priorityLabel = PRIORITY_CONFIG[newPriority as keyof typeof PRIORITY_CONFIG]?.label || newPriority;
      await logAction('TICKET_PRIORITY_CHANGED', `Priorità ticket ${ticket.ticketId} cambiata a: ${priorityLabel}`);

      // Refresh ticket details
      await fetchTicketDetails(ticket.ticketId);

    } catch (error) {
      console.error('Error updating ticket priority:', error);
      setError(error instanceof Error ? error.message : 'Errore durante l\'aggiornamento della priorità');
    }
  };

  if (isLoading) {
    return (
      <ManagementLayout 
        title="Caricamento Ticket..." 
        authContext={authContext}
      >
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <span>Caricamento conversazione ticket...</span>
        </div>
      </ManagementLayout>
    );
  }

  if (error || !ticket) {
    return (
      <ManagementLayout 
        title="Errore Ticket" 
        authContext={authContext}
      >
        <div className={styles.errorContainer}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error || 'Ticket non trovato'}</span>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Torna Indietro
          </button>
        </div>
      </ManagementLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG];
  const categoryConfig = CATEGORY_CONFIG[ticket.category as keyof typeof CATEGORY_CONFIG];
  const departmentConfig = DEPARTMENT_OPTIONS.find(d => d.value === ticket.department);

  const isTicketClosed = ticket.status === 'CLOSED';

  return (
    <ManagementLayout 
      title={`Ticket #${ticket.ticketId}`} 
      authContext={authContext}
    >
      <div className={styles.ticketThreadContainer}>
        
        {/* Ticket Header */}
        <div className={styles.ticketHeader}>
          <button onClick={() => router.back()} className={styles.backButton}>
            ← Torna Indietro
          </button>

          <div className={styles.ticketInfo}>
            <div className={styles.ticketTitle}>
              <span className={styles.ticketId}>#{ticket.ticketId}</span>
              <h1>{ticket.title}</h1>
            </div>

            <div className={styles.ticketMeta}>
              <div className={styles.metaRow}>
                <span><strong>Personaggio:</strong> {ticket.characterName}</span>
                <span><strong>Reparto:</strong> {departmentConfig?.label}</span>
                <span><strong>Assegnato a:</strong> {ticket.assignedStaff?.characterName || 'Non assegnato'}</span>
              </div>
              <div className={styles.metaRow}>
                <span><strong>Categoria:</strong> {categoryConfig?.label}</span>
                <span><strong>Creato:</strong> {formatDateTime(ticket.createdAt)}</span>
                <span><strong>Ultimo aggiornamento:</strong> {formatDateTime(ticket.updatedAt)}</span>
              </div>
            </div>

            <div className={styles.ticketControls}>
              <div className={styles.statusControls}>
                <label>Stato:</label>
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={styles.statusSelect}
                  disabled={isTicketClosed}
                >
                  {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.icon} {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.priorityControls}>
                <label>Priorità:</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className={styles.prioritySelect}
                  disabled={isTicketClosed}
                >
                  {Object.entries(PRIORITY_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.messagesContainer}>
          {/* Initial message */}
          <div className={styles.initialMessage}>
            <div className={styles.messageHeader}>
              <span className={styles.messageAuthor}>👤 {ticket.characterName}</span>
              <span className={styles.messageTime}>
                {formatDateTime(ticket.createdAt)}
              </span>
            </div>
            <div className={styles.messageContent}>
              {ticket.content}
            </div>
            <div className={styles.messageType}>Messaggio iniziale del ticket</div>
          </div>

          {/* Conversation messages */}
          {ticket.messages.map((message) => (
            <div 
              key={message._id} 
              className={`${styles.message} ${message.isStaffMessage ? styles.staffMessage : styles.userMessage}`}
            >
              <div className={styles.messageHeader}>
                <span className={styles.messageAuthor}>
                  {message.isStaffMessage ? '👨‍💼 ' : '👤 '}
                  {message.senderCharacterName}
                </span>
                <span className={styles.messageTime}>
                  {formatDateTime(message.createdAt)}
                </span>
                {!message.isRead && !message.isStaffMessage && (
                  <span className={styles.unreadIndicator}>Non letto</span>
                )}
              </div>
              <div className={styles.messageContent}>
                {message.content}
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Reply form */}
        {!isTicketClosed ? (
          <form onSubmit={handleSendMessage} className={styles.replyForm}>
            <div className={styles.replyInputContainer}>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className={styles.replyInput}
                placeholder="Scrivi la tua risposta come staff..."
                rows={4}
                maxLength={2000}
                disabled={isSending}
              />
              <div className={styles.charCount}>
                {newMessage.length}/2000
              </div>
            </div>
            
            <div className={styles.replyActions}>
              <button
                type="submit"
                className={styles.sendButton}
                disabled={!newMessage.trim() || isSending}
              >
                {isSending ? (
                  <>
                    <span className={styles.spinner}></span>
                    Invio...
                  </>
                ) : (
                  <>
                    👨‍💼 Invia Risposta Staff
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className={styles.closedNotice}>
            <span className={styles.closedIcon}>🔒</span>
            <span className={styles.closedText}>Questo ticket è stato chiuso</span>
            <p className={styles.closedDescription}>
              Il ticket non accetta più messaggi. Se necessario, può essere riaperto modificando lo stato.
            </p>
          </div>
        )}
      </div>
    </ManagementLayout>
  );
}

