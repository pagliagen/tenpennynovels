/**
 * Diario Tab Component
 *
 * Tre sotto-sezioni (visibili solo a proprietario e master):
 * - Diario classico: note libere con titolo/data/flag on-off
 * - Personaggi incontrati: note private su chi il personaggio ha conosciuto
 * - Role: sessioni di gioco a cui ha partecipato, con "segnala al master" e "scarica giocata"
 *
 * @module components/character/tabs/DiarioTab
 * @since 2.0.0
 */

'use client';

import { useState, type CSSProperties, type FormEvent } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import {
  useCharacterSessions,
  useCharacterChatScenes,
  useCreateDiaryEntry,
  useCreateEncounter,
  useDeleteDiaryEntry,
  useDeleteEncounter,
  useDiaryEntries,
  useEncounters,
  useUpdateDiaryEntry,
  downloadSessionTranscript,
  downloadSceneTranscript
} from '@/hooks/useCharacterDiary';
import { CreateTicketModal } from '@/components/tickets/CreateTicketModal';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface DiarioTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

type SubTab = 'classico' | 'incontrati' | 'role';

export function DiarioTab({ character, permissions }: DiarioTabProps): JSX.Element {
  const [subTab, setSubTab] = useState<SubTab>('classico');
  const canView = permissions.isOwner || permissions.masterOverride;

  if (!canView) {
    return (
      <div className={styles.root}>
        <div className={styles.lockPanel}>
          <div className={styles.emptyIconSm}>🔒</div>
          <h3 className={styles.lockTitle}>Diario Privato</h3>
          <p className={styles.lockText}>Il diario è visibile solo al proprietario del personaggio e ai master.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>📔 Diario del Personaggio</h2>

      <div className={styles.subTabsRow}>
        <button
          type="button"
          className={subTab === 'classico' ? styles.subTabButtonActive : styles.subTabButton}
          onClick={() => setSubTab('classico')}
        >
          📓 Diario
        </button>
        <button
          type="button"
          className={subTab === 'incontrati' ? styles.subTabButtonActive : styles.subTabButton}
          onClick={() => setSubTab('incontrati')}
        >
          🤝 Personaggi Incontrati
        </button>
        <button
          type="button"
          className={subTab === 'role' ? styles.subTabButtonActive : styles.subTabButton}
          onClick={() => setSubTab('role')}
        >
          🎭 Role
        </button>
      </div>

      {subTab === 'classico' && <DiarioClassico character={character} permissions={permissions} />}
      {subTab === 'incontrati' && <PersonaggiIncontrati character={character} permissions={permissions} />}
      {subTab === 'role' && <RoleLog character={character} />}

      {/* Metadata di base, sempre visibili in fondo */}
      <div className={styles.mtSection}>
        <div className={styles.gridAuto200}>
          <InfoCard title="📊 Stato" value={getStatusDisplay(character.playerStatus)} color={getStatusColor(character.playerStatus)} />
          {character.createdAt && (
            <InfoCard title="📅 Creato il" value={new Date(character.createdAt).toLocaleDateString('it-IT')} />
          )}
          {character.lastActive && (
            <InfoCard title="⏰ Ultima Attività" value={new Date(character.lastActive).toLocaleDateString('it-IT')} />
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Diario classico
// -------------------------------------------------------------------------

function DiarioClassico({ character, permissions }: { character: CharacterSheetData['character']; permissions: CharacterSheetPermissions }) {
  const { data, isLoading } = useDiaryEntries(character._id);
  const createEntry = useCreateDiaryEntry(character._id);
  const updateEntry = useUpdateDiaryEntry(character._id);
  const deleteEntry = useDeleteDiaryEntry(character._id);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const canWrite = permissions.editPermissions.diario;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    await createEntry.mutateAsync({ title: title.trim(), content: content.trim() });
    setTitle('');
    setContent('');
    setShowForm(false);
  };

  return (
    <div>
      {canWrite && (
        <div className={styles.actionButtonRow} style={{ marginBottom: '1rem' }}>
          <button type="button" className={styles.actionButton} onClick={() => setShowForm((v) => !v)}>
            {showForm ? '✕ Annulla' : '+ Nuova voce'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.bodyBox} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Titolo</label>
            <input className={styles.formInput} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Testo</label>
            <textarea className={styles.formTextarea} value={content} onChange={(e) => setContent(e.target.value)} maxLength={10000} required />
          </div>
          <button type="submit" className={styles.actionButton} disabled={createEntry.isPending}>
            {createEntry.isPending ? 'Salvataggio…' : 'Salva voce'}
          </button>
        </form>
      )}

      {isLoading && <p className={styles.lockTextPlain}>Caricamento…</p>}

      {!isLoading && (data?.entries.length ?? 0) === 0 && (
        <div className={styles.emptyStatePadded}>
          <div className={styles.emptyIcon}>📓</div>
          <p>Nessuna voce di diario.</p>
        </div>
      )}

      <div className={styles.reviewList}>
        {data?.entries.map((entry) => (
          <div key={entry._id} className={styles.reviewCard}>
            <div className={styles.cardHeaderRow}>
              <strong>{entry.title}</strong>
              <span className={styles.reviewMeta}>{new Date(entry.entryDate).toLocaleDateString('it-IT')}</span>
            </div>
            <p className={styles.reviewNotes}>{entry.content}</p>
            {canWrite && (
              <div className={styles.actionButtonRow} style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => updateEntry.mutate({ entryId: entry._id, isVisible: !entry.isVisible })}
                >
                  {entry.isVisible ? '👁️ Attiva' : '🚫 Disattivata'}
                </button>
                <button
                  type="button"
                  className={styles.actionButtonDanger}
                  onClick={() => deleteEntry.mutate(entry._id)}
                >
                  🗑️ Elimina
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Personaggi incontrati
// -------------------------------------------------------------------------

function PersonaggiIncontrati({ character, permissions }: { character: CharacterSheetData['character']; permissions: CharacterSheetPermissions }) {
  const { data, isLoading } = useEncounters(character._id);
  const createEncounter = useCreateEncounter(character._id);
  const deleteEncounter = useDeleteEncounter(character._id);
  const [showForm, setShowForm] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [notes, setNotes] = useState('');
  const canWrite = permissions.editPermissions.diario;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetName.trim() || !notes.trim()) return;
    await createEncounter.mutateAsync({ targetName: targetName.trim(), notes: notes.trim() });
    setTargetName('');
    setNotes('');
    setShowForm(false);
  };

  return (
    <div>
      {canWrite && (
        <div className={styles.actionButtonRow} style={{ marginBottom: '1rem' }}>
          <button type="button" className={styles.actionButton} onClick={() => setShowForm((v) => !v)}>
            {showForm ? '✕ Annulla' : '+ Nuovo personaggio'}
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.bodyBox} style={{ marginBottom: '1.5rem' }}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Nome del personaggio</label>
            <input className={styles.formInput} value={targetName} onChange={(e) => setTargetName(e.target.value)} maxLength={150} required />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Cosa sa/pensa il tuo personaggio</label>
            <textarea className={styles.formTextarea} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={10000} required />
          </div>
          <button type="submit" className={styles.actionButton} disabled={createEncounter.isPending}>
            {createEncounter.isPending ? 'Salvataggio…' : 'Salva'}
          </button>
        </form>
      )}

      {isLoading && <p className={styles.lockTextPlain}>Caricamento…</p>}

      {!isLoading && (data?.encounters.length ?? 0) === 0 && (
        <div className={styles.emptyStatePadded}>
          <div className={styles.emptyIcon}>🤝</div>
          <p>Nessun personaggio annotato finora.</p>
        </div>
      )}

      <div className={styles.reviewList}>
        {data?.encounters.map((enc) => (
          <div key={enc._id} className={styles.reviewCard}>
            <div className={styles.cardHeaderRow}>
              <strong>{enc.targetName}</strong>
              <span className={styles.reviewMeta}>{new Date(enc.updatedAt).toLocaleDateString('it-IT')}</span>
            </div>
            <p className={styles.reviewNotes}>{enc.notes}</p>
            {canWrite && (
              <div className={styles.actionButtonRow} style={{ marginTop: '0.75rem' }}>
                <button type="button" className={styles.actionButtonDanger} onClick={() => deleteEncounter.mutate(enc._id)}>
                  🗑️ Elimina
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Role
// -------------------------------------------------------------------------

interface RoleEntry {
  kind: 'session' | 'scene';
  id: string;
  title: string;
  date: string;
  summary?: string;
}

function RoleLog({ character }: { character: CharacterSheetData['character'] }) {
  const { data: sessionsData, isLoading: sessionsLoading } = useCharacterSessions(character._id);
  const { data: scenesData, isLoading: scenesLoading } = useCharacterChatScenes(character._id);
  const [reportSessionTitle, setReportSessionTitle] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isLoading = sessionsLoading || scenesLoading;

  const entries: RoleEntry[] = [
    ...(sessionsData?.sessions.map((session): RoleEntry => ({
      kind: 'session',
      id: session._id,
      title: session.title,
      date: session.sessionDate,
      summary: session.summary
    })) ?? []),
    ...(scenesData?.scenes.map((scene): RoleEntry => ({
      kind: 'scene',
      id: scene._id,
      title: `Giocata a ${scene.locationName || 'location sconosciuta'}`,
      date: scene.startedAt
    })) ?? [])
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDownload = async (entry: RoleEntry) => {
    setDownloadingId(entry.id);
    try {
      if (entry.kind === 'session') {
        await downloadSessionTranscript(character._id, entry.id);
      } else {
        await downloadSceneTranscript(character._id, entry.id);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div>
      {isLoading && <p className={styles.lockTextPlain}>Caricamento…</p>}

      {!isLoading && entries.length === 0 && (
        <div className={styles.emptyStatePadded}>
          <div className={styles.emptyIcon}>🎭</div>
          <p>Nessuna role registrata finora.</p>
        </div>
      )}

      <div className={styles.reviewList}>
        {entries.map((entry) => (
          <div key={`${entry.kind}-${entry.id}`} className={styles.reviewCard}>
            <div className={styles.cardHeaderRow}>
              <strong>{entry.title}</strong>
              <span className={styles.reviewMeta}>{new Date(entry.date).toLocaleDateString('it-IT')}</span>
            </div>
            {entry.summary && <p className={styles.reviewNotes}>{entry.summary}</p>}
            <div className={styles.actionButtonRow} style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => handleDownload(entry)}
                disabled={downloadingId === entry.id}
              >
                {downloadingId === entry.id ? 'Preparazione…' : '⬇️ Scarica giocata'}
              </button>
              <button type="button" className={styles.actionButton} onClick={() => setReportSessionTitle(entry.title)}>
                🚩 Segnala al master
              </button>
            </div>
          </div>
        ))}
      </div>

      {reportSessionTitle && (
        <CreateTicketModal
          onClose={() => setReportSessionTitle(null)}
          initialTitle={`Segnalazione role — ${reportSessionTitle}`}
          initialContent={`Segnalo al master la role "${reportSessionTitle}" del personaggio "${character.name}".\n\nNota aggiuntiva:\n`}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function InfoCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div className={styles.diarioCard}>
      <div className={styles.diarioCardTitle}>{title}</div>
      <div
        className={styles.diarioCardValue}
        style={color ? ({ '--accent': color } as CSSProperties) : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function getStatusDisplay(playerStatus?: string): string {
  switch (playerStatus) {
    case 'approved': return 'Approvato';
    case 'pending': return 'In Attesa';
    case 'draft': return 'Bozza';
    default: return 'Sconosciuto';
  }
}

function getStatusColor(playerStatus?: string): string {
  switch (playerStatus) {
    case 'approved': return '#4ade80';
    case 'pending': return '#fbbf24';
    case 'draft': return '#94a3b8';
    default: return '#999';
  }
}
