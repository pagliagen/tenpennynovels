/**
 * Ticket Status Badge Component
 *
 * Displays a colored badge for ticket status
 *
 * @module components/tickets/TicketStatusBadge
 */

'use client';

import classNames from 'classnames';

import styles from '@/styles/components/tickets/TicketStatusBadge.module.scss';

interface TicketStatusBadgeProps {
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_user' | 'closed' | 'reopened';
  className?: string;
}

const STATUS_CLASS: Record<TicketStatusBadgeProps['status'], string> = {
  open: styles.open ?? '',
  assigned: styles.assigned ?? '',
  in_progress: styles.in_progress ?? '',
  waiting_user: styles.waiting_user ?? '',
  closed: styles.closed ?? '',
  reopened: styles.reopened ?? '',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Aperto',
  assigned: 'Assegnato',
  in_progress: 'In Lavorazione',
  waiting_user: 'In Attesa',
  closed: 'Chiuso',
  reopened: 'Riaperto',
};

export function TicketStatusBadge({ status, className = '' }: TicketStatusBadgeProps) {
  const mod = STATUS_CLASS[status] ?? STATUS_CLASS.open;
  const label = STATUS_LABEL[status] ?? STATUS_LABEL.open;

  return (
    <span className={classNames(styles.badge, mod, className)}>
      {label}
    </span>
  );
}
