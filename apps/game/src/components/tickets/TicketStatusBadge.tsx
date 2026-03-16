/**
 * Ticket Status Badge Component
 *
 * Displays a colored badge for ticket status
 *
 * @module components/tickets/TicketStatusBadge
 */

'use client';

interface TicketStatusBadgeProps {
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  open: {
    label: 'Aperto',
    color: '#10b981',
    bgColor: '#d1fae5'
  },
  assigned: {
    label: 'Assegnato',
    color: '#3b82f6',
    bgColor: '#dbeafe'
  },
  in_progress: {
    label: 'In Lavorazione',
    color: '#f59e0b',
    bgColor: '#fef3c7'
  },
  waiting_user: {
    label: 'In Attesa',
    color: '#ef4444',
    bgColor: '#fee2e2'
  },
  closed: {
    label: 'Chiuso',
    color: '#6b7280',
    bgColor: '#f3f4f6'
  },
  reopened: {
    label: 'Riaperto',
    color: '#8b5cf6',
    bgColor: '#ede9fe'
  }
};

export function TicketStatusBadge({ status, className = '' }: TicketStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: config?.color ?? '#10b981',
        backgroundColor: config?.bgColor ?? '#d1fae5',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}
    >
      {config?.label ?? 'Aperto'}
    </span>
  );
}
