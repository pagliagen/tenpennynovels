/**
 * Ticket Panel Content Component
 *
 * Lists user's tickets with filters and actions
 *
 * @module components/tickets/TicketPanelContent
 */

'use client';

import classNames from 'classnames';
import { useState } from 'react';

import { useUserTickets } from '@/hooks/useTickets';
import styles from '@/styles/components/tickets/TicketPanelContent.module.scss';

import { CreateTicketModal } from './CreateTicketModal';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketThreadView } from './TicketThreadView';

export function TicketPanelContent() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: tickets = [], isLoading, error } = useUserTickets(statusFilter);

  // If ticket selected, show thread view
  if (currentTicketId) {
    return (
      <TicketThreadView
        ticketId={currentTicketId}
        onBack={() => setCurrentTicketId(null)}
      />
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.headerBlock}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>I Miei Ticket</h2>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className={styles.newTicketButton}
          >
            + Nuovo Ticket
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <FilterButton
            active={statusFilter === undefined}
            onClick={() => setStatusFilter(undefined)}
          >
            Tutti
          </FilterButton>
          <FilterButton
            active={statusFilter === 'open'}
            onClick={() => setStatusFilter('open')}
          >
            Aperti
          </FilterButton>
          <FilterButton
            active={statusFilter === 'closed'}
            onClick={() => setStatusFilter('closed')}
          >
            Chiusi
          </FilterButton>
        </div>
      </div>

      {/* Ticket List */}
      <div className={styles.listArea}>
        {isLoading && (
          <div className={styles.centerMuted}>
            Caricamento ticket...
          </div>
        )}

        {error && (
          <div className={styles.centerError}>
            Errore nel caricamento dei ticket
          </div>
        )}

        {!isLoading && !error && tickets.length === 0 && (
          <div className={styles.centerMuted}>
            Nessun ticket trovato
          </div>
        )}

        {!isLoading && !error && tickets.length > 0 && (
          <div className={styles.ticketList}>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket._id}
                ticket={ticket}
                onClick={() => setCurrentTicketId(ticket._id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTicketModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

// Filter Button Component
interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, children }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(styles.filterButton, active && styles.filterButtonActive)}
    >
      {children}
    </button>
  );
}

// Ticket Card Component
interface TicketCardProps {
  ticket: any;
  onClick: () => void;
}

function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={styles.ticketCard}
    >
      <div className={styles.cardTitleRow}>
        <h3 className={styles.cardTitle}>{ticket.title}</h3>
        {ticket.unreadMessages > 0 && (
          <span className={styles.unreadBadge}>
            {ticket.unreadMessages}
          </span>
        )}
      </div>

      <div className={styles.cardMeta}>
        <TicketStatusBadge status={ticket.status} />
        <span className={styles.categoryPill}>
          {ticket.categoryLabel}
        </span>
        {ticket.priority === 'high' || ticket.priority === 'critical' ? (
          <span className={styles.priorityPill}>
            {ticket.priority === 'critical' ? 'CRITICO' : 'ALTA PRIORITÀ'}
          </span>
        ) : null}
      </div>

      <div className={styles.cardFooter}>
        Creato il {new Date(ticket.createdAt).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
        {ticket.assignedTo && (
          <span className={styles.footerAssigned}>
            • Assegnato a: {ticket.assignedTo.name}
          </span>
        )}
      </div>
    </div>
  );
}
