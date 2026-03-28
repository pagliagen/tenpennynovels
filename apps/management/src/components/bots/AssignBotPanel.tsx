/**
 * AssignBotPanel — 2-step panel per creare e assegnare un Bot AI.
 *
 * Step 1: nome (opzionale) + descrizione + location → [Genera BOT]
 *   La location è scelta subito così l'AI genera il bot coerente con quel luogo.
 *
 * Step 2: review + modifica dati generati → [Aggiorna] / [Conferma]
 *   [Conferma] genera il personaggio completo e lo assegna alla location scelta.
 */

import React, { useState, useEffect } from 'react';
import { botsApi } from '@/lib/api/bots';
import { getLocations } from '@/lib/api/locations';
import styles from '@/styles/components/AssignBotPanel.module.scss';

type Step = 1 | 2 | 3;

interface AssignBotPanelProps {
  onClose: () => void;
  onSuccess?: (characterId: string) => void;
}

interface LocationOption { _id: string; name: string; district?: string; description?: string; }

interface BotData {
  _id?: string;
  name: string;
  gender?: string;
  publicDescription?: string;
  personality?: { traits?: string[]; speech_style?: string; background?: string; coreValues?: string[] };
  systemPrompt?: string;
  narrativeStyle?: { author?: string; guidance?: string };
}

interface BotFormState {
  name: string; publicDescription: string; speechStyle: string; traits: string;
  background: string; narrativeAuthor: string; narrativeGuidance: string; systemPrompt: string;
}

const STEP_LABELS = ['Descrizione & Location', 'Revisione', 'Creazione Personaggio'];

export const AssignBotPanel: React.FC<AssignBotPanelProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<Step>(1);

  // Step 1 fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(true);

  // Step 2 fields
  const [localAiBotId, setLocalAiBotId] = useState('');
  const [rawBot, setRawBot] = useState<BotData | null>(null);
  const [botForm, setBotForm] = useState<BotFormState>({
    name: '', publicDescription: '', speechStyle: '', traits: '',
    background: '', narrativeAuthor: '', narrativeGuidance: '', systemPrompt: '',
  });
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Carica le location disponibili all'avvio
  useEffect(() => {
    (async () => {
      try {
        const res = await getLocations({ pageSize: 200 });
        const all: any[] = res.data?.locations || [];
        const locs = all
          .filter((l: any) => !l.settings?.bot_enabled && l.locationLevel === 'location')
          .map((l: any) => ({
            _id: l.id || l._id,
            name: l.name,
            district: l.district,
            description: l.description || l.settings?.description || '',
          }));
        setLocations(locs);
        if (locs.length > 0) setSelectedLocationId(locs[0]._id);
      } catch {
        setError('Impossibile caricare le location');
      } finally {
        setLocationsLoading(false);
      }
    })();
  }, []);

  const updateField = (field: keyof BotFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setBotForm(prev => ({ ...prev, [field]: e.target.value }));

  const selectedLocation = locations.find(l => l._id === selectedLocationId);

  // ── Step 1: Generate ────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!description.trim()) { setError('Inserisci una descrizione per il bot.'); return; }
    if (!selectedLocationId) { setError('Seleziona una location.'); return; }
    setError('');
    setLoading(true);
    setLoadingMsg('Generazione in corso… (30–60 secondi)');

    try {
      const { localAiBotId: lid, bot } = await botsApi.generate({
        name: name.trim() || undefined,
        description: description.trim(),
        locationId: selectedLocationId,
        locationName: selectedLocation?.name,
        locationDescription: selectedLocation?.description,
      });

      setLocalAiBotId(lid);
      setRawBot(bot as BotData);
      setBotForm({
        name: bot.name || '',
        publicDescription: bot.publicDescription || '',
        speechStyle: bot.personality?.speech_style || '',
        traits: (bot.personality?.traits || []).join(', '),
        background: bot.personality?.background || '',
        narrativeAuthor: bot.narrativeStyle?.author || '',
        narrativeGuidance: bot.narrativeStyle?.guidance || '',
        systemPrompt: bot.systemPrompt || '',
      });
      setStep(2);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Errore durante la generazione');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── Step 2: Refine ──────────────────────────────────────────────────────────
  const handleRefine = async () => {
    setError('');
    setLoading(true);
    setLoadingMsg('Invio modifiche all\'AI e rigenerazione… (30–60 secondi)');
    try {
      const result = await botsApi.refine(localAiBotId, {
        name: botForm.name,
        publicDescription: botForm.publicDescription,
        personality: {
          speech_style: botForm.speechStyle,
          traits: botForm.traits.split(',').map(t => t.trim()).filter(Boolean),
          background: botForm.background,
        },
        systemPrompt: botForm.systemPrompt,
        narrativeStyle: botForm.narrativeAuthor
          ? { author: botForm.narrativeAuthor, guidance: botForm.narrativeGuidance }
          : undefined,
      });
      const updated = result.bot as any;
      if (updated) {
        setBotForm(prev => ({
          ...prev,
          name: updated.name || prev.name,
          publicDescription: updated.publicDescription || prev.publicDescription,
          speechStyle: updated.personality?.speech_style || prev.speechStyle,
          traits: (updated.personality?.traits || []).join(', ') || prev.traits,
          background: updated.personality?.background || prev.background,
          systemPrompt: updated.systemPrompt || prev.systemPrompt,
          narrativeAuthor: updated.narrativeStyle?.author || prev.narrativeAuthor,
          narrativeGuidance: updated.narrativeStyle?.guidance || prev.narrativeGuidance,
        }));
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Errore aggiornamento');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  // ── Step 2 → Step 3: mostra riepilogo prima di creare ───────────────────────
  const handleGoToConfirm = () => {
    setError('');
    setStep(3);
  };

  // ── Step 3: Confirm → genera personaggio e assegna location ─────────────────
  const handleConfirm = async () => {
    setError('');
    setLoading(true);
    setLoadingMsg('Generazione personaggio in corso… (2–5 minuti)');

    try {
      const botData = {
        name: botForm.name,
        gender: rawBot?.gender,
        publicDescription: botForm.publicDescription,
        personality: {
          traits: botForm.traits.split(',').map(t => t.trim()).filter(Boolean),
          speech_style: botForm.speechStyle,
          background: botForm.background,
          coreValues: rawBot?.personality?.coreValues || [],
        },
        systemPrompt: botForm.systemPrompt,
        narrativeStyle: botForm.narrativeAuthor
          ? { author: botForm.narrativeAuthor, guidance: botForm.narrativeGuidance }
          : undefined,
      };

      const { characterId } = await botsApi.confirm(localAiBotId, {
        botData,
        locationId: selectedLocationId,
      });

      setSuccess(`Personaggio creato e assegnato a "${selectedLocation?.name}"!`);
      onSuccess?.(characterId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Errore durante la creazione del personaggio');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleCancelBot = async () => {
    if (localAiBotId) {
      try { await botsApi.cancel(localAiBotId); } catch { /* non bloccare */ }
    }
    onClose();
  };

  return (
    <div className={styles.panel}>
      {/* Steps */}
      <div className={styles.steps}>
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as Step;
          return (
            <div key={s} className={`${styles.step} ${step === s ? styles.active : ''} ${step > s ? styles.done : ''}`}>
              <div className={styles.stepDot}>{step > s ? '✓' : s}</div>
              {label}
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div className={styles.body}>
        {error && <div className={styles.errorBox}>{error}</div>}
        {success && <div className={styles.successBox}>{success}</div>}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span className={styles.loadingMsg}>{loadingMsg || 'Attendere…'}</span>
          </div>
        )}

        {!loading && !success && (
          <>
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <>
                <div className={styles.fieldGroup}>
                  <label htmlFor="botLocation">Location *</label>
                  {locationsLoading
                    ? <span className={styles.helpText}>Caricamento location…</span>
                    : locations.length === 0
                      ? <p className={styles.noLocations}>Nessuna location disponibile senza bot assegnato.</p>
                      : (
                        <select
                          id="botLocation"
                          value={selectedLocationId}
                          onChange={e => setSelectedLocationId(e.target.value)}
                        >
                          {locations.map(l => (
                            <option key={l._id} value={l._id}>
                              {l.district ? `[${l.district}] ` : ''}{l.name}
                            </option>
                          ))}
                        </select>
                      )
                  }
                  {selectedLocation?.description && (
                    <span className={styles.helpText}>{selectedLocation.description}</span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="botName">Nome Bot <span className={styles.optional}>(opzionale)</span></label>
                  <input id="botName" type="text" placeholder="Lascia vuoto per generarlo automaticamente"
                    value={name} onChange={e => setName(e.target.value)} />
                  <span className={styles.helpText}>Se non specificato, l'AI sceglierà un nome coerente con il luogo.</span>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="botDesc">Descrizione *</label>
                  <textarea id="botDesc" rows={5}
                    placeholder="Es. Un anziano taverniere burbero ma di buon cuore, che conosce tutti i segreti del quartiere…"
                    value={description} onChange={e => setDescription(e.target.value)} />
                  <span className={styles.helpText}>Ruolo, carattere, background. L'AI userà anche il nome e la descrizione della location selezionata.</span>
                </div>
              </>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <>
                <div className={styles.reviewRow}>
                  <label>Nome</label>
                  <input type="text" value={botForm.name} onChange={updateField('name')} />
                </div>
                <div className={styles.reviewRow}>
                  <label>Descrizione pubblica</label>
                  <textarea value={botForm.publicDescription} onChange={updateField('publicDescription')} rows={3} />
                </div>
                <div className={styles.reviewRow}>
                  <label>Tono / stile di parlata</label>
                  <textarea value={botForm.speechStyle} onChange={updateField('speechStyle')} rows={3} />
                </div>
                <div className={styles.reviewRow}>
                  <label>Tratti carattere (separati da virgola)</label>
                  <input type="text" value={botForm.traits} onChange={updateField('traits')} />
                </div>
                <div className={styles.reviewRow}>
                  <label>Background</label>
                  <textarea value={botForm.background} onChange={updateField('background')} rows={3} />
                </div>
                <div className={styles.reviewRow}>
                  <label>Scrittore di riferimento</label>
                  <input type="text" value={botForm.narrativeAuthor} onChange={updateField('narrativeAuthor')} placeholder="Es. Charles Dickens" />
                </div>
                <div className={styles.reviewRow}>
                  <label>Guida narrativa</label>
                  <textarea value={botForm.narrativeGuidance} onChange={updateField('narrativeGuidance')} rows={2} />
                </div>
                <button className={styles.systemPromptToggle} type="button"
                  onClick={() => setShowSystemPrompt(v => !v)}>
                  {showSystemPrompt ? '▲ Nascondi System Prompt' : '▼ System Prompt (avanzato)'}
                </button>
                {showSystemPrompt && (
                  <div className={styles.reviewRow}>
                    <label>System Prompt</label>
                    <textarea value={botForm.systemPrompt} onChange={updateField('systemPrompt')} rows={6} />
                  </div>
                )}
              </>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <div className={styles.confirmSummary}>
                <p className={styles.confirmIntro}>
                  Stai per generare il personaggio completo per <strong>{selectedLocation?.name}</strong>.<br />
                  Controlla il riepilogo e premi <em>Crea Personaggio</em> per procedere.
                </p>
                <dl className={styles.summaryList}>
                  <dt>Nome</dt><dd>{botForm.name || '—'}</dd>
                  <dt>Location</dt><dd>{selectedLocation?.name || '—'}</dd>
                  <dt>Descrizione pubblica</dt><dd>{botForm.publicDescription || '—'}</dd>
                  <dt>Tono / stile</dt><dd>{botForm.speechStyle || '—'}</dd>
                  <dt>Tratti</dt><dd>{botForm.traits || '—'}</dd>
                  <dt>Background</dt><dd>{botForm.background || '—'}</dd>
                  {botForm.narrativeAuthor && <><dt>Scrittore rif.</dt><dd>{botForm.narrativeAuthor}</dd></>}
                </dl>
                <p className={styles.confirmHint}>
                  La generazione richiede 2–5 minuti.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!success && (
        <div className={styles.footer}>
          {step === 1 && !loading && (
            <>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={onClose}>Annulla</button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleGenerate}
                disabled={!description.trim() || !selectedLocationId || locationsLoading}
              >
                Genera BOT
              </button>
            </>
          )}
          {step === 2 && !loading && (
            <>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleCancelBot}>Annulla</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep(1)}>← Indietro</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleRefine}>Aggiorna</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleGoToConfirm}>Avanti →</button>
            </>
          )}
          {step === 3 && !loading && (
            <>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleCancelBot}>Annulla</button>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setStep(2)}>← Indietro</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleConfirm}>Crea Personaggio</button>
            </>
          )}
        </div>
      )}
      {success && (
        <div className={styles.footer}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Chiudi</button>
        </div>
      )}
    </div>
  );
};
