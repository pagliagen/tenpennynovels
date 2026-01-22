import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/ManagementLayout';
import { AuthContext } from '@/lib/auth';
import { PersonalAdminMetrics, PersonalMetricsData } from '@/components/dashboard/PersonalAdminMetrics';
import { GeneralGameStats } from '@/components/dashboard/GeneralGameStats';
import styles from '@/styles/pages/Dashboard.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface SystemMetrics {
  mainStats: {
    uniqueVisitors: {
      current: number;
      change: number;
      trend: 'up' | 'down';
    };
    pageViews: {
      current: number;
      change: number;
      trend: 'up' | 'down';
    };
    registeredUsers: {
      current: number;
      change: number;
      trend: 'up' | 'down';
    };
    sentActions: {
      current: number;
      change: number;
      trend: 'up' | 'down';
    };
  };
  browserStats: {
    browsers: Array<{
      name: string;
      version?: string;
      count: number;
      percentage: number;
      color: string;
    }>;
    devices: Array<{
      type: 'desktop' | 'mobile' | 'tablet';
      count: number;
      percentage: number;
    }>;
    operatingSystems: Array<{
      name: string;
      count: number;
      percentage: number;
    }>;
  };
  gameplayStats: {
    charactersOnline: number;
    activeLocations: number;
    messagesLast24h: number;
    diceRollsLast24h: number;
    lettersDelivered: number;
    corporationsActive: number;
  };
  geographicStats: {
    countries: Array<{
      location: string;
      country: string;
      code: string;
      count: number;
      percentage: number;
      color: string;
    }>;
    cities: Array<{
      city: string;
      region?: string;
      country: string;
      count: number;
    }>;
  };
  activityStats: {
    hourlyActivity: Array<{
      hour: number;
      users: number;
      actions: number;
    }>;
    dailyActivity: Array<{
      date: string;
      users: number;
      registrations: number;
      characters: number;
    }>;
  };
}

interface DashboardProps {
  authContext: AuthContext;
}

export default function Dashboard({ authContext }: DashboardProps) {
  const [personalMetrics, setPersonalMetrics] = useState<PersonalMetricsData | null>(null);
  const [generalMetrics, setGeneralMetrics] = useState<SystemMetrics | null>(null);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [errorPersonal, setErrorPersonal] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // Check if user has 'gestore' role
  const hasRole = (roles: string[]) => {
    if (!authContext?.user?.userRoles) return false;
    return roles.some(role => authContext.user?.userRoles?.includes(role) ?? false);
  };

  const isGestore = hasRole(['gestore']);

  // Fetch personal metrics (for all admin users)
  const fetchPersonalMetrics = async () => {
    try {
      setLoadingPersonal(true);
      setErrorPersonal(null);

      const [pendingChars, reviewStats, pendingSessions] = await Promise.all([
        fetch(`${API_GATEWAY_URL}/admin/characters/pending-for-me?limit=3`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_GATEWAY_URL}/admin/characters/review-stats?period=week`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${API_GATEWAY_URL}/admin/sessions/pending-xp-assignment?limit=3`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      const [pendingData, reviewData, sessionsData] = await Promise.all([
        pendingChars.json(),
        reviewStats.json(),
        pendingSessions.json()
      ]);

      // Transform API response to PersonalMetricsData
      const transformedMetrics: PersonalMetricsData = {
        pendingCharacters: pendingData.success ? {
          count: pendingData.data.count,
          totalPending: pendingData.data.totalPending,
          characters: pendingData.data.characters
        } : undefined,
        approvedByMe: reviewData.success ? {
          weeklyCount: reviewData.data.weeklyApproved || 0,
          approvalRate: reviewData.data.approvalRate || 0,
          recentApprovals: reviewData.data.recentApprovals || []
        } : undefined,
        pendingXP: sessionsData.success ? {
          count: sessionsData.data.count,
          sessions: sessionsData.data.sessions
        } : undefined,
        assignedTickets: {
          count: 0,
          tickets: []
        }
      };

      setPersonalMetrics(transformedMetrics);
    } catch (error) {
      console.error('Failed to fetch personal metrics:', error);
      setErrorPersonal(error instanceof Error ? error.message : 'Errore nel caricamento');
    } finally {
      setLoadingPersonal(false);
    }
  };

  // Fetch general game statistics (only for 'gestore')
  const fetchGeneralMetrics = async () => {
    if (!isGestore) return;

    try {
      setLoadingGeneral(true);
      setErrorGeneral(null);

      const response = await fetch(`${API_GATEWAY_URL}/admin/analytics/dashboard`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics data');
      }

      // Transform API response to SystemMetrics
      const apiData = result.data;
      const transformedMetrics: SystemMetrics = {
        mainStats: {
          uniqueVisitors: apiData.visitatori_unici,
          pageViews: apiData.pagine_viste,
          registeredUsers: apiData.utenti_iscritti,
          sentActions: apiData.azioni_inviate
        },
        browserStats: {
          browsers: apiData.browser_stats?.browsers || [],
          devices: [],
          operatingSystems: []
        },
        gameplayStats: apiData.gameplay_activity,
        geographicStats: {
          countries: apiData.geographic_distribution?.locations || [],
          cities: []
        },
        activityStats: {
          hourlyActivity: [],
          dailyActivity: []
        }
      };

      setGeneralMetrics(transformedMetrics);
    } catch (error) {
      console.error('Failed to fetch general metrics:', error);
      setErrorGeneral(error instanceof Error ? error.message : 'Errore nel caricamento');
    } finally {
      setLoadingGeneral(false);
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchPersonalMetrics();
    if (isGestore) {
      fetchGeneralMetrics();
    }
  }, [isGestore]);

  // Auto-refresh personal metrics every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchPersonalMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh general metrics every 5 minutes (only for gestore)
  useEffect(() => {
    if (isGestore) {
      const interval = setInterval(fetchGeneralMetrics, 300000);
      return () => clearInterval(interval);
    }
  }, [isGestore]);

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Dashboard</title>
      </Head>

      <div className={styles.modernDashboard}>
        {/* Personal Admin Section - Always Visible */}
        <section className={styles.personalSection}>
          <div className={styles.sectionHeader}>
            <h2>👤 La tua Dashboard Amministrativa</h2>
            {errorPersonal && (
              <span className={styles.errorBadge}>
                ⚠️ {errorPersonal}
              </span>
            )}
          </div>
          <PersonalAdminMetrics
            characterId={authContext.character?.id}
            metrics={personalMetrics}
            loading={loadingPersonal}
            onRefresh={fetchPersonalMetrics}
          />
        </section>

        {/* General Game Statistics - Only for 'gestore' Role */}
        {isGestore && (
          <section className={styles.generalStatsSection}>
            <div className={styles.sectionHeader}>
              <h2>📊 Statistiche Generali del Gioco</h2>
              {errorGeneral && (
                <span className={styles.errorBadge}>
                  ⚠️ {errorGeneral}
                </span>
              )}
            </div>
            <GeneralGameStats
              metrics={generalMetrics}
              loading={loadingGeneral}
              onRefresh={fetchGeneralMetrics}
              showGameplayStats={hasRole(['master', 'gestore'])}
            />
          </section>
        )}
      </div>
    </ManagementLayout>
  );
}
