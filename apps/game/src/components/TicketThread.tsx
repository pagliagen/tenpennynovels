import React, { useState, useRef, useEffect } from 'react';
import styles from '@/styles/components/TicketThread.module.scss';
import type { TicketStatus, TicketPriority } from './TicketList';

// Tipi per il thread del ticket
export interface TicketMessage {
  id: string;
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: string;
    name: string;
  };
  sentAt: Date | string;
  isInternal: boolean;
  readAt?: {
    character?: Date;
    staff?: Date;
  };
}

export interface TicketDetails {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date | string;
  createdBy: string;
  assignedToName?: string;
  department: string;
  messages: TicketMessage[];
  isEscalated: boolean;
  escalationLevel?: number;
}

// Mapping status → etichette italiane (stesso del TicketList)
const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Aperto',
  assigned: 'Assegnato',
  in_progress: 'In Lavorazione',
  waiting_user: 'In Attesa',
  closed: 'Chiuso',
  reopened: 'Riaperto'
};

// Mapping priorità → etichette italiane 
const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  critical: 'Critica'
};

// Icone per status
const STATUS_ICONS: Record<TicketStatus, string> = {
  open: '🆕',
  assigned: '👤',
  in_progress: '⚙️',
  waiting_user: '⏳',
  closed: '✅',
  reopened: '🔄'
};

// Icone per priorità
const PRIORITY_ICONS: Record<TicketPriority, string> = {
  low: '🔵',
  medium: '🟡',
  high: '🟠',
  critical: '🔴'
};

interface TicketThreadProps {
  ticket: TicketDetails;
  onSendMessage: (content: string) => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
  isSending: boolean;
  error: string;
}

const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatMessageTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return 'ora';
  if (diffMinutes < 60) return `${diffMinutes} min fa`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h fa`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ieri';
  if (diffDays < 7) return `${diffDays} giorni fa`;
  
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const TicketThread: React.FC<TicketThreadProps> = ({
  ticket,
  onSendMessage,
  onBack,
  isLoading,
  isSending,
  error
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket.messages]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    if (messageError) {
      setMessageError('');
    }
    
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    
    if (!content) {
      setMessageError('Il messaggio non può essere vuoto');
      return;
    }
    
    if (content.length < 10) {
      setMessageError('Il messaggio deve essere di almeno 10 caratteri');
      return;
    }
    
    if (content.length > 2000) {
      setMessageError('Il messaggio non può superare i 2000 caratteri');
      return;
    }

    try {
      await onSendMessage(content);
      setNewMessage('');
      setMessageError('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      // Error handling is managed by parent component
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className={styles.ticketThread}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.loadingText}>Caricamento ticket...</div>
        </div>
      </div>
    );
  }

  const statusClass = styles[`status-${ticket.status.replace('_', '-')}`] || styles.statusDefault;
  const priorityClass = styles[`priority-${ticket.priority}`] || styles.priorityDefault;

  return (
    <div className={styles.ticketThread}>
      {/* Header */}
      <div className={styles.threadHeader}>
        <div className={styles.headerTop}>
          <button 
            onClick={onBack}
            className={styles.backButton}
            aria-label="Torna alla lista"
          >
            ← Lista
          </button>
          <div className={styles.ticketId}>
            #{ticket.id.slice(-8)}
          </div>
        </div>
        
        <div className={styles.headerContent}>
          <div className={styles.ticketTitleSection}>
            <h3 className={styles.ticketTitle}>
              {ticket.isEscalated && (
                <span className={styles.escalatedBadge} title="Ticket escalato">
                  🚨
                </span>
              )}
              {ticket.title}
            </h3>
            <div className={styles.ticketMeta}>
              <span className={styles.createdInfo}>
                Creato il {formatDateTime(ticket.createdAt)} da {ticket.createdBy}
              </span>
            </div>
          </div>
          
          <div className={styles.ticketStatus}>
            <div className={styles.statusBadges}>
              <span className={`${styles.status} ${priorityClass}`}>
                <span className={styles.statusIcon}>{PRIORITY_ICONS[ticket.priority]}</span>
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </span>
              <span className={`${styles.status} ${statusClass}`}>
                <span className={styles.statusIcon}>{STATUS_ICONS[ticket.status]}</span>
                {TICKET_STATUS_LABELS[ticket.status]}
              </span>
            </div>
            
            {ticket.assignedToName && (
              <div className={styles.assignedInfo}>
                <span className={styles.assignedIcon}>👤</span>
                <span className={styles.assignedName}>Assegnato a {ticket.assignedToName}</span>
              </div>
            )}
            
            {ticket.escalationLevel && ticket.escalationLevel > 0 && (
              <div className={styles.escalationInfo}>
                <span className={styles.escalationIcon}>🚨</span>
                <span className={styles.escalationText}>
                  Escalato - Livello {ticket.escalationLevel}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesContainer}>
        <div className={styles.messagesList}>
          {ticket.messages.map((message, index) => (
            <MessageItem 
              key={message.id} 
              message={message}
              isLast={index === ticket.messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error}</span>
        </div>
      )}

      {/* Message input */}
      {ticket.status !== 'closed' && (
        <div className={styles.messageInput}>
          <div className={styles.inputHeader}>
            <span className={styles.inputLabel}>Rispondi al ticket</span>
            <span className={styles.inputHint}>Ctrl+Enter per inviare</span>
          </div>
          
          <div className={styles.inputContainer}>
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyPress}
              className={`${styles.textarea} ${messageError ? styles.error : ''}`}
              placeholder="Scrivi la tua risposta qui... Fornisci più dettagli possibili per aiutare lo staff a risolvere il problema."
              disabled={isSending}
              maxLength={2000}
              rows={3}
            />
            
            <div className={styles.inputFooter}>
              <div className={styles.inputInfo}>
                {messageError && (
                  <span className={styles.inputError}>{messageError}</span>
                )}
                <span className={styles.charCount}>
                  {newMessage.length}/2000
                </span>
              </div>
              
              <button
                onClick={handleSendMessage}
                disabled={isSending || !newMessage.trim() || newMessage.length < 10}
                className={styles.sendButton}
              >
                {isSending ? (
                  <>
                    <span className={styles.spinner}></span>
                    Invio...
                  </>
                ) : (
                  <>
                    📤 Invia Risposta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {ticket.status === 'closed' && (
        <div className={styles.closedNotice}>
          <span className={styles.closedIcon}>✅</span>
          <span className={styles.closedText}>
            Questo ticket è stato chiuso. Non è più possibile aggiungere messaggi.
          </span>
        </div>
      )}
    </div>
  );
};

// Componente per singolo messaggio
interface MessageItemProps {
  message: TicketMessage;
  isLast: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isLast }) => {
  const isStaff = message.sender.type === 'staff';
  const messageClass = isStaff ? styles.staffMessage : styles.characterMessage;
  
  return (
    <div className={`${styles.messageItem} ${messageClass}`}>
      <div className={styles.messageHeader}>
        <div className={styles.senderInfo}>
          <span className={styles.senderIcon}>
            {isStaff ? '🛠️' : '👤'}
          </span>
          <span className={styles.senderName}>
            {message.sender.name}
          </span>
          <span className={styles.senderType}>
            {isStaff ? 'Staff' : 'Personaggio'}
          </span>
        </div>
        
        <div className={styles.messageTime}>
          {formatMessageTime(message.sentAt)}
        </div>
      </div>
      
      <div className={styles.messageContent}>
        {message.content.split('\n').map((line, index) => (
          <React.Fragment key={index}>
            {line}
            {index < message.content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>

      {message.isInternal && (
        <div className={styles.internalBadge}>
          <span className={styles.internalIcon}>🔒</span>
          <span className={styles.internalText}>Nota interna staff</span>
        </div>
      )}
    </div>
  );
};