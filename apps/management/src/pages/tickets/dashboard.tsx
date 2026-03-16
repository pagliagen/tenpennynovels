/**
 * Ticket Dashboard Page
 *
 * Overview statistics and metrics for ticket system
 */

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { api } from '@/lib/api/client';
import { ListResponse } from '@/types/api/common';
import styles from '@/styles/pages/Dashboard.module.scss';

interface UrgentTicket {
  _id: string;
  ticketNumber: number;
  title: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  createdBy: {
    characterId: string;
    characterName: string;
  };
  assignedTo?: {
    userId: string;
    username: string;
  } | null;
  createdAt: string;
}

export default function TicketDashboard() {
  const router = useRouter();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['tickets', 'dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get<any>('/admin/tickets/stats');
      return response.data;
    }
  });

  // Fetch urgent tickets (priority: critical/high + oldest unassigned)
  const { data: urgentTickets, isLoading: loadingUrgent } = useQuery({
    queryKey: ['tickets', 'dashboard', 'urgent'],
    queryFn: async () => {
      const queryString = api.buildQueryString({
        page: 1,
        pageSize: 10,
        status: 'open,assigned,in_progress,waiting_user',
        sortBy: 'priority,createdAt',
      });
      const response = await api.get(`/admin/tickets${queryString}`) as ListResponse<UrgentTicket>;
      return response.list || [];
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#ca8a04';
      case 'low': return '#65a30d';
      default: return '#6b7280';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'critical': return 'Critica';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return priority;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aperto';
      case 'assigned': return 'Assegnato';
      case 'in_progress': return 'In Lavorazione';
      case 'waiting_user': return 'Attesa Risposta';
      case 'closed': return 'Chiuso';
      default: return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'character_approval': return 'Approvazione';
      case 'character_edit': return 'Modifica';
      case 'quest_proposal': return 'Trama';
      case 'game_bug_report': return 'Bug';
      case 'improvement_suggestion': return 'Suggerimento';
      default: return category;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Meno di 1h';
    if (diffHours < 24) return `${diffHours}h fa`;
    if (diffDays === 1) return '1 giorno';
    return `${diffDays} giorni`;
  };

  const handleTicketClick = (ticketId: string) => {
    router.push(`/tickets/ticket-list#ticket=${ticketId}`);
  };

  return (
    <ManagementLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Dashboard Ticket</h1>
          <p className={styles.subtitle}>Panoramica sistema supporto</p>
        </div>

        {isLoading && <div className={styles.loading}>Caricamento...</div>}

        {!isLoading && stats && (
          <>
            <div className={styles.statsGrid}>
              <div className={styles.statCard} style={{ borderLeftColor: '#3b82f6' }}>
                <div className={styles.statIcon}>📩</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue} style={{ color: '#3b82f6' }}>
                    {stats.openCount || 0}
                  </div>
                  <div className={styles.statTitle}>Ticket Aperti</div>
                </div>
              </div>

              <div className={styles.statCard} style={{ borderLeftColor: '#ef4444' }}>
                <div className={styles.statIcon}>⏳</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue} style={{ color: '#ef4444' }}>
                    {stats.unassignedCount || 0}
                  </div>
                  <div className={styles.statTitle}>Non Assegnati</div>
                </div>
              </div>

              <div className={styles.statCard} style={{ borderLeftColor: '#f59e0b' }}>
                <div className={styles.statIcon}>⚙️</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue} style={{ color: '#f59e0b' }}>
                    {stats.inProgressCount || 0}
                  </div>
                  <div className={styles.statTitle}>In Lavorazione</div>
                </div>
              </div>

              <div className={styles.statCard} style={{ borderLeftColor: '#10b981' }}>
                <div className={styles.statIcon}>✅</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue} style={{ color: '#10b981' }}>
                    {stats.closedThisMonthCount || 0}
                  </div>
                  <div className={styles.statTitle}>Chiusi (30gg)</div>
                </div>
              </div>
            </div>

            {/* Ticket Urgenti */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2>🚨 Ticket Urgenti</h2>
                <button
                  className={styles.sectionButton}
                  onClick={() => router.push('/tickets/ticket-list')}
                >
                  Vedi Tutti →
                </button>
              </div>

              {loadingUrgent ? (
                <div className={styles.loading}>Caricamento ticket...</div>
              ) : urgentTickets && urgentTickets.length > 0 ? (
                <div className={styles.tableContainer}>
                  <table className={styles.simpleTable}>
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>#</th>
                        <th>Titolo</th>
                        <th style={{ width: '120px' }}>Categoria</th>
                        <th style={{ width: '100px' }}>Priorità</th>
                        <th style={{ width: '120px' }}>Stato</th>
                        <th style={{ width: '150px' }}>Character</th>
                        <th style={{ width: '120px' }}>Assegnato</th>
                        <th style={{ width: '100px' }}>Apertura</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urgentTickets.map((ticket) => (
                        <tr
                          key={ticket._id}
                          className={styles.urgentRow}
                          onClick={() => handleTicketClick(ticket._id)}
                        >
                          <td><strong>#{ticket.ticketNumber}</strong></td>
                          <td>{ticket.title}</td>
                          <td>{getCategoryLabel(ticket.category)}</td>
                          <td>
                            <span
                              className={styles.priorityBadge}
                              style={{ backgroundColor: getPriorityColor(ticket.priority) }}
                            >
                              {getPriorityLabel(ticket.priority)}
                            </span>
                          </td>
                          <td>{getStatusLabel(ticket.status)}</td>
                          <td>{ticket.createdBy.characterName}</td>
                          <td>{ticket.assignedTo?.username || '-'}</td>
                          <td style={{ color: '#dc2626', fontWeight: 600 }}>
                            {formatDate(ticket.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.emptyState}>Nessun ticket urgente al momento</p>
              )}
            </div>

            {/* Ticket per Categoria */}
            {stats?.categoryStats && (
              <div className={styles.section}>
                <h2>Ticket per Categoria</h2>
                <div className={styles.tableContainer}>
                  <table className={styles.simpleTable}>
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th>Aperti</th>
                        <th>In Lavorazione</th>
                        <th>Chiusi</th>
                        <th>Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.categoryStats.map((cat: any) => (
                        <tr key={cat.category}>
                          <td>{cat.categoryLabel}</td>
                          <td>{cat.openCount}</td>
                          <td>{cat.inProgressCount}</td>
                          <td>{cat.closedCount}</td>
                          <td><strong>{cat.totalCount}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ManagementLayout>
  );
}
