import React from 'react';
import { useRouter } from 'next/router';
import { PersonalMetricCard, MetricItem } from './PersonalMetricCard';
import styles from '../../styles/components/dashboard/PersonalAdminMetrics.module.scss';

export interface PersonalMetricsData {
  pendingCharacters?: {
    count: number;
    totalPending: number;
    characters: Array<{
      id: string;
      characterName: string;
      characterSurname: string;
      username: string;
      occupation: string;
      daysWaiting: number;
    }>;
  };
  approvedByMe?: {
    weeklyCount: number;
    approvalRate: number;
    recentApprovals: Array<{
      id: string;
      characterName: string;
      characterSurname: string;
      approvedAt: string;
      daysAgo: number;
    }>;
  };
  pendingXP?: {
    count: number;
    sessions: Array<{
      id: string;
      title: string;
      sessionDate: string;
      participantCount: number;
      daysOverdue: number;
    }>;
  };
  assignedTickets?: {
    count: number;
    tickets: Array<{
      id: string;
      title: string;
      priority: string;
      createdAt: string;
      daysOpen: number;
    }>;
  };
}

export interface PersonalAdminMetricsProps {
  characterId?: string;
  metrics: PersonalMetricsData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export const PersonalAdminMetrics: React.FC<PersonalAdminMetricsProps> = ({
  metrics,
  loading = false,
  onRefresh
}) => {
  const router = useRouter();

  // Transform pending characters data to MetricItem[]
  const pendingCharactersItems: MetricItem[] = metrics?.pendingCharacters?.characters?.slice(0, 3).map(char => ({
    id: char.id,
    label: `${char.characterName} ${char.characterSurname}`,
    meta: `${char.daysWaiting} giorni fa`
  })) || [];

  // Transform approved by me data to MetricItem[]
  const approvedByMeItems: MetricItem[] = metrics?.approvedByMe?.recentApprovals?.slice(0, 3).map(char => ({
    id: char.id,
    label: `${char.characterName} ${char.characterSurname}`,
    meta: `${char.daysAgo} giorni fa`
  })) || [];

  // Transform pending XP sessions to MetricItem[]
  const pendingXPItems: MetricItem[] = metrics?.pendingXP?.sessions?.slice(0, 3).map(session => ({
    id: session.id,
    label: session.title,
    meta: `${session.participantCount} PG • ${session.daysOverdue} giorni`
  })) || [];

  // Transform assigned tickets to MetricItem[]
  const assignedTicketsItems: MetricItem[] = metrics?.assignedTickets?.tickets?.slice(0, 3).map(ticket => ({
    id: ticket.id,
    label: ticket.title,
    meta: `${ticket.priority} • ${ticket.daysOpen} giorni`
  })) || [];

  return (
    <div className={styles.personalMetrics}>
      {onRefresh && (
        <div className={styles.metricsHeader}>
          <button
            className={styles.refreshButton}
            onClick={onRefresh}
            disabled={loading}
            type="button"
          >
            🔄 Aggiorna
          </button>
        </div>
      )}

      <div className={styles.metricsGrid}>
        {/* Card 1: Personaggi da Approvare */}
        <PersonalMetricCard
          icon="📋"
          title="Personaggi da Approvare"
          count={metrics?.pendingCharacters?.totalPending ?? 0}
          subtitle={
            metrics?.pendingCharacters?.totalPending
              ? `${metrics.pendingCharacters.count} più vecchi mostrati`
              : undefined
          }
          items={pendingCharactersItems}
          onViewAll={() => router.push('/characters/approvals')}
          loading={loading}
          emptyMessage="✓ Nessun personaggio in attesa"
        />

        {/* Card 2: Approvati da Me */}
        <PersonalMetricCard
          icon="✅"
          title="Approvati da Me"
          count={metrics?.approvedByMe?.weeklyCount ?? 0}
          subtitle={
            metrics?.approvedByMe?.approvalRate
              ? `Tasso approvazione: ${metrics.approvedByMe.approvalRate}%`
              : 'Ultimi 7 giorni'
          }
          trend={
            metrics?.approvedByMe?.approvalRate
              ? {
                  value: metrics.approvedByMe.approvalRate,
                  direction: metrics.approvedByMe.approvalRate >= 70 ? 'up' : 'down'
                }
              : undefined
          }
          items={approvedByMeItems}
          onViewAll={() => router.push('/characters/approvals?filter=approved-by-me')}
          loading={loading}
          emptyMessage="Nessuna approvazione recente"
        />

        {/* Card 3: XP da Assegnare */}
        <PersonalMetricCard
          icon="⭐"
          title="XP da Assegnare"
          count={metrics?.pendingXP?.count ?? 0}
          subtitle={
            metrics?.pendingXP?.count
              ? `${metrics.pendingXP.count} sessioni in attesa`
              : 'Sessioni completate'
          }
          items={pendingXPItems}
          onViewAll={() => router.push('/sessions?filter=pending-xp')}
          loading={loading}
          emptyMessage="✓ Tutte le sessioni processate"
        />

        {/* Card 4: Ticket Assegnati */}
        <PersonalMetricCard
          icon="🎫"
          title="Ticket Assegnati"
          count={metrics?.assignedTickets?.count ?? 0}
          subtitle={
            metrics?.assignedTickets?.count
              ? `${metrics.assignedTickets.count} ticket aperti`
              : 'Ticket in gestione'
          }
          items={assignedTicketsItems}
          onViewAll={() => router.push('/tickets?filter=assigned-to-me')}
          loading={loading}
          emptyMessage="✓ Nessun ticket assegnato"
        />
      </div>
    </div>
  );
};
