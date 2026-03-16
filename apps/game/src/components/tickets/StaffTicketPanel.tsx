/**
 * Staff Ticket Panel Component
 *
 * In-game quick view for staff to manage tickets
 *
 * @module components/tickets/StaffTicketPanel
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { TicketStatusBadge } from './TicketStatusBadge';
import { StaffTicketDetailView } from './StaffTicketDetailView';

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
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', margin: 0 }}>
          Gestione Ticket (Staff)
        </h2>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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

      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
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

// Staff Ticket Card Component
interface StaffTicketCardProps {
  ticket: any;
  onClick: () => void;
}

function StaffTicketCard({ ticket, onClick }: StaffTicketCardProps) {
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
            {ticket.priority === 'critical' ? 'CRITICO' : 'ALTA'}
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        Da: {ticket.createdBy?.characterName || 'N/A'}
        {' • '}
        {new Date(ticket.createdAt).toLocaleDateString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
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
