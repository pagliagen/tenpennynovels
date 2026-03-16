/**
 * Ticket Panel Content Component
 *
 * Lists user's tickets with filters and actions
 *
 * @module components/tickets/TicketPanelContent
 */

'use client';

import { useState } from 'react';
import { useUserTickets } from '@/hooks/useTickets';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketThreadView } from './TicketThreadView';
import { CreateTicketModal } from './CreateTicketModal';

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
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>I Miei Ticket</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Nuovo Ticket
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Caricamento ticket...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
            Errore nel caricamento dei ticket
          </div>
        )}

        {!isLoading && !error && tickets.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            Nessun ticket trovato
          </div>
        )}

        {!isLoading && !error && tickets.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {tickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onClick={() => setCurrentTicketId(ticket.id)}
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
      onClick={onClick}
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: active ? '#3b82f6' : 'transparent',
        color: active ? 'white' : '#6b7280',
        border: active ? 'none' : '1px solid #d1d5db',
        borderRadius: '0.375rem',
        fontSize: '0.875rem',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
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
      onClick={onClick}
      style={{
        padding: '1rem',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', margin: 0 }}>{ticket.title}</h3>
        {ticket.unreadMessages > 0 && (
          <span
            style={{
              padding: '0.125rem 0.5rem',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: '700'
            }}
          >
            {ticket.unreadMessages}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
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
        {ticket.priority === 'high' || ticket.priority === 'critical' ? (
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: '#fee2e2',
            color: '#ef4444',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            {ticket.priority === 'critical' ? 'CRITICO' : 'ALTA PRIORITÀ'}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        Creato il {new Date(ticket.createdAt).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
        {ticket.assignedTo && (
          <span style={{ marginLeft: '0.5rem' }}>
            • Assegnato a: {ticket.assignedTo.name}
          </span>
        )}
      </div>
    </div>
  );
}
