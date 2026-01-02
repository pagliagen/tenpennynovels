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

interface AuditLog {
  _id: string;
  timestamp: Date;
  userId: string;
  username: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress: string;
  userAgent: string;
  changes?: any;
  result: 'success' | 'failure';
  errorMessage?: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalLogs: number;
  };
}

export default function AuditLogsPage({ authContext }: PageProps) {
  const { showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalPages: 1, totalLogs: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchAuditLogs = async (page: number = 1) => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortField,
        sortOrder
      });

      if (searchQuery) params.append('search', searchQuery);
      if (actionFilter) params.append('action', actionFilter);
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);
      if (resultFilter) params.append('result', resultFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`${API_BASE_URL}/admin/system/audit-logs?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Errore nel caricamento dei log');

      const result = await response.json();
      if (result.success && result.data) {
        setLogs(result.data.logs || []);
        setPagination(result.data.pagination);
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const exportLogs = async () => {
    try {
      showToast('Esportazione in corso...', 'info');

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (actionFilter) params.append('action', actionFilter);
      if (entityTypeFilter) params.append('entityType', entityTypeFilter);
      if (resultFilter) params.append('result', resultFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`${API_BASE_URL}/admin/system/audit-logs/export?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Errore nell\'esportazione');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString()}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      showToast('Log esportati con successo', 'success');
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  useEffect(() => {
    fetchAuditLogs(pagination.page);
  }, [sortField, sortOrder]);

  const handleSearch = () => {
    fetchAuditLogs(1);
  };

  if (loading && logs.length === 0) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head><title>TenpennyNovels Management - Log di Audit</title></Head>
        <div className={styles.pageContainer}>
          <h1>Log di Audit</h1>
          <p>Caricamento...</p>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head><title>TenpennyNovels Management - Log di Audit</title></Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
        <div>
          <h1>Log di Audit</h1>
          <p className={styles.subtitle}>Visualizza e filtra i log delle azioni amministrative</p>
        </div>

        <div className={styles.headerActions}>
          <button onClick={exportLogs} className={styles.secondaryButton} disabled={logs.length === 0}>
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className={styles.card} style={{ marginBottom: '20px' }}>
        <h3>Filtri</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
          <div>
            <label>
              Cerca
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Username, IP, Entity ID..."
                className={styles.input}
                style={{ width: '100%', marginTop: '5px' }}
              />
            </label>
          </div>

          <div>
            <label>
              Azione
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className={styles.select}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">Tutte</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
              </select>
            </label>
          </div>

          <div>
            <label>
              Tipo Entità
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className={styles.select}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">Tutti</option>
                <option value="character">Character</option>
                <option value="user">User</option>
                <option value="document">Document</option>
                <option value="system_configuration">System Config</option>
                <option value="location">Location</option>
              </select>
            </label>
          </div>

          <div>
            <label>
              Risultato
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className={styles.select}
                style={{ width: '100%', marginTop: '5px' }}
              >
                <option value="">Tutti</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </label>
          </div>

          <div>
            <label>
              Data Inizio
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={styles.input}
                style={{ width: '100%', marginTop: '5px' }}
              />
            </label>
          </div>

          <div>
            <label>
              Data Fine
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.input}
                style={{ width: '100%', marginTop: '5px' }}
              />
            </label>
          </div>
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button onClick={handleSearch} className={styles.primaryButton}>
            Applica Filtri
          </button>
          <button
            onClick={() => {
              setSearchQuery('');
              setActionFilter('');
              setEntityTypeFilter('');
              setResultFilter('');
              setStartDate('');
              setEndDate('');
              fetchAuditLogs(1);
            }}
            className={styles.secondaryButton}
          >
            Reset Filtri
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>
                Timestamp {sortField === 'timestamp' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('username')} style={{ cursor: 'pointer' }}>
                Utente {sortField === 'username' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Azione</th>
              <th>Entità</th>
              <th>IP Address</th>
              <th>Risultato</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td>{new Date(log.timestamp).toLocaleString('it-IT')}</td>
                <td>{log.username}</td>
                <td><code>{log.action}</code></td>
                <td>
                  <div>
                    <strong>{log.entityType}</strong>
                    {log.entityId && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{log.entityId}</div>}
                  </div>
                </td>
                <td><code>{log.ipAddress}</code></td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    backgroundColor: log.result === 'success' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                    color: log.result === 'success' ? '#4caf50' : '#f44336'
                  }}>
                    {log.result === 'success' ? '✅ Success' : '❌ Failure'}
                  </span>
                  {log.errorMessage && (
                    <div style={{ fontSize: '0.85rem', color: '#f44336', marginTop: '5px' }}>
                      {log.errorMessage}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={() => fetchAuditLogs(pagination.page - 1)}
            disabled={pagination.page === 1}
            className={styles.secondaryButton}
          >
            Precedente
          </button>
          <span>
            Pagina {pagination.page} di {pagination.totalPages} ({pagination.totalLogs} log totali)
          </span>
          <button
            onClick={() => fetchAuditLogs(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className={styles.secondaryButton}
          >
            Successiva
          </button>
        </div>
      )}

      {logs.length === 0 && (
        <div className={styles.emptyState}>
          <p>Nessun log trovato con i filtri selezionati.</p>
        </div>
      )}
      </div>
    </ManagementLayout>
  );
}
