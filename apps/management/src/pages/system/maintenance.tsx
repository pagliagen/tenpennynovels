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

interface MaintenanceStatus {
  isEnabled: boolean;
  message: string;
  startTime?: Date;
  endTime?: Date;
  allowAdminAccess: boolean;
}

export default function MaintenancePage({ authContext }: PageProps) {
  const { showConfirm, showToast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MaintenanceStatus>({
    isEnabled: false,
    message: '',
    allowAdminAccess: true
  });
  const [message, setMessage] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [allowAdminAccess, setAllowAdminAccess] = useState<boolean>(true);

  const fetchMaintenanceStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/system/config`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Errore nel caricamento dello stato manutenzione');

      const result = await response.json();
      if (result.success && result.data) {
        const maintenanceData = result.data.config?.maintenance || {};
        setStatus({
          isEnabled: maintenanceData.isEnabled || false,
          message: maintenanceData.message || '',
          startTime: maintenanceData.startTime,
          endTime: maintenanceData.endTime,
          allowAdminAccess: maintenanceData.allowAdminAccess !== false
        });
        setMessage(maintenanceData.message || '');
        setAllowAdminAccess(maintenanceData.allowAdminAccess !== false);
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleMaintenance = async (enable: boolean) => {
    if (enable && !message.trim()) {
      showToast('Inserisci un messaggio di manutenzione', 'error');
      return;
    }

    const confirmed = await showConfirm(
      enable ? 'Attiva Manutenzione' : 'Disattiva Manutenzione',
      enable
        ? 'Il sito necessita di manutenzione.'
        : 'Fine della manutenzione.'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/admin/system/maintenance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: enable, // Backend expects 'enabled', not 'isEnabled'
          message: message.trim(),
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          allowAdminAccess
        })
      });

      const result = await response.json();
      if (result.result) {
        showToast(
          enable ? 'Modalità manutenzione attivata' : 'Modalità manutenzione disattivata',
          'success'
        );
        await fetchMaintenanceStatus();
      } else {
        throw new Error(result.error || 'Errore nell\'operazione');
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchMaintenanceStatus();
  }, []);

  if (loading) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head><title>TenpennyNovels Management - Gestione Manutenzione</title></Head>
        <div className={styles.pageContainer}>
          <h1>Gestione Manutenzione</h1>
          <p>Caricamento...</p>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout authContext={authContext}>
      <Head><title>TenpennyNovels Management - Gestione Manutenzione</title></Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
        <div>
          <h1>Gestione Manutenzione</h1>
          <p className={styles.subtitle}>Attiva o disattiva la modalità manutenzione del sito</p>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: '30px' }}>
        <h2>Stato Attuale</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '15px' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: status.isEnabled ? '#f44336' : '#4caf50'
            }}
          />
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {status.isEnabled ? 'MANUTENZIONE ATTIVA' : 'SISTEMA OPERATIVO'}
          </span>
        </div>
        {status.isEnabled && status.message && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(244, 67, 54, 0.1)', borderRadius: '8px' }}>
            <strong>Messaggio:</strong> {status.message}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2>Configurazione Manutenzione</h2>

        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', marginBottom: '10px' }}>
            <strong>Messaggio per gli Utenti</strong>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={styles.textarea}
              placeholder="Il sito è temporaneamente in manutenzione. Torneremo presto online."
              style={{ width: '100%', marginTop: '8px' }}
            />
          </label>
        </div>

        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <label>
            <strong>Inizio Manutenzione (Opzionale)</strong>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={styles.input}
              style={{ width: '100%', marginTop: '8px' }}
            />
          </label>

          <label>
            <strong>Fine Manutenzione (Opzionale)</strong>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={styles.input}
              style={{ width: '100%', marginTop: '8px' }}
            />
          </label>
        </div>

        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={allowAdminAccess}
              onChange={(e) => setAllowAdminAccess(e.target.checked)}
            />
            <strong>Permetti accesso agli amministratori durante la manutenzione</strong>
          </label>
        </div>

        <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
          {!status.isEnabled ? (
            <button
              onClick={() => toggleMaintenance(true)}
              className={styles.primaryButton}
              style={{ backgroundColor: '#f44336' }}
            >
              🔧 Attiva Manutenzione
            </button>
          ) : (
            <button
              onClick={() => toggleMaintenance(false)}
              className={styles.primaryButton}
              style={{ backgroundColor: '#4caf50' }}
            >
              ✅ Disattiva Manutenzione
            </button>
          )}
        </div>
      </div>

      <div className={styles.infoBox} style={{ marginTop: '30px' }}>
        <strong>⚠️ Attenzione:</strong> Quando la manutenzione è attiva, gli utenti normali non potranno accedere
        al sito e vedranno il messaggio configurato. Gli amministratori possono comunque accedere se l'opzione è
        abilitata.
      </div>
      </div>
    </ManagementLayout>
  );
}
