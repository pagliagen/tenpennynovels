import React from 'react';
import { ChartBadge, ChartDataItem } from '@/components/ChartBadge';
import styles from '../../styles/components/dashboard/GeneralGameStats.module.scss';

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

export interface GeneralGameStatsProps {
  metrics: SystemMetrics | null;
  loading?: boolean;
  onRefresh?: () => void;
  showGameplayStats?: boolean; // Role-based, passed from parent
}

export const GeneralGameStats: React.FC<GeneralGameStatsProps> = ({
  metrics,
  loading = false,
  onRefresh,
  showGameplayStats = false
}) => {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('it-IT').format(num);
  };

  if (loading) {
    return (
      <div className={styles.generalStats}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p>Caricamento statistiche generali...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={styles.generalStats}>
        <div className={styles.errorContainer}>
          <p>Errore nel caricamento delle statistiche</p>
          <button onClick={onRefresh}>Riprova</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.generalStats}>
      {onRefresh && (
        <div className={styles.statsHeader}>
          <button
            onClick={onRefresh}
            className={styles.refreshButton}
            type="button"
          >
            🔄 Aggiorna
          </button>
        </div>
      )}

      {/* 4 Main Stats Cards */}
      {metrics.mainStats && (
        <div className={styles.mainStatsGrid}>
          {metrics.mainStats.uniqueVisitors && (
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>👁️</span>
                <span className={styles.statLabel}>Visitatori unici</span>
              </div>
              <div className={styles.statValue}>{formatNumber(metrics.mainStats.uniqueVisitors.current)}</div>
              <div className={`${styles.statChange} ${styles[metrics.mainStats.uniqueVisitors.trend]}`}>
                <span className={styles.changeIcon}>
                  {metrics.mainStats.uniqueVisitors.trend === 'down' ? '▼' : '▲'}
                </span>
                {Math.abs(metrics.mainStats.uniqueVisitors.change)}% dall'ultimo mese
              </div>
            </div>
          )}

          {metrics.mainStats.pageViews && (
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>📄</span>
                <span className={styles.statLabel}>Pagine viste</span>
              </div>
              <div className={styles.statValue}>{formatNumber(metrics.mainStats.pageViews.current)}</div>
              <div className={`${styles.statChange} ${styles[metrics.mainStats.pageViews.trend]}`}>
                <span className={styles.changeIcon}>
                  {metrics.mainStats.pageViews.trend === 'down' ? '▼' : '▲'}
                </span>
                {Math.abs(metrics.mainStats.pageViews.change)}% dall'ultimo mese
              </div>
            </div>
          )}

          {metrics.mainStats.registeredUsers && (
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>👥</span>
                <span className={styles.statLabel}>Utenti iscritti</span>
              </div>
              <div className={styles.statValue}>{formatNumber(metrics.mainStats.registeredUsers.current)}</div>
              <div className={`${styles.statChange} ${styles[metrics.mainStats.registeredUsers.trend]}`}>
                <span className={styles.changeIcon}>
                  {metrics.mainStats.registeredUsers.trend === 'down' ? '▼' : '▲'}
                </span>
                {Math.abs(metrics.mainStats.registeredUsers.change)}% dall'ultimo mese
              </div>
            </div>
          )}

          {metrics.mainStats.sentActions && (
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statIcon}>⚡</span>
                <span className={styles.statLabel}>Azioni inviate</span>
              </div>
              <div className={styles.statValue}>{formatNumber(metrics.mainStats.sentActions.current)}</div>
              <div className={`${styles.statChange} ${styles[metrics.mainStats.sentActions.trend]}`}>
                <span className={styles.changeIcon}>
                  {metrics.mainStats.sentActions.trend === 'down' ? '▼' : '▲'}
                </span>
                {Math.abs(metrics.mainStats.sentActions.change)} dall'ultimo mese
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
          data={metrics?.browserStats?.browsers?.map((browser): ChartDataItem => ({
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

        {/* Gameplay Stats - Role-based */}
        {showGameplayStats && metrics.gameplayStats && (
          <div className={styles.infoCard}>
            <div className={styles.cardHeader}>
              <h3>🎮 Attività Gameplay</h3>
            </div>
            <div className={styles.gameplayStats}>
              <div className={styles.gameplayStat}>
                <span className={styles.gameplayIcon}>🟢</span>
                <div className={styles.gameplayInfo}>
                  <div className={styles.gameplayValue}>{metrics.gameplayStats.charactersOnline}</div>
                  <div className={styles.gameplayLabel}>Personaggi online</div>
                </div>
              </div>
              <div className={styles.gameplayStat}>
                <span className={styles.gameplayIcon}>🏛️</span>
                <div className={styles.gameplayInfo}>
                  <div className={styles.gameplayValue}>{metrics.gameplayStats.activeLocations}</div>
                  <div className={styles.gameplayLabel}>Location attive</div>
                </div>
              </div>
              <div className={styles.gameplayStat}>
                <span className={styles.gameplayIcon}>💬</span>
                <div className={styles.gameplayInfo}>
                  <div className={styles.gameplayValue}>{formatNumber(metrics.gameplayStats.messagesLast24h)}</div>
                  <div className={styles.gameplayLabel}>Messaggi (24h)</div>
                </div>
              </div>
              <div className={styles.gameplayStat}>
                <span className={styles.gameplayIcon}>🎲</span>
                <div className={styles.gameplayInfo}>
                  <div className={styles.gameplayValue}>{metrics.gameplayStats.diceRollsLast24h}</div>
                  <div className={styles.gameplayLabel}>Tiri dado (24h)</div>
                </div>
              </div>
              <div className={styles.gameplayStat}>
                <span className={styles.gameplayIcon}>✉️</span>
                <div className={styles.gameplayInfo}>
                  <div className={styles.gameplayValue}>{metrics.gameplayStats.lettersDelivered}</div>
                  <div className={styles.gameplayLabel}>Lettere consegnate</div>
                </div>
              </div>
              <div className={styles.gameplayStat}>
                <span className={styles.gameplayIcon}>🏢</span>
                <div className={styles.gameplayInfo}>
                  <div className={styles.gameplayValue}>{metrics.gameplayStats.corporationsActive}</div>
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
          data={metrics?.geographicStats?.countries?.map((location): ChartDataItem => ({
            location: location.location,
            country: location.country,
            code: location.code,
            count: location.count,
            percentage: location.percentage,
            color: location.color,
            name: location.location
          })) || []}
          displayField="location"
          topCount={5}
        />
      </div>
    </div>
  );
};
