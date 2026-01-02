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

interface BroadcastMessage {
  _id: string;
  message: string;
  priority: 'info' | 'warning' | 'critical';
  targetAudience: 'all' | 'online' | 'role_specific';
  targetRoles?: string[];
  sentBy: string;
  sentAt: Date;
  recipientCount: number;
}

type Priority = 'info' | 'warning' | 'critical';
type TargetAudience = 'all' | 'online' | 'role_specific';

export default function BroadcastPage({ authContext }: PageProps) {
  const { showPrompt, showToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<BroadcastMessage[]>([]);

  // Form state
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('info');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [estimatedRecipients, setEstimatedRecipients] = useState<number>(0);

  const availableRoles = [
    'personaggio',
    'master',
    'moderatore',
    'amministratore'
  ];

  const fetchBroadcastHistory = async () => {
    try {
      // Note: This endpoint might not exist yet, but follows the pattern
      const response = await fetch(`${API_BASE_URL}/admin/system/broadcast/history?limit=10`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHistory(result.data.messages || []);
        }
      }
    } catch (error) {
      // Silently fail if endpoint doesn't exist
    }
  };

  const estimateRecipients = async () => {
    try {
      const params = new URLSearchParams({
        targetAudience,
        ...(targetAudience === 'role_specific' && { roles: selectedRoles.join(',') })
      });

      const response = await fetch(`${API_BASE_URL}/admin/system/broadcast/estimate?${params}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setEstimatedRecipients(result.data.count || 0);
        }
      }
    } catch (error) {
      // Use a default estimate
      setEstimatedRecipients(0);
    }
  };

  const sendBroadcast = async () => {
    if (!message.trim()) {
      showToast('Inserisci un messaggio', 'error');
      return;
    }

    if (targetAudience === 'role_specific' && selectedRoles.length === 0) {
      showToast('Seleziona almeno un ruolo', 'error');
      return;
    }

    const confirmed = await showPrompt(
      'Conferma Invio Broadcast',
      `Sei sicuro di voler inviare questo messaggio ${priority === 'critical' ? 'CRITICO' : priority} a ${
        targetAudience === 'all' ? 'tutti gli utenti' :
        targetAudience === 'online' ? 'gli utenti online' :
        `gli utenti con ruoli: ${selectedRoles.join(', ')}`
      }?`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/admin/system/broadcast`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          priority,
          targetAudience,
          ...(targetAudience === 'role_specific' && { targetRoles: selectedRoles })
        })
      });

      const result = await response.json();
      if (result.success) {
        showToast(`Messaggio broadcast inviato con successo a ${result.data?.recipientCount || 0} utenti`, 'success');
        setMessage('');
        setPriority('info');
        setTargetAudience('all');
        setSelectedRoles([]);
        setShowPreview(false);
        await fetchBroadcastHistory();
      } else {
        throw new Error(result.error || 'Errore nell\'invio');
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcastHistory();
  }, []);

  useEffect(() => {
    if (message.trim()) {
      estimateRecipients();
    }
  }, [targetAudience, selectedRoles]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'info': return '#2196f3';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
    }
  };

  return (
    <ManagementLayout authContext={authContext}>
      <Head><title>TenpennyNovels Management - Messaggi Broadcast</title></Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
        <div>
          <h1>Messaggi Broadcast</h1>
          <p className={styles.subtitle}>Invia messaggi di sistema a tutti gli utenti o gruppi specifici</p>
        </div>
      </div>

      {/* Compose Message Card */}
      <div className={styles.card}>
        <h2>Componi Messaggio</h2>

        <div style={{ marginTop: '20px' }}>
          <label>
            <strong>Messaggio</strong>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className={styles.textarea}
              placeholder="Inserisci il messaggio da inviare a tutti gli utenti..."
              style={{ width: '100%', marginTop: '8px' }}
            />
          </label>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '5px' }}>
            {message.length} caratteri
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
          <div>
            <label>
              <strong>Priorità</strong>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={styles.select}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="info">ℹ️ Info</option>
                <option value="warning">⚠️ Warning</option>
                <option value="critical">🚨 Critical</option>
              </select>
            </label>
          </div>

          <div>
            <label>
              <strong>Destinatari</strong>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as TargetAudience)}
                className={styles.select}
                style={{ width: '100%', marginTop: '8px' }}
              >
                <option value="all">Tutti gli utenti</option>
                <option value="online">Solo utenti online</option>
                <option value="role_specific">Ruoli specifici</option>
              </select>
            </label>
          </div>
        </div>

        {targetAudience === 'role_specific' && (
          <div style={{ marginTop: '20px' }}>
            <strong>Seleziona Ruoli</strong>
            <div style={{ display: 'flex', gap: '15px', marginTop: '10px', flexWrap: 'wrap' }}>
              {availableRoles.map(role => (
                <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button
            onClick={sendBroadcast}
            disabled={loading || !message.trim()}
            className={styles.primaryButton}
            style={{ backgroundColor: getPriorityColor(priority) }}
          >
            {loading ? 'Invio...' : '📢 Invia Broadcast'}
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            disabled={!message.trim()}
            className={styles.secondaryButton}
          >
            {showPreview ? 'Nascondi' : 'Mostra'} Anteprima
          </button>
          {estimatedRecipients > 0 && (
            <span style={{ color: 'var(--text-secondary)' }}>
              Destinatari stimati: <strong>{estimatedRecipients}</strong>
            </span>
          )}
        </div>

        {/* Preview */}
        {showPreview && message.trim() && (
          <div style={{
            marginTop: '20px',
            padding: '20px',
            borderRadius: '8px',
            border: `2px solid ${getPriorityColor(priority)}`,
            backgroundColor: `${getPriorityColor(priority)}15`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>
                {priority === 'info' ? 'ℹ️' : priority === 'warning' ? '⚠️' : '🚨'}
              </span>
              <strong style={{ textTransform: 'uppercase', color: getPriorityColor(priority) }}>
                {priority}
              </strong>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {message}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className={styles.card} style={{ marginTop: '30px' }}>
          <h2>Ultimi Broadcast Inviati</h2>
          <div style={{ marginTop: '15px' }}>
            {history.map((msg) => (
              <div
                key={msg._id}
                style={{
                  padding: '15px',
                  marginBottom: '10px',
                  borderRadius: '8px',
                  border: `1px solid ${getPriorityColor(msg.priority)}40`,
                  backgroundColor: `${getPriorityColor(msg.priority)}10`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>
                      {msg.priority === 'info' ? 'ℹ️' : msg.priority === 'warning' ? '⚠️' : '🚨'}
                    </span>
                    <strong style={{ color: getPriorityColor(msg.priority), textTransform: 'uppercase' }}>
                      {msg.priority}
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div>{new Date(msg.sentAt).toLocaleString('it-IT')}</div>
                    <div>Inviato da: {msg.sentBy}</div>
                    <div>Destinatari: {msg.recipientCount}</div>
                  </div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {msg.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.infoBox} style={{ marginTop: '30px' }}>
        <strong>⚠️ Attenzione:</strong> I messaggi broadcast vengono inviati immediatamente a tutti i destinatari
        selezionati. Assicurati di aver verificato il contenuto prima dell'invio. I messaggi CRITICAL dovrebbero
        essere usati solo per emergenze o manutenzioni immediate.
      </div>
      </div>
    </ManagementLayout>
  );
}
