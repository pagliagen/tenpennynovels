/**
 * GenerateBotModal - genera un bot in tre passi: richiesta (location + descrizione), attesa (SSE) e revisione.
 *
 * L'AI propone una scheda completa (personaggio, persona, psicologia); la persona la corregge e solo con «Crea bot» nasce
 * il personaggio, la scheda e il mapping. La psicologia (numeri) è in sola lettura: si rigenera, non si ritocca a mano.
 * Relazioni e atteggiamenti verso personaggi precisi non si generano da qui: restano autorati nel file della scheda.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { designBot } from '@/lib/api/bots';
import { useLocations } from '@/hooks/api/useLocations';
import { useCreateBot } from '@/hooks/api/useBots';
import { useNotificationStore } from '@/store/notificationStore';
import type { BotDesignResult, BotDraft, BotRow } from '@/types/api/Bot';
import styles from '@/styles/components/CreateLocationModal.module.scss';

/** Come il backend (`MIN_DESCRIPTION_CHARS`): senza una frase non c'è da dove partire. */
export const MIN_BRIEF_CHARS = 20;

const CHECK_LABELS: Record<string, string> = {
  schema: 'Forma della scheda',
  'persona-length': 'Lunghezza della persona',
  lengths: 'Lunghezze',
  'second-person': 'Persona in seconda persona',
  'third-person': 'Descrizioni in terza persona',
  years: 'Anni nel testo',
  'unknown-name': 'Nomi propri',
  'name-unique': 'Nome già usato da un bot',
  'name-in-game': 'Nome già nel gioco',
  'name-consistent': 'Nome e cognome',
  age: 'Età',
  'foreign-words': 'Parole straniere',
  anachronism: 'Anacronismi',
};

type Step = 'brief' | 'working' | 'review';

interface Props {
  existingBots: BotRow[];
  onClose: () => void;
}

export function GenerateBotModal({ existingBots, onClose }: Props): React.ReactElement {
  const addNotification = useNotificationStore((s) => s.addNotification);
  const create = useCreateBot();
  const { data: locationsData } = useLocations({ locationLevel: 'location', showHidden: true, pageSize: 200 });

  const [step, setStep] = useState<Step>('brief');
  const [locationId, setLocationId] = useState('');
  const [brief, setBrief] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BotDesignResult | null>(null);
  const [draft, setDraft] = useState<BotDraft | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Una location ha un solo bot: si propongono solo quelle libere.
  const freeLocations = useMemo(() => {
    const taken = new Set(existingBots.map((b) => b.locationId));
    return (locationsData?.data?.locations ?? []).filter((l) => !taken.has(l.id));
  }, [locationsData, existingBots]);
  const locationName = freeLocations.find((l) => l.id === locationId)?.name ?? '';

  useEffect(() => () => abortRef.current?.abort(), []);

  const canGenerate = locationId !== '' && brief.trim().length >= MIN_BRIEF_CHARS;

  const generate = async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setElapsed(0);
    setStep('working');
    try {
      const out = await designBot({ locationId, description: brief.trim() }, { signal: controller.signal, onProgress: setElapsed });
      setResult(out);
      setDraft(out.draft);
      setStep('review');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Generazione non riuscita');
      setStep('brief');
    }
  };

  const cancelWorking = (): void => {
    abortRef.current?.abort();
    setStep('brief');
  };

  const setCharacter = (field: 'firstName' | 'surname' | 'physicalDescription' | 'publicDescription' | 'visibleMarks', value: string): void => {
    setDraft((d) => {
      if (!d) return d;
      const character = { ...d.character, [field]: value };
      // Il nome completo segue nome e cognome: il personaggio nel game si chiama così.
      if (field === 'firstName' || field === 'surname') character.name = `${character.firstName} ${character.surname}`.trim();
      return { ...d, character };
    });
  };

  const submit = async (): Promise<void> => {
    if (!draft) return;
    try {
      const created = await create.mutateAsync({ locationId, draft, locationName });
      addNotification({
        type: created.reloaded ? 'success' : 'warning',
        message: created.reloaded ? `Bot «${draft.character.name}» creato in ${locationName}` : `Bot «${draft.character.name}» creato, ma bot-service non si è ricaricato: riavvialo`,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione non riuscita');
    }
  };

  const failed = result?.checks.filter((c) => !c.ok) ?? [];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Genera bot"
      size="large"
      footer={
        <div className={styles.aiActions}>
          {step === 'brief' && (
            <>
              <button type="button" onClick={onClose}>Annulla</button>
              <button type="button" onClick={generate} disabled={!canGenerate}>✨ Genera</button>
            </>
          )}
          {step === 'working' && <button type="button" onClick={cancelWorking}>Annulla</button>}
          {step === 'review' && (
            <>
              <button type="button" onClick={onClose}>Annulla</button>
              <button type="button" onClick={generate}>Rigenera</button>
              <button type="button" onClick={submit} disabled={!draft || create.isPending}>
                {create.isPending ? 'Creo…' : 'Crea bot'}
              </button>
            </>
          )}
        </div>
      }
    >
      {error && <p className={styles.aiError} role="alert">{error}</p>}

      {step === 'brief' && (
        <>
          <FormField
            label="Location"
            name="bot-location"
            type="select"
            value={locationId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLocationId(e.target.value)}
            options={[{ value: '', label: freeLocations.length ? 'Scegli una location…' : 'Nessuna location libera' }, ...freeLocations.map((l) => ({ value: l.id, label: l.name }))]}
          />
          <FormField
            label="Chi è il bot"
            name="bot-brief"
            type="textarea"
            value={brief}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBrief(e.target.value)}
            placeholder="Es.: una cameriera sbrigativa, vedova, che sa tutto del quartiere"
            helpText="Ruolo, età di massima e carattere. L'AI parte da qui e non contraddice quello che scrivi."
          />
          {brief.trim().length > 0 && brief.trim().length < MIN_BRIEF_CHARS && (
            <p className={styles.aiNote}>Scrivi almeno una frase ({MIN_BRIEF_CHARS} caratteri).</p>
          )}
        </>
      )}

      {step === 'working' && (
        <p className={styles.aiNote} role="status">
          Sto scrivendo la scheda… {Math.round(elapsed / 1000)} s (di solito 15-60 s; non chiudere la finestra).
        </p>
      )}

      {step === 'review' && (
        <>
          {!draft && <p className={styles.aiError} role="alert">Il modello non ha prodotto una scheda leggibile. Riprova o riscrivi la richiesta.</p>}
          {failed.length > 0 && (
            <ul className={styles.aiChecks}>
              {failed.map((c) => (
                <li key={c.code} className={styles.aiCheckWarn}>⚠ {CHECK_LABELS[c.code] ?? c.code}{c.detail ? `: ${c.detail}` : ''}</li>
              ))}
            </ul>
          )}
          {draft && (
            <>
              <p className={styles.aiNote}>Rileggi e correggi: nulla esiste finché non premi «Crea bot». Generato in {Math.round((result?.ms ?? 0) / 1000)} s ({result?.attempts === 1 ? '1 tentativo' : `${result?.attempts} tentativi`}).</p>
              <FormField label="Nome" name="bot-first" value={draft.character.firstName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharacter('firstName', e.target.value)} />
              <FormField label="Cognome" name="bot-surname" value={draft.character.surname} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharacter('surname', e.target.value)} />
              <FormField
                label="Persona (come il bot si comporta)"
                name="bot-persona"
                type="textarea"
                value={draft.persona}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, persona: e.target.value })}
              />
              <FormField label="Descrizione fisica" name="bot-physical" type="textarea" value={draft.character.physicalDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharacter('physicalDescription', e.target.value)} />
              <FormField label="Descrizione pubblica (ciò che vede uno sconosciuto)" name="bot-public" type="textarea" value={draft.character.publicDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCharacter('publicDescription', e.target.value)} />
              <FormField label="Segni particolari" name="bot-marks" value={draft.character.visibleMarks} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharacter('visibleMarks', e.target.value)} />
              <p className={styles.aiNote}>
                {draft.character.gender === 'female' ? 'Donna' : 'Uomo'}, {draft.character.age} anni (ne dimostra {draft.character.apparentAge}), {draft.character.height}, occhi {draft.character.eyeColor}, capelli {draft.character.hairColor}.
              </p>
              <p className={styles.aiNote}>
                Psicologia (sola lettura): Big Five O{draft.psyche.ocean.O} C{draft.psyche.ocean.C} E{draft.psyche.ocean.E} A{draft.psyche.ocean.A} N{draft.psyche.ocean.N};
                Enneagramma {draft.psyche.enneagram.type}; umore di base P{draft.psyche.pad.p} A{draft.psyche.pad.a} D{draft.psyche.pad.d}.
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
