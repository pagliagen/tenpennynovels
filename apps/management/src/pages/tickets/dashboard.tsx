/**
 * Ticket Dashboard Page
 *
 * Overview statistics and metrics for ticket system
 */

import { useQuery } from '@tanstack/react-query';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import styles from '@/styles/pages/Dashboard.module.scss';

export default function TicketDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['tickets', 'dashboard', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tickets/stats', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch ticket stats');
      }

      const json = await res.json();
      return json.data;
    }
  });

  return (
    <ManagementLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Dashboard Ticket</h1>
          <p className={styles.subtitle}>Panoramica sistema supporto</p>
        </div>

        {isLoading && (
          <div className={styles.loading}>Caricamento statistiche...</div>
        )}

        {!isLoading && stats && (
          <div className={styles.statsGrid}>
            <StatCard
              title="Ticket Aperti"
              value={stats.openCount || 0}
              color="#3b82f6"
              icon="📩"
            />
            <StatCard
              title="Non Assegnati"
              value={stats.unassignedCount || 0}
              color="#ef4444"
              icon="⏳"
            />
            <StatCard
              title="In Lavorazione"
              value={stats.inProgressCount || 0}
              color="#f59e0b"
              icon="⚙️"
            />
            <StatCard
              title="Chiusi (30gg)"
              value={stats.closedThisMonthCount || 0}
              color="#10b981"
              icon="✅"
            />
          </div>
        )}

        {!isLoading && stats?.categoryStats && (
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
      </div>
    </ManagementLayout>
  );
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  color: string;
  icon: string;
}

function StatCard({ title, value, color, icon }: StatCardProps) {
  return (
    <div className={styles.statCard} style={{ borderLeftColor: color }}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statContent}>
        <div className={styles.statValue} style={{ color }}>{value}</div>
        <div className={styles.statTitle}>{title}</div>
      </div>
    </div>
  );
}
