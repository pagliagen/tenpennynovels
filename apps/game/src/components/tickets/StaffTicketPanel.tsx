/**
 * Staff Ticket Panel Component
 *
 * In-game quick view for staff to manage tickets
 *
 * @module components/tickets/StaffTicketPanel
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api/client';
import styles from '@/styles/components/tickets/StaffTicketPanel.module.scss';

import { StaffTicketDetailView } from './StaffTicketDetailView';
import { TicketStatusBadge } from './TicketStatusBadge';

export function StaffTicketPanel() {
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'mine'>('unassigned');

  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: ['tickets', 'staff', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'unassigned') {
        params.append('unassigned', 'true');
      } else if (filter === 'mine') {
        params.append('assignedToMe', 'true');
      }

      const response = await api.get<{ list: any[] }>(`/admin/tickets?${params.toString()}`);
      return response.list || [];
    },
    refetchInterval: 60000
  });

  // If ticket selected, show detail view
  if (currentTicketId) {
    return (
      <StaffTicketDetailView
        ticketId={currentTicketId}
        onBack={() => setCurrentTicketId(null)}
      />
    );
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.headerBlock}>
        <h2 className={styles.panelTitle}>
          Gestione Ticket (Staff)
        </h2>

        {/* Filters */}
        <div className={styles.filterRow}>
          <FilterButton
            active={filter === 'unassigned'}
            onClick={() => setFilter('unassigned')}
          >
            Non Assegnati
          </FilterButton>
          <FilterButton
            active={filter === 'mine'}
            onClick={() => setFilter('mine')}
          >
            Assegnati a Me
          </FilterButton>
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            Tutti
          </FilterButton>
        </div>
      </div>

      {/* Ticket List */}
      <div className={styles.listScroll}>
        {isLoading && (
          <div className={styles.stateMessage}>
            Caricamento ticket...
          </div>
        )}

        {error && (
          <div className={styles.stateError}>
            Errore nel caricamento dei ticket
          </div>
        )}

        {!isLoading && !error && tickets.length === 0 && (
          <div className={styles.stateMessage}>
            Nessun ticket trovato
          </div>
        )}

        {!isLoading && !error && tickets.length > 0 && (
          <div className={styles.ticketList}>
            {tickets.map((ticket: any) => (
              <StaffTicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setCurrentTicketId(ticket.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.tipBox}>
        💡 <strong>Tip:</strong> Per funzionalità avanzate (assegnazione, note interne, statistiche), usa il pannello Gestionale.
      </div>
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
      className={active ? styles.filterBtnActive : styles.filterBtn}
    >
      {children}
    </button>
  );
}

// Staff Ticket Card Component
interface StaffTicketCardProps {
  ticket: any;
  onClick: () => void;
}

function StaffTicketCard({ ticket, onClick }: StaffTicketCardProps) {
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
      className={styles.card}
    >
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{ticket.title}</h3>
        {ticket.unreadMessages > 0 && (
          <span className={styles.unreadBadge}>
            {ticket.unreadMessages}
          </span>
        )}
      </div>

      <div className={styles.badgeRow}>
        <TicketStatusBadge status={ticket.status} />
        <span className={styles.categoryChip}>
          {ticket.categoryLabel}
        </span>
        {ticket.priority === 'high' || ticket.priority === 'critical' ? (
          <span className={styles.priorityHigh}>
            {ticket.priority === 'critical' ? 'CRITICO' : 'ALTA'}
          </span>
        ) : null}
      </div>

      <div className={styles.cardMeta}>
        Da: {ticket.createdBy?.name || 'N/A'}
        {' • '}
        {new Date(ticket.createdAt).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })}
        {ticket.assignedTo && (
          <span className={styles.metaAssigned}>
            • Assegnato a: {ticket.assignedTo.name}
          </span>
        )}
      </div>
    </div>
  );
}
