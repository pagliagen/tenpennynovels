import React from 'react';
import styles from '@/styles/components/TicketList.module.scss';

// Tipi per il sistema ticketing
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TicketListItem {
  id: string;
  title: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  lastActivity: Date;
  unreadCount: number;
  assignedToName?: string;
  isEscalated: boolean;
}

// Mapping status → etichette italiane
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

interface TicketListProps {
  tickets: TicketListItem[];
  onTicketClick: (ticketId: string) => void;
  isLoading: boolean;
  error: string;
}

const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return 'Ora';
  if (diffMinutes < 60) return `${diffMinutes} min fa`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h fa`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}g fa`;
  
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  });
};

const formatLastActivity = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
  
  if (diffMinutes < 1) return 'attivo ora';
  if (diffMinutes < 60) return `attivo ${diffMinutes} min fa`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `attivo ${diffHours}h fa`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'attivo ieri';
  if (diffDays < 7) return `attivo ${diffDays} giorni fa`;
  
  return `attivo il ${d.toLocaleDateString('it-IT')}`;
};

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  onTicketClick,
  isLoading,
  error
}) => {
  
  if (isLoading) {
    return (
      <div className={styles.ticketList}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <div className={styles.loadingText}>Caricamento ticket...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.ticketList}>
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorTitle}>Errore nel caricamento</div>
          <div className={styles.errorMessage}>{error}</div>
          <button 
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            🔄 Riprova
          </button>
        </div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className={styles.ticketList}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎫</div>
          <div className={styles.emptyTitle}>Nessun ticket ancora</div>
          <div className={styles.emptyMessage}>
            Non hai ancora creato nessun ticket di supporto.
            Usa il pulsante "Nuovo Ticket" per iniziare.
          </div>
        </div>
      </div>
    );
  }

  // Raggruppa ticket per status per migliore organizzazione
  const ticketGroups = {
    active: tickets.filter(t => ['open', 'assigned', 'in_progress', 'reopened'].includes(t.status)),
    waiting: tickets.filter(t => t.status === 'waiting_user'),
    closed: tickets.filter(t => t.status === 'closed')
  };

  return (
    <div className={styles.ticketList}>
      <div className={styles.listHeader}>
        <div className={styles.ticketCount}>
          {tickets.length} ticket totali
        </div>
        <div className={styles.filterInfo}>
          {ticketGroups.active.length > 0 && (
            <span className={styles.activeCount}>
              {ticketGroups.active.length} attivi
            </span>
          )}
          {ticketGroups.waiting.length > 0 && (
            <span className={styles.waitingCount}>
              {ticketGroups.waiting.length} in attesa
            </span>
          )}
        </div>
      </div>

      <div className={styles.ticketsContainer}>
        {/* Ticket Attivi */}
        {ticketGroups.active.length > 0 && (
          <div className={styles.ticketGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>Ticket Attivi</span>
              <span className={styles.groupCount}>{ticketGroups.active.length}</span>
            </div>
            <div className={styles.groupContent}>
              {ticketGroups.active.map(ticket => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => onTicketClick(ticket.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ticket In Attesa Risposta */}
        {ticketGroups.waiting.length > 0 && (
          <div className={styles.ticketGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>In Attesa di Risposta</span>
              <span className={styles.groupCount}>{ticketGroups.waiting.length}</span>
            </div>
            <div className={styles.groupContent}>
              {ticketGroups.waiting.map(ticket => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => onTicketClick(ticket.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ticket Chiusi (max 5) */}
        {ticketGroups.closed.length > 0 && (
          <div className={styles.ticketGroup}>
            <div className={styles.groupHeader}>
              <span className={styles.groupTitle}>Ticket Chiusi</span>
              <span className={styles.groupCount}>{ticketGroups.closed.length}</span>
            </div>
            <div className={styles.groupContent}>
              {ticketGroups.closed.slice(0, 5).map(ticket => (
                <TicketItem
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => onTicketClick(ticket.id)}
                />
              ))}
              {ticketGroups.closed.length > 5 && (
                <div className={styles.moreTickets}>
                  + altri {ticketGroups.closed.length - 5} ticket chiusi
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente singolo ticket
interface TicketItemProps {
  ticket: TicketListItem;
  onClick: () => void;
}

const TicketItem: React.FC<TicketItemProps> = ({ ticket, onClick }) => {
  const statusClass = styles[`status-${ticket.status.replace('_', '-')}`] || styles.statusDefault;
  const priorityClass = styles[`priority-${ticket.priority}`] || styles.priorityDefault;
  
  return (
    <div 
      className={`${styles.ticketItem} ${statusClass} ${ticket.isEscalated ? styles.escalated : ''}`}
      onClick={onClick}
    >
      <div className={styles.ticketHeader}>
        <div className={styles.ticketTitle}>
          {ticket.isEscalated && (
            <span className={styles.escalatedBadge} title="Ticket escalato">
              🚨
            </span>
          )}
          <span className={styles.titleText}>{ticket.title}</span>
          {ticket.unreadCount > 0 && (
            <span className={styles.unreadBadge}>
              {ticket.unreadCount > 99 ? '99+' : ticket.unreadCount}
            </span>
          )}
        </div>
        <div className={styles.ticketMeta}>
          <span className={styles.createdDate}>
            {formatDate(ticket.createdAt)}
          </span>
        </div>
      </div>

      <div className={styles.ticketBody}>
        <div className={styles.ticketInfo}>
          <div className={styles.statusPriority}>
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
            <div className={styles.assignedTo}>
              <span className={styles.assignedIcon}>👤</span>
              <span className={styles.assignedName}>Assegnato a {ticket.assignedToName}</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.ticketFooter}>
        <div className={styles.lastActivity}>
          {formatLastActivity(ticket.lastActivity)}
        </div>
        <div className={styles.ticketId}>
          #{ticket.id.slice(-8)}
        </div>
      </div>
    </div>
  );
};