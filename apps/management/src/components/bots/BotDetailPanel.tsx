import React, { useState, useEffect } from 'react';
import { useBotDetail, useUpdateBot, useChangeBotLocation, useBotCharacterMemories } from '@/hooks/api/useBots';
import { useLocations } from '@/hooks/api/useLocations';
import styles from '@/styles/pages/ManageBot.module.scss';

interface BotDetailPanelProps {
  localAiBotId: string;
  onClose: () => void;
}

export function BotDetailPanel({ localAiBotId, onClose }: BotDetailPanelProps) {
  const { data, isLoading, error } = useBotDetail(localAiBotId);
  const { data: locationsData } = useLocations();
  const updateBot = useUpdateBot();
  const changeLocation = useChangeBotLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [memoryFilter, setMemoryFilter] = useState<string>('all');
  const [expandedRelationship, setExpandedRelationship] = useState<string | null>(null);

  const bot = data?.bot;
  const relationships: any[] = data?.relationships || [];
  const memories: any[] = data?.memories || [];
  const character = data?.character;

  useEffect(() => {
    if (bot && isEditing) {
      setEditData({
        name: bot.name || '',
        gender: bot.gender || '',
        publicDescription: bot.publicDescription || '',
        personality: {
          traits: bot.personality?.traits || [],
          speech_style: bot.personality?.speech_style || '',
          background: bot.personality?.background || '',
          coreValues: bot.personality?.coreValues || [],
        },
        systemPrompt: bot.systemPrompt || '',
        narrativeStyle: bot.narrativeStyle || null,
      });
    }
  }, [bot, isEditing]);

  const handleSave = async () => {
    await updateBot.mutateAsync({ id: localAiBotId, data: editData });
    setIsEditing(false);
  };

  const handleLocationChange = async (locationId: string) => {
    await changeLocation.mutateAsync({ id: localAiBotId, locationId });
  };

  const filteredMemories = memoryFilter === 'all'
    ? memories
    : memories.filter((m: any) => m.type === memoryFilter);

  if (isLoading) return <PanelShell onClose={onClose}><div className={styles.loading}>Caricamento...</div></PanelShell>;
  if (error || !bot) return <PanelShell onClose={onClose}><div className={styles.error}>Errore nel caricamento del bot</div></PanelShell>;

  const locations = locationsData?.data || locationsData || [];

  return (
    <PanelShell onClose={onClose}>
      <div className={styles.detailHeader}>
        <h2>{bot.name}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isEditing && <button className={styles.saveBtn} onClick={() => setIsEditing(true)}>Modifica</button>}
          <button className={styles.closeBtn} onClick={onClose}>Chiudi</button>
        </div>
      </div>

      {/* Sezione 1: Identità */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Identità</div>
        <div className={styles.fieldGroup}>
          {isEditing ? (
            <>
              <Field label="Nome">
                <input className={styles.fieldInput} value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
              </Field>
              <Field label="Genere">
                <select className={styles.fieldSelect} value={editData.gender} onChange={(e) => setEditData({ ...editData, gender: e.target.value })}>
                  <option value="male">Maschio</option>
                  <option value="female">Femmina</option>
                </select>
              </Field>
              <Field label="Descrizione pubblica">
                <textarea className={styles.fieldTextarea} value={editData.publicDescription} onChange={(e) => setEditData({ ...editData, publicDescription: e.target.value })} />
              </Field>
              <Field label="Tratti personalità (separati da virgola)">
                <input className={styles.fieldInput} value={editData.personality?.traits?.join(', ') || ''} onChange={(e) => setEditData({ ...editData, personality: { ...editData.personality, traits: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) } })} />
              </Field>
              <Field label="Stile di parlata">
                <textarea className={styles.fieldTextarea} value={editData.personality?.speech_style || ''} onChange={(e) => setEditData({ ...editData, personality: { ...editData.personality, speech_style: e.target.value } })} />
              </Field>
              <Field label="Background">
                <textarea className={styles.fieldTextarea} value={editData.personality?.background || ''} onChange={(e) => setEditData({ ...editData, personality: { ...editData.personality, background: e.target.value } })} />
              </Field>
              <Field label="Valori (separati da virgola)">
                <input className={styles.fieldInput} value={editData.personality?.coreValues?.join(', ') || ''} onChange={(e) => setEditData({ ...editData, personality: { ...editData.personality, coreValues: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) } })} />
              </Field>
              <Field label="System Prompt">
                <textarea className={styles.fieldTextarea} style={{ minHeight: 120 }} value={editData.systemPrompt} onChange={(e) => setEditData({ ...editData, systemPrompt: e.target.value })} />
              </Field>
              <Field label="Stile narrativo — Autore">
                <input className={styles.fieldInput} value={editData.narrativeStyle?.author || ''} onChange={(e) => setEditData({ ...editData, narrativeStyle: { ...editData.narrativeStyle, author: e.target.value } })} />
              </Field>
              <Field label="Stile narrativo — Guida">
                <textarea className={styles.fieldTextarea} value={editData.narrativeStyle?.guidance || ''} onChange={(e) => setEditData({ ...editData, narrativeStyle: { ...editData.narrativeStyle, guidance: e.target.value } })} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Nome"><span className={styles.fieldValue}>{bot.name}</span></Field>
              <Field label="Genere"><span className={styles.fieldValue}>{bot.gender === 'male' ? 'Maschio' : 'Femmina'}</span></Field>
              <Field label="Descrizione"><span className={styles.fieldValue}>{bot.publicDescription || '—'}</span></Field>
              <Field label="Tratti">
                <div className={styles.tagsInput}>
                  {(bot.personality?.traits || []).map((t: string, i: number) => <span key={i} className={styles.tag}>{t}</span>)}
                </div>
              </Field>
              <Field label="Stile di parlata"><span className={styles.fieldValue}>{bot.personality?.speech_style || '—'}</span></Field>
              <Field label="Background"><span className={styles.fieldValue}>{bot.personality?.background || '—'}</span></Field>
              {bot.personality?.coreValues?.length > 0 && (
                <Field label="Valori">
                  <div className={styles.tagsInput}>
                    {bot.personality.coreValues.map((v: string, i: number) => <span key={i} className={styles.tag}>{v}</span>)}
                  </div>
                </Field>
              )}
              {bot.narrativeStyle && (
                <Field label="Stile narrativo"><span className={styles.fieldValue}>{bot.narrativeStyle.author}: {bot.narrativeStyle.guidance}</span></Field>
              )}
            </>
          )}
        </div>
        {isEditing && (
          <div className={styles.actionBar}>
            <button className={styles.saveBtn} onClick={handleSave} disabled={updateBot.isPending}>
              {updateBot.isPending ? 'Salvataggio...' : 'Salva'}
            </button>
            <button className={styles.cancelBtn} onClick={() => setIsEditing(false)}>Annulla</button>
          </div>
        )}
      </div>

      {/* Sezione 2: Stato attuale */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Stato attuale</div>
        <div className={styles.fieldGroup}>
          <Field label="Mood">
            <span className={styles.fieldValue} style={{ fontWeight: 500, textTransform: 'capitalize' }}>
              {bot.currentMood?.type || 'neutro'}
            </span>
          </Field>

          <Field label="Emozioni globali (Plutchik)">
            <PlutchikDisplay axes={bot.emotionState?.axes} trigger={bot.emotionState?.trigger} />
          </Field>

          <Field label="Location">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={styles.fieldValue}>{character?.location?.name || 'Nessuna'}</span>
              {Array.isArray(locations) && locations.length > 0 && (
                <select
                  className={styles.fieldSelect}
                  style={{ width: 'auto', maxWidth: 200 }}
                  value={character?.location?._id || ''}
                  onChange={(e) => e.target.value && handleLocationChange(e.target.value)}
                  disabled={changeLocation.isPending}
                >
                  <option value="">— Cambia —</option>
                  {locations.map((loc: any) => (
                    <option key={loc._id} value={loc._id}>{loc.name}</option>
                  ))}
                </select>
              )}
            </div>
          </Field>
        </div>
      </div>

      {/* Sezione 3: Relazioni */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Relazioni ({relationships.length})</div>
        {relationships.length > 0 ? (
          <div className={styles.relationshipList}>
            {relationships.map((rel: any) => (
              <RelationshipCard
                key={rel._id}
                rel={rel}
                isExpanded={expandedRelationship === rel.externalCharacterId}
                onToggle={() => setExpandedRelationship(expandedRelationship === rel.externalCharacterId ? null : rel.externalCharacterId)}
                localAiBotId={localAiBotId}
              />
            ))}
          </div>
        ) : <div className={styles.empty}>Nessuna relazione</div>}
      </div> 
    </PanelShell>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function PanelShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className={styles.detailOverlay} onClick={onClose} />
      <div className={styles.detailPanel}>{children}</div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </div>
  );
}

function RelationshipCard({ rel, isExpanded, onToggle, localAiBotId }: { rel: any; isExpanded: boolean; onToggle: () => void; localAiBotId: string }) {
  const { data: charMemories } = useBotCharacterMemories(
    isExpanded ? localAiBotId : '',
    isExpanded ? rel.externalCharacterId : '',
  );

  const sentimentPct = ((rel.sentiment + 1) / 2) * 100; // -1..1 → 0..100

  return (
    <div className={`${styles.relationshipCard} ${isExpanded ? styles.expanded : ''}`} onClick={onToggle}>
      <div className={styles.relationshipHeader}>
        <span className={styles.relationshipName}>{rel.characterName || 'Sconosciuto'}</span>
        <div className={styles.relationshipStats}>
          <StatBar label="Fiducia" value={rel.trust} className={styles.trustFill} />
          <StatBar label="Familiarità" value={rel.familiarity} className={styles.familiarityFill} />
          <StatBar label="Sentiment" value={sentimentPct / 100} className={styles.sentimentFill} />
        </div>
      </div>

      <PlutchikDisplay axes={rel.emotionState?.axes} compact />

      <div className={styles.relationshipMeta}>
        <span>Interazioni: {rel.interactionCount}</span>
        <span>Ultimo: {new Date(rel.lastInteraction).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
      </div>

      {isExpanded && rel.significantEvents?.length > 0 && (
        <div className={styles.significantEvents}>
          <strong>Eventi significativi:</strong>
          <ul>{rel.significantEvents.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {isExpanded && charMemories && charMemories.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className={styles.sectionTitle} style={{ fontSize: 12 }}>Memorie con {rel.characterName}</div>
          <div className={styles.memoryList}>
            {charMemories.slice(0, 10).map((mem: any) => (
              <div key={mem._id} className={styles.memoryItem}>
                <div className={styles.memorySummary}>{mem.summary}</div>
                <div className={styles.memoryMeta}>
                  <span className={`${styles.memoryType} ${styles[mem.type]}`}>{mem.type}</span>
                  <span>imp: {mem.importance}</span>
                  <span>{new Date(mem.timestamp).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={styles.statBar}>
      <span className={styles.label}>{label}</span>
      <div className={styles.track}>
        <div className={`${styles.fill} ${className}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span>{Math.round(value * 100)}%</span>
    </div>
  );
}

const PLUTCHIK_CONFIG: Array<{ key: string; label: [string, string, string]; color: string }> = [
  { key: 'gioia',         label: ['serenità', 'gioia', 'estasi'],              color: '#f7dc6f' },
  { key: 'fiducia',       label: ['accettazione', 'fiducia', 'ammirazione'],   color: '#82e0aa' },
  { key: 'paura',         label: ['apprensione', 'paura', 'terrore'],          color: '#85c1e9' },
  { key: 'sorpresa',      label: ['distrazione', 'sorpresa', 'stupore'],       color: '#bb8fce' },
  { key: 'tristezza',     label: ['pensierosità', 'tristezza', 'angoscia'],    color: '#5dade2' },
  { key: 'disgusto',      label: ['noia', 'disgusto', 'odio'],                 color: '#a3e4d7' },
  { key: 'rabbia',        label: ['irritazione', 'rabbia', 'collera'],         color: '#ec7063' },
  { key: 'anticipazione', label: ['interesse', 'anticipazione', 'vigilanza'],  color: '#f0b27a' },
];

function PlutchikDisplay({ axes, trigger, compact }: { axes?: Record<string, number>; trigger?: string; compact?: boolean }) {
  if (!axes) return <span className={styles.fieldValue} style={{ fontStyle: 'italic', color: '#666' }}>Nessuna emozione</span>;

  const active = PLUTCHIK_CONFIG.filter(({ key }) => (axes[key] || 0) >= 0.05);
  if (active.length === 0) return <span className={styles.fieldValue} style={{ fontStyle: 'italic', color: '#666' }}>Nessuna emozione</span>;

  return (
    <div style={{ marginTop: compact ? 6 : 0 }}>
      <div className={styles.emotionList}>
        {active.map(({ key, label, color }) => {
          const val = axes[key] || 0;
          const levelLabel = val > 0.7 ? label[2] : val > 0.4 ? label[1] : label[0];
          return (
            <div key={key} className={styles.emotionChip}>
              <span className={styles.emotionName}>{levelLabel}</span>
              <div className={styles.emotionIntensity}>
                <div className={styles.bar} style={{ width: `${Math.round(val * 100)}%`, background: color }} />
              </div>
              <span style={{ fontSize: 11, color: '#999' }}>{Math.round(val * 100)}%</span>
            </div>
          );
        })}
      </div>
      {trigger && !compact && <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>Causa: {trigger}</div>}
    </div>
  );
}
