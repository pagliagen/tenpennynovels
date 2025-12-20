import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/ManagementLayout';
import { AuthContext } from '@/lib/auth';
import { ChartBadge, ChartDataItem } from '@/components/ChartBadge';
import styles from '@/styles/pages/Dashboard.module.scss';

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface SystemMetrics {
  // Statistiche principali (4 card grandi in alto)
  mainStats: {
    uniqueVisitors: {
      current: number;
      change: number; // percentuale cambio dal mese scorso
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

  // Browser/Device Analytics
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

  // Gameplay Stats
  gameplayStats: {
    charactersOnline: number;
    activeLocations: number;
    messagesLast24h: number;
    diceRollsLast24h: number;
    lettersDelivered: number;
    corporationsActive: number;
  };

  // Geographic data
  geographicStats: {
    countries: Array<{
      location: string;  // City name or Country name
      country: string;
      code: string;
      count: number;
      percentage: number;
      color: string;     // For chart rendering
    }>;
    cities: Array<{
      city: string;      // Es: "Terni"
      region?: string;   // Es: "Umbria"
      country: string;   // Es: "Italia"
      count: number;
    }>;
  };

  // Time-based activity
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
  const [refreshedMetrics, setRefreshedMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real analytics data from API
  useEffect(() => {
    async function fetchAnalyticsData() {
      try {
        setLoading(true);
        setError(null);

        // console.log('🔄 Fetching analytics data from API Gateway...');

        const response = await fetch(`${API_GATEWAY_URL}/admin/analytics/dashboard`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // console.log('📊 Analytics API response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Analytics API error:', response.status, errorText);
          throw new Error(`Analytics API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch analytics data');
        }

        // Transform API response to match expected format
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
            devices: [], // Will be added when available
            operatingSystems: [] // Will be added when available
          },
          gameplayStats: apiData.gameplay_activity,
          geographicStats: {
            countries: apiData.geographic_distribution?.locations || [],
            cities: [] // Will be added when available
          },
          activityStats: {
            hourlyActivity: [],
            dailyActivity: []
          }
        };

        setRefreshedMetrics(transformedMetrics);

      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');

        // Show error state without fallback data
        console.error('Analytics API error, no fallback data available');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyticsData();
  }, []);

  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMetrics = async () => {
    setIsRefreshing(true);
    try {
      // console.log('🔄 Refreshing analytics data...');

      const response = await fetch(`${API_GATEWAY_URL}/admin/analytics/dashboard`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // console.log('📊 Refresh API response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Transform API response to match expected format
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
          setRefreshedMetrics(transformedMetrics);
          setLastUpdated(new Date());
          setError(null);
        }
      }
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
      setError('Failed to refresh analytics data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh every 5 minutes (less frequent for analytics data)
  useEffect(() => {
    const interval = setInterval(refreshMetrics, 300000);
    return () => clearInterval(interval);
  }, [refreshedMetrics]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('it-IT').format(num);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}g ${hours}h ${minutes}m`;
  };

  const getHealthStatus = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'critical';
    if (value >= thresholds.warning) return 'warning';
    return 'good';
  };

  const hasRole = (requiredRoles: string[]) => {
    if (requiredRoles.length === 0) return true;
    const userRoles = authContext.user?.userRoles || [];
    const characterRoles = authContext.user?.characterRoles || [];
    return requiredRoles.some(role => userRoles.includes(role));
  };

  // Show loading state
  if (loading) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head>
          <title>TenpennyNovels Management - Dashboard</title>
        </Head>
        <div className={styles.modernDashboard}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>Caricamento dati analytics...</p>
          </div>
        </div>
      </ManagementLayout>
    );
  }

  // Show error state (with fallback to mock data)
  if (!refreshedMetrics) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head>
          <title>TenpennyNovels Management - Dashboard</title>
        </Head>
        <div className={styles.modernDashboard}>
          <div className={styles.errorContainer}>
            <p>Errore nel caricamento dati analytics</p>
            {error && <p className={styles.errorMessage}>{error}</p>}
            <button onClick={() => window.location.reload()}>Riprova</button>
          </div>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Dashboard</title>
      </Head>

      <div className={styles.modernDashboard}>
        {error && (
          <div className={styles.warningBanner}>
            <span>⚠️ Usando dati di fallback: {error}</span>
          </div>
        )}
        {/* Header minimal */}
        <div className={styles.dashboardHeader}>
          <h1 className={styles.pageTitle}>Statistiche mensili</h1>
          <button
            onClick={refreshMetrics}
            disabled={isRefreshing}
            className={styles.refreshButton}
          >
            <span className={`${styles.refreshIcon} ${isRefreshing ? styles.spinning : ''}`}>
              ↻
            </span>
          </button>
        </div>

        {/* 4 Main Stats Cards */}
        {refreshedMetrics.mainStats && (
          <div className={styles.mainStatsGrid}>
            {refreshedMetrics.mainStats.uniqueVisitors && (
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statIcon}>👁️</span>
                  <span className={styles.statLabel}>Visitatori unici</span>
                </div>
                <div className={styles.statValue}>{formatNumber(refreshedMetrics.mainStats.uniqueVisitors.current)}</div>
                <div className={`${styles.statChange} ${styles[refreshedMetrics.mainStats.uniqueVisitors.trend]}`}>
                  <span className={styles.changeIcon}>
                    {refreshedMetrics.mainStats.uniqueVisitors.trend === 'down' ? '▼' : '▲'}
                  </span>
                  {Math.abs(refreshedMetrics.mainStats.uniqueVisitors.change)}% dall'ultimo mese
                </div>
              </div>
            )}

            {refreshedMetrics.mainStats.pageViews && (
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statIcon}>📄</span>
                  <span className={styles.statLabel}>Pagine viste</span>
                </div>
                <div className={styles.statValue}>{formatNumber(refreshedMetrics.mainStats.pageViews.current)}</div>
                <div className={`${styles.statChange} ${styles[refreshedMetrics.mainStats.pageViews.trend]}`}>
                  <span className={styles.changeIcon}>
                    {refreshedMetrics.mainStats.pageViews.trend === 'down' ? '▼' : '▲'}
                  </span>
                  {Math.abs(refreshedMetrics.mainStats.pageViews.change)}% dall'ultimo mese
                </div>
              </div>
            )}

            {refreshedMetrics.mainStats.registeredUsers && (
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statIcon}>👥</span>
                  <span className={styles.statLabel}>Utenti iscritti</span>
                </div>
                <div className={styles.statValue}>{formatNumber(refreshedMetrics.mainStats.registeredUsers.current)}</div>
                <div className={`${styles.statChange} ${styles[refreshedMetrics.mainStats.registeredUsers.trend]}`}>
                  <span className={styles.changeIcon}>
                    {refreshedMetrics.mainStats.registeredUsers.trend === 'down' ? '▼' : '▲'}
                  </span>
                  {Math.abs(refreshedMetrics.mainStats.registeredUsers.change)}% dall'ultimo mese
                </div>
              </div>
            )}

            {refreshedMetrics.mainStats.sentActions && (
              <div className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statIcon}>⚡</span>
                  <span className={styles.statLabel}>Azioni inviate</span>
                </div>
                <div className={styles.statValue}>{formatNumber(refreshedMetrics.mainStats.sentActions.current)}</div>
                <div className={`${styles.statChange} ${styles[refreshedMetrics.mainStats.sentActions.trend]}`}>
                  <span className={styles.changeIcon}>
                    {refreshedMetrics.mainStats.sentActions.trend === 'down' ? '▼' : '▲'}
                  </span>
                  {Math.abs(refreshedMetrics.mainStats.sentActions.change)} dall'ultimo mese
                </div>
              </div>
            )}
          </div>
        )}

        {/* Secondary Grid for Charts and Stats */}
        <div className={styles.secondaryGrid}>
          {/* Browser Stats with Chart */}
          <ChartBadge
            title="Browser utilizzati"
            icon=""
            data={refreshedMetrics?.browserStats?.browsers?.map((browser): ChartDataItem => ({
              name: browser.name,
              version: browser.version,
              count: browser.count,
              percentage: browser.percentage,
              color: browser.color
            })) || []}
            displayField="name"
            secondaryField="version"
            topCount={5}
          />

          {/* Gameplay Stats */}
          {hasRole(['master', 'gestore']) && (
            <div className={styles.infoCard}>
              <div className={styles.cardHeader}>
                <h3>🎮 Attività Gameplay</h3>
              </div>
              <div className={styles.gameplayStats}>
                <div className={styles.gameplayStat}>
                  <span className={styles.gameplayIcon}>🟢</span>
                  <div className={styles.gameplayInfo}>
                    <div className={styles.gameplayValue}>{refreshedMetrics.gameplayStats.charactersOnline}</div>
                    <div className={styles.gameplayLabel}>Personaggi online</div>
                  </div>
                </div>
                <div className={styles.gameplayStat}>
                  <span className={styles.gameplayIcon}>🏛️</span>
                  <div className={styles.gameplayInfo}>
                    <div className={styles.gameplayValue}>{refreshedMetrics.gameplayStats.activeLocations}</div>
                    <div className={styles.gameplayLabel}>Location attive</div>
                  </div>
                </div>
                <div className={styles.gameplayStat}>
                  <span className={styles.gameplayIcon}>💬</span>
                  <div className={styles.gameplayInfo}>
                    <div className={styles.gameplayValue}>{formatNumber(refreshedMetrics.gameplayStats.messagesLast24h)}</div>
                    <div className={styles.gameplayLabel}>Messaggi (24h)</div>
                  </div>
                </div>
                <div className={styles.gameplayStat}>
                  <span className={styles.gameplayIcon}>🎲</span>
                  <div className={styles.gameplayInfo}>
                    <div className={styles.gameplayValue}>{refreshedMetrics.gameplayStats.diceRollsLast24h}</div>
                    <div className={styles.gameplayLabel}>Tiri dado (24h)</div>
                  </div>
                </div>
                <div className={styles.gameplayStat}>
                  <span className={styles.gameplayIcon}>✉️</span>
                  <div className={styles.gameplayInfo}>
                    <div className={styles.gameplayValue}>{refreshedMetrics.gameplayStats.lettersDelivered}</div>
                    <div className={styles.gameplayLabel}>Lettere consegnate</div>
                  </div>
                </div>
                <div className={styles.gameplayStat}>
                  <span className={styles.gameplayIcon}>🏢</span>
                  <div className={styles.gameplayInfo}>
                    <div className={styles.gameplayValue}>{refreshedMetrics.gameplayStats.corporationsActive}</div>
                    <div className={styles.gameplayLabel}>Corporazioni attive</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Geographic Stats */}
          <ChartBadge
            title="Distribuzione Geografica"
            icon="🌍"
            data={refreshedMetrics?.geographicStats?.countries?.map((location): ChartDataItem => ({
              location: location.location,
              country: location.country,
              code: location.code,
              count: location.count,
              percentage: location.percentage,
              color: location.color,
              name: location.location // Required field but we'll display 'location'
            })) || []}
            displayField="location"
            topCount={5}
          />
        </div>
      </div>
    </ManagementLayout >
  );
}

