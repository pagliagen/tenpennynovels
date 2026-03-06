/**
 * Broadcast Messages Page
 *
 * Invio messaggi broadcast a tutti gli utenti attivi del sistema.
 * Usa WebSocket per notifiche real-time.
 *
 * @module pages/system/broadcast
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useMutation } from '@tanstack/react-query';
import { systemAPI } from '@/lib/api/system';
import { useNotificationStore } from '@/store/notificationStore';
import styles from '@/styles/pages/SystemConfig.module.scss';

const MAX_MESSAGE_LENGTH = 500;

export default function Broadcast() {
  const addNotification = useNotificationStore(state => state.addNotification);
  const [message, setMessage] = useState('');

  // Send broadcast mutation
  const sendMutation = useMutation({
    mutationFn: (msg: string) => systemAPI.sendBroadcast(msg),
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        message: `Messaggio inviato con successo a ${data.sent} utenti`
      });
      setMessage('');
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Errore durante l\'invio del broadcast'
      });
    }
  });

  const handleSend = () => {
    if (message.trim() && message.length <= MAX_MESSAGE_LENGTH) {
      sendMutation.mutate(message.trim());
    }
  };

  const remainingChars = MAX_MESSAGE_LENGTH - message.length;
  const isMessageValid = message.trim().length > 0 && message.length <= MAX_MESSAGE_LENGTH;

  return (
    <ManagementLayout>
      <Head>
        <title>Broadcast - TenPennyNovels Management</title>
      </Head>

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1>📢 Messaggi Broadcast</h1>
            <p>Invia notifiche a tutti gli utenti attivi</p>
          </div>
        </header>

        {/* Warning */}
        <section className={styles.message}>
          <strong>⚠️ Attenzione</strong>
          <p>
            I messaggi broadcast verranno inviati immediatamente a tutti gli utenti connessi
            tramite WebSocket e notifiche in-app. Usa questa funzione con cautela.
          </p>
        </section>

        {/* Broadcast Form */}
        <section className={styles.section}>
          <h2>Componi Messaggio</h2>
          <div className={styles.broadcastForm}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Scrivi il messaggio da inviare a tutti gli utenti..."
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={sendMutation.isPending}
            />

            <span className={styles.charCount}>
              {remainingChars} caratteri rimanenti
            </span>

            <button
              className={styles.sendButton}
              onClick={handleSend}
              disabled={!isMessageValid || sendMutation.isPending}
            >
              {sendMutation.isPending ? 'Invio in corso...' : '📤 Invia Broadcast'}
            </button>
          </div>
        </section>

        {/* Usage Tips */}
        <section className={styles.section}>
          <h2>💡 Linee Guida</h2>
          <div style={{ padding: '0 16px' }}>
            <ul style={{ color: 'var(--color-text-secondary)', lineHeight: '1.8', fontSize: '14px' }}>
              <li>Mantieni i messaggi brevi e chiari (max {MAX_MESSAGE_LENGTH} caratteri)</li>
              <li>Usa broadcast solo per annunci importanti (manutenzione, nuove funzionalità, eventi)</li>
              <li>Evita spam: limita i broadcast a massimo 2-3 al giorno</li>
              <li>I messaggi vengono loggati nel sistema di audit</li>
              <li>Gli utenti offline riceveranno il messaggio al prossimo login</li>
            </ul>
          </div>
        </section>
      </div>
    </ManagementLayout>
  );
}
