import React, { useState, useCallback } from 'react';
import {
  useForumTopicPermissions,
  useUpsertForumTopicPermission,
  useDeleteForumTopicPermission
} from '@/hooks/api/useForumTopicPermissions';
import { useNotificationStore } from '@/store/notificationStore';
import { FORUM_PERMISSION_KEYS, type ForumTopicPermissionOverrideValues, type ForumPermissionDecision } from '@/types/api/ForumTopicPermission';
import styles from '@/styles/components/TopicPermissionsPanel.module.scss';

const DECISION_OPTIONS: { value: ''; label: string }[] = [{ value: '', label: 'Default' }];

interface TopicPermissionsPanelProps {
  topicId: string;
}

const EMPTY_OVERRIDES: Record<string, ForumPermissionDecision | ''> = {
  view: '', openThread: '', reply: '', attachImages: '',
};

export function TopicPermissionsPanel({ topicId }: TopicPermissionsPanelProps): React.ReactElement {
  const { data: overrides = [], isLoading } = useForumTopicPermissions(topicId);
  const upsert = useUpsertForumTopicPermission(topicId);
  const remove = useDeleteForumTopicPermission(topicId);
  const addNotification = useNotificationStore(s => s.addNotification);

  const [characterId, setCharacterId] = useState('');
  const [reason, setReason] = useState('');
  const [decisions, setDecisions] = useState<Record<string, ForumPermissionDecision | ''>>(EMPTY_OVERRIDES);

  const handleAdd = useCallback(async () => {
    if (!characterId.trim()) return;

    const cleaned: ForumTopicPermissionOverrideValues = {};
    for (const { key } of FORUM_PERMISSION_KEYS) {
      const value = decisions[key];
      if (value) cleaned[key] = value;
    }
    if (Object.keys(cleaned).length === 0) {
      addNotification({ type: 'error', message: 'Seleziona almeno un permesso da modificare' });
      return;
    }

    try {
      await upsert.mutateAsync({ characterId: characterId.trim(), data: { overrides: cleaned, reason: reason.trim() || undefined } });
      addNotification({ type: 'success', message: 'Permessi aggiornati' });
      setCharacterId('');
      setReason('');
      setDecisions(EMPTY_OVERRIDES);
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Errore nel salvataggio' });
    }
  }, [characterId, reason, decisions, upsert, addNotification]);

  const handleRemove = useCallback(async (charId: string) => {
    try {
      await remove.mutateAsync(charId);
      addNotification({ type: 'success', message: 'Override rimosso' });
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Errore nella rimozione' });
    }
  }, [remove, addNotification]);

  return (
    <div className={styles.panel}>
      <p className={styles.helpText}>
        Eccezioni per singolo personaggio ai 4 permessi base (vedere/aprire thread/rispondere/allegare
        immagini). &quot;Default&quot; segue la regola calcolata dalla bacheca; moderare/amministrare restano
        governati dal sistema permessi admin esistente, non da qui.
      </p>

      {isLoading ? (
        <div className={styles.loading}>Caricamento...</div>
      ) : overrides.length === 0 ? (
        <div className={styles.empty}>Nessun override attivo su questa bacheca</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Personaggio</th>
              {FORUM_PERMISSION_KEYS.map(({ key, label }) => <th key={key}>{label}</th>)}
              <th>Motivo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => (
              <tr key={o._id}>
                <td>{o.characterName || o.characterId}</td>
                {FORUM_PERMISSION_KEYS.map(({ key }) => (
                  <td key={key} className={o.overrides[key] === 'deny' ? styles.deny : o.overrides[key] === 'allow' ? styles.allow : undefined}>
                    {o.overrides[key] || '—'}
                  </td>
                ))}
                <td>{o.reason || '—'}</td>
                <td>
                  <button type="button" className={styles.removeBtn} onClick={() => handleRemove(o.characterId)}>
                    Rimuovi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.addForm}>
        <input
          type="text"
          className={styles.input}
          placeholder="ID personaggio"
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
        />
        {FORUM_PERMISSION_KEYS.map(({ key, label }) => (
          <select
            key={key}
            className={styles.select}
            value={decisions[key]}
            onChange={(e) => setDecisions((prev) => ({ ...prev, [key]: e.target.value as ForumPermissionDecision | '' }))}
            title={label}
          >
            {DECISION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{label}: {opt.label}</option>)}
            <option value="allow">{label}: Consenti</option>
            <option value="deny">{label}: Nega</option>
          </select>
        ))}
        <input
          type="text"
          className={styles.input}
          placeholder="Motivo (opzionale)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button type="button" className={styles.addBtn} onClick={handleAdd} disabled={upsert.isPending || !characterId.trim()}>
          {upsert.isPending ? 'Salvataggio...' : 'Applica'}
        </button>
      </div>
    </div>
  );
}
