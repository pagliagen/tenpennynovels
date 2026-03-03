/**
 * BanFormPanel - Reusable Ban Form Component
 *
 * Form riutilizzabile per ban utenti (single e bulk).
 * Gestisce reason, duration, e calcolo bannedUntil.
 */

import React, { useState } from 'react';
import { FormField } from '../shared/FormField';
import styles from '@/styles/components/BanFormPanel.module.scss';

export interface BanFormData {
  reason: string;
  duration: 'permanent' | 'temporary';
  bannedUntil?: string; // ISO string
}

export interface BanFormPanelProps {
  userCount?: number; // Per mostrare "Banna X utenti" nel messaggio
  onSubmit: (data: BanFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const DURATIONS = [
  { value: '15m', label: '15 minuti' },
  { value: '30m', label: '30 minuti' },
  { value: '1h', label: '1 ora' },
  { value: '2h', label: '2 ore' },
  { value: '6h', label: '6 ore' },
  { value: '12h', label: '12 ore' },
  { value: '1d', label: '1 giorno' },
  { value: '1w', label: '1 settimana' },
  { value: '1y', label: '1 anno' },
  { value: 'permanent', label: 'Permanente' }
];

/**
 * Calculate bannedUntil date based on duration
 */
function calculateBannedUntil(duration: string): Date | undefined {
  if (duration === 'permanent') return undefined;

  const now = new Date();
  const durations: Record<string, number> = {
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000
  };

  const ms = durations[duration];
  if (!ms) return undefined;

  return new Date(now.getTime() + ms);
}

export function BanFormPanel({
  userCount,
  onSubmit,
  onCancel,
  loading = false
}: BanFormPanelProps) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('1d');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    if (!reason.trim()) {
      setError('Motivo del ban obbligatorio');
      return;
    }

    if (!duration) {
      setError('Durata del ban obbligatoria');
      return;
    }

    try {
      const bannedUntil = calculateBannedUntil(duration);
      const banData: BanFormData = {
        reason: reason.trim(),
        duration: duration === 'permanent' ? 'permanent' : 'temporary',
        bannedUntil: bannedUntil?.toISOString()
      };

      await onSubmit(banData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il ban');
    }
  };

  return (
    <form className={styles.banForm} onSubmit={handleSubmit}>
      <div className={styles.formBody}>
        {userCount && userCount > 1 && (
          <div className={styles.infoBox}>
            <strong>Banna {userCount} utenti selezionati</strong>
          </div>
        )}

        <FormField
          label="Motivo del Ban"
          type="textarea"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Inserisci il motivo del ban..."
          required
          disabled={loading}
          helpText="Il motivo sarà visibile all'utente"
        />

        <FormField
          label="Durata"
          type="select"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          options={DURATIONS}
          required
          disabled={loading}
          helpText={
            duration !== 'permanent'
              ? `Scade: ${calculateBannedUntil(duration)?.toLocaleString('it-IT')}`
              : 'Il ban non scadrà automaticamente'
          }
        />

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
      </div>

      <div className={styles.formActions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={loading}
        >
          Annulla
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? 'Bannando...' : 'Conferma Ban'}
        </button>
      </div>
    </form>
  );
}
