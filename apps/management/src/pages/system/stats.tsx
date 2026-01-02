import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/ManagementLayout';
import { AuthContext } from '@/lib/auth';
import { useNotification } from '@/contexts/NotificationContext';
import styles from '@/styles/pages/Management.module.scss';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

interface PageProps {
  authContext: AuthContext;
}

interface SystemStats {
  users: {
    total: number;
    online: number;
    activeToday: number;
  };
  characters: {
    total: number;
    approved: number;
    pending: number;
    draft: number;
  };
  messages: {
    locationChat: number;
    onGameMessages: number;
    offGameChat: number;
    totalToday: number;
  };
  sessions: {
    active: number;
    scheduledToday: number;
    completedThisWeek: number;
  };
  system: {
    uptime: number;
    databaseConnections: number;
    cacheHitRate: number;
    averageResponseTime: number;
  };
}

export default function StatsPage({ authContext }: PageProps) {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/system/stats`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Errore nel caricamento delle statistiche');

      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportStats = async () => {
    try {
      showToast('Esportazione in corso...', 'info');
      const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `system-stats-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Statistiche esportate con successo', 'success');
    } catch (error: any) {
      showToast(`Errore nell'esportazione: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(fetchStats, 30000); // 30 secondi
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading || !stats) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head><title>TenpennyNovels Management - Statistiche Sistema</title></Head>
        <div className={styles.pageContainer}>
          <h1>Statistiche Sistema</h1>
          <p>Caricamento...</p>
        </div>
      </ManagementLayout>
    );
  }

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <ManagementLayout authContext={authContext}>
      <Head><title>TenpennyNovels Management - Statistiche Sistema</title></Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
        <div>
          <h1>Statistiche Sistema</h1>
          <p className={styles.subtitle}>Dashboard statistiche in tempo reale</p>
        </div>

        <div className={styles.headerActions}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '15px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh (30s)</span>
          </label>
          <button onClick={exportStats} className={styles.secondaryButton}>
            Esporta CSV
          </button>
          <button onClick={fetchStats} className={styles.primaryButton}>
            Ricarica
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {/* Users Card */}
        <div className={styles.card}>
          <h3>👥 Utenti</h3>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Totali:</span>
              <strong>{stats.users.total}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Online:</span>
              <strong style={{ color: '#4caf50' }}>{stats.users.online}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Attivi Oggi:</span>
              <strong>{stats.users.activeToday}</strong>
            </div>
          </div>
        </div>

        {/* Characters Card */}
        <div className={styles.card}>
          <h3>🎭 Personaggi</h3>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Totali:</span>
              <strong>{stats.characters.total}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Approvati:</span>
              <strong style={{ color: '#4caf50' }}>{stats.characters.approved}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>In Approvazione:</span>
              <strong style={{ color: '#ff9800' }}>{stats.characters.pending}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Bozze:</span>
              <strong>{stats.characters.draft}</strong>
            </div>
          </div>
        </div>

        {/* Messages Card */}
        <div className={styles.card}>
          <h3>💬 Messaggi</h3>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Location Chat:</span>
              <strong>{stats.messages.locationChat}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>OnGame:</span>
              <strong>{stats.messages.onGameMessages}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>OffGame Chat:</span>
              <strong>{stats.messages.offGameChat}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Oggi:</span>
              <strong style={{ color: '#2196f3' }}>{stats.messages.totalToday}</strong>
            </div>
          </div>
        </div>

        {/* Sessions Card */}
        <div className={styles.card}>
          <h3>🎲 Sessioni</h3>
          <div style={{ marginTop: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Attive:</span>
              <strong style={{ color: '#4caf50' }}>{stats.sessions.active}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span>Pianificate Oggi:</span>
              <strong>{stats.sessions.scheduledToday}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Questa Settimana:</span>
              <strong>{stats.sessions.completedThisWeek}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* System Performance Card */}
      <div className={styles.card} style={{ marginTop: '20px' }}>
        <h2>⚡ Prestazioni Sistema</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '15px' }}>
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Uptime</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>
              {formatUptime(stats.system.uptime)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Connessioni DB</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>
              {stats.system.databaseConnections}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cache Hit Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px', color: stats.system.cacheHitRate > 80 ? '#4caf50' : '#ff9800' }}>
              {stats.system.cacheHitRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Avg Response Time</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '5px' }}>
              {stats.system.averageResponseTime}ms
            </div>
          </div>
        </div>
      </div>

      <div className={styles.infoBox} style={{ marginTop: '20px' }}>
        <strong>ℹ️ Nota:</strong> Le statistiche vengono aggiornate automaticamente ogni 30 secondi se
        l'auto-refresh è abilitato. Ultima aggiornamento: {new Date().toLocaleTimeString('it-IT')}
      </div>
      </div>
    </ManagementLayout>
  );
}
