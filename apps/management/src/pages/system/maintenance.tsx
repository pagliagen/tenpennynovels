/**
 * Maintenance Mode Page
 *
 * Gestione modalità manutenzione sistema.
 * Quando attiva, blocca accesso al gioco per tutti gli utenti (eccetto admin).
 *
 * @module pages/system/maintenance
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemAPI } from '@/lib/api/system';
import { useNotificationStore } from '@/store/notificationStore';
import { useConfirm } from '@/hooks/useConfirm';
import styles from '@/styles/pages/SystemConfig.module.scss';

const DEFAULT_MAINTENANCE_MESSAGE = 'Il sistema è attualmente in manutenzione. Torneremo online a breve. Grazie per la pazienza!';

export default function Maintenance() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore(state => state.addNotification);
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [maintenanceMessage, setMaintenanceMessage] = useState(DEFAULT_MAINTENANCE_MESSAGE);

  // Fetch maintenance status
  const { data: status, isLoading, error } = useQuery({
    queryKey: ['system', 'maintenance'],
    queryFn: () => systemAPI.getMaintenanceStatus()
  });

  // Toggle maintenance mutation
  const toggleMutation = useMutation({
    mutationFn: ({ enabled, message }: { enabled: boolean; message?: string }) =>
      systemAPI.setMaintenanceMode(enabled, message),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system', 'maintenance'] });
      addNotification({
        type: 'success',
        message: data.enabled
          ? 'Modalità manutenzione attivata'
          : 'Modalità manutenzione disattivata'
      });
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Errore durante il cambio modalità'
      });
    }
  });

  const handleToggle = async () => {
    const isCurrentlyEnabled = status?.enabled || false;

    const confirmed = await confirm({
      title: isCurrentlyEnabled ? 'Disattiva Manutenzione' : 'Attiva Manutenzione',
      message: isCurrentlyEnabled
        ? 'Sei sicuro di voler disattivare la modalità manutenzione? Gli utenti potranno accedere nuovamente al gioco.'
        : 'Sei sicuro di voler attivare la modalità manutenzione? Tutti gli utenti non-admin verranno disconnessi.'
    });

    if (confirmed) {
      toggleMutation.mutate({
        enabled: !isCurrentlyEnabled,
        message: !isCurrentlyEnabled ? maintenanceMessage : undefined
      });
    }
  };

  if (isLoading) {
    return (
      <ManagementLayout>
        <div className={styles.loading}>Caricamento stato manutenzione...</div>
      </ManagementLayout>
    );
  }

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.error}>
          <h2>Errore nel caricamento</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  const isEnabled = status?.enabled || false;

  return (
    <ManagementLayout>
      <Head>
        <title>Modalità Manutenzione - TenpennyNovels Management</title>
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1>🔧 Modalità Manutenzione</h1>
            <p>Gestione accesso sistema durante manutenzione</p>
          </div>
        </header>

        {/* Current Status */}
        <section className={styles.section}>
          <h2>Stato Attuale</h2>
          <div className={styles.status}>
            <strong>Modalità:</strong>
            <span className={isEnabled ? styles.active : styles.inactive}>
              {isEnabled ? '🔴 ATTIVA' : '🟢 DISATTIVA'}
            </span>
          </div>

          {isEnabled && status?.message && (
            <div className={styles.message}>
              <strong>Messaggio visualizzato:</strong>
              <p>{status.message}</p>
            </div>
          )}

          {isEnabled && status?.enabledAt && (
            <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Attivata il: {new Date(status.enabledAt).toLocaleString('it-IT')}
              {status.enabledBy && ` da ${status.enabledBy.username}`}
            </div>
          )}
        </section>

        {/* Controls */}
        <section className={styles.section}>
          <h2>{isEnabled ? 'Disattiva Manutenzione' : 'Attiva Manutenzione'}</h2>

          {!isEnabled && (
            <div className={styles.controls}>
              <div className={styles.settingItem}>
                <label htmlFor="maintenanceMessage">Messaggio da mostrare agli utenti</label>
                <textarea
                  id="maintenanceMessage"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="Inserisci il messaggio..."
                  disabled={toggleMutation.isPending}
                />
                <span className={styles.helpText}>
                  Questo messaggio verrà mostrato agli utenti che tentano di accedere al gioco
                </span>
              </div>

              <button
                className={styles.saveButton}
                onClick={handleToggle}
                disabled={toggleMutation.isPending || !maintenanceMessage.trim()}
              >
                {toggleMutation.isPending ? 'Attivazione...' : '🔴 Attiva Modalità Manutenzione'}
              </button>
            </div>
          )}

          {isEnabled && (
            <div className={styles.controls}>
              <div className={styles.message}>
                <strong>⚠️ Attenzione</strong>
                <p>
                  Disattivando la modalità manutenzione, gli utenti potranno nuovamente accedere al gioco.
                  Assicurati che tutti gli interventi di manutenzione siano stati completati.
                </p>
              </div>

              <button
                className={styles.saveButton}
                onClick={handleToggle}
                disabled={toggleMutation.isPending}
                style={{ backgroundColor: 'var(--color-success)' }}
              >
                {toggleMutation.isPending ? 'Disattivazione...' : '🟢 Disattiva Modalità Manutenzione'}
              </button>
            </div>
          )}
        </section>

        {/* Info */}
        <section className={styles.section}>
          <h2>ℹ️ Informazioni</h2>
          <div style={{ padding: '0 16px' }}>
            <ul style={{ color: 'var(--color-text-secondary)', lineHeight: '1.8', fontSize: '14px' }}>
              <li>Durante la manutenzione, solo gli admin possono accedere al sistema</li>
              <li>Gli utenti connessi verranno automaticamente disconnessi</li>
              <li>Nuovi tentativi di login verranno bloccati con il messaggio impostato</li>
              <li>L'API gateway risponderà con HTTP 503 Service Unavailable</li>
              <li>Ogni cambio di stato viene registrato nei log di audit</li>
            </ul>
          </div>
        </section>
      </div>

      {ConfirmDialogComponent}
    </ManagementLayout>
  );
}
