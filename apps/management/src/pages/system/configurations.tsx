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

interface SystemConfiguration {
  key: string;
  section: string;
  value: any;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'email_template';
  lastModified?: Date;
  modifiedBy?: string;
}

export default function ConfigurationsPage({ authContext }: PageProps) {
  const { showPrompt, showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [configurations, setConfigurations] = useState<SystemConfiguration[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [editingConfig, setEditingConfig] = useState<SystemConfiguration | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const fetchConfigurations = async () => {
    try {
      setLoading(true);
      const url = sectionFilter === 'all'
        ? `${API_BASE_URL}/admin/system/configurations`
        : `${API_BASE_URL}/admin/system/configurations?section=${sectionFilter}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Errore nel caricamento delle configurazioni');

      const result = await response.json();
      if (result.success && result.data) {
        setConfigurations(result.data.configurations || []);
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (config: SystemConfiguration) => {
    setEditingConfig(config);
    setEditValue(typeof config.value === 'object' ? JSON.stringify(config.value, null, 2) : String(config.value));
  };

  const cancelEdit = () => {
    setEditingConfig(null);
    setEditValue('');
  };

  const saveConfiguration = async () => {
    if (!editingConfig) return;

    try {
      let parsedValue: any = editValue;

      if (editingConfig.type === 'json' || editingConfig.type === 'email_template') {
        try {
          parsedValue = JSON.parse(editValue);
        } catch (e) {
          showToast('Valore JSON non valido', 'error');
          return;
        }
      } else if (editingConfig.type === 'number') {
        parsedValue = parseFloat(editValue);
        if (isNaN(parsedValue)) {
          showToast('Valore numerico non valido', 'error');
          return;
        }
      } else if (editingConfig.type === 'boolean') {
        parsedValue = editValue === 'true';
      }

      const response = await fetch(`${API_BASE_URL}/admin/system/configurations/${editingConfig.key}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsedValue })
      });

      const result = await response.json();
      if (result.success) {
        showToast('Configurazione aggiornata con successo', 'success');
        cancelEdit();
        await fetchConfigurations();
      } else {
        throw new Error(result.error || 'Errore nel salvataggio');
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    }
  };

  const invalidateCache = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/system/configurations/invalidate-cache`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();
      if (result.success) {
        showToast('Cache invalidata con successo', 'success');
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchConfigurations();
  }, [sectionFilter]);

  if (loading) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head>
          <title>TenpennyNovels Management - Configurazioni Sistema</title>
        </Head>
        <div className={styles.pageContainer}>
          <h1>Configurazioni Sistema</h1>
          <p>Caricamento...</p>
        </div>
      </ManagementLayout>
    );
  }

  const sections = ['all', ...Array.from(new Set(configurations.map(c => c.section)))];

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Configurazioni Sistema</title>
      </Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
        <div>
          <h1>Configurazioni Sistema</h1>
          <p className={styles.subtitle}>Gestisci email templates e costanti di sistema</p>
        </div>

        <div className={styles.headerActions}>
          <button onClick={invalidateCache} className={styles.secondaryButton}>
            Invalida Cache
          </button>
          <button onClick={fetchConfigurations} className={styles.primaryButton}>
            Ricarica
          </button>
        </div>
      </div>

      <div className={styles.filterSection}>
        <label>
          Filtra per Sezione:
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className={styles.select}
          >
            {sections.map(section => (
              <option key={section} value={section}>
                {section === 'all' ? 'Tutte le sezioni' : section}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Chiave</th>
              <th>Sezione</th>
              <th>Tipo</th>
              <th>Valore</th>
              <th>Descrizione</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {configurations.map((config) => (
              <tr key={config.key}>
                <td><code>{config.key}</code></td>
                <td>{config.section}</td>
                <td>{config.type}</td>
                <td>
                  {editingConfig?.key === config.key ? (
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={config.type === 'json' || config.type === 'email_template' ? 5 : 2}
                      className={styles.textarea}
                      style={{ width: '100%', fontFamily: 'monospace' }}
                    />
                  ) : (
                    <pre style={{ margin: 0, fontSize: '0.85rem', maxWidth: '300px', overflow: 'auto' }}>
                      {typeof config.value === 'object'
                        ? JSON.stringify(config.value, null, 2)
                        : String(config.value)}
                    </pre>
                  )}
                </td>
                <td>{config.description}</td>
                <td>
                  {editingConfig?.key === config.key ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={saveConfiguration} className={styles.primaryButton}>
                        Salva
                      </button>
                      <button onClick={cancelEdit} className={styles.secondaryButton}>
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(config)} className={styles.secondaryButton}>
                      Modifica
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {configurations.length === 0 && (
        <div className={styles.emptyState}>
          <p>Nessuna configurazione trovata per questa sezione.</p>
        </div>
      )}
      </div>
    </ManagementLayout>
  );
}
