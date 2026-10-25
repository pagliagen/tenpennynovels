/**
 * PositionsAiSuggest - «Genera posizioni»: fino a 3 punti dove stare dentro il luogo.
 *
 * Non salva nulla: la bozza si applica al form (aggiungendo o sostituendo) e la persona la rilegge e salva.
 * Il testo viene dal form, quindi funziona anche mentre si crea la location.
 */

import React from 'react';
import { useSuggestLocationPositions } from '@/hooks/api/useEditorial';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import { hasEnoughText } from '@/components/locations/LocationAiSuggest';
import type { LocationPosition } from '@/types/api/Location';
import styles from '@/styles/components/CreateLocationModal.module.scss';

export interface PositionsContext {
  name: string;
  description: string;
  tags: string[];
}

interface Props {
  context: PositionsContext;
  positions: LocationPosition[];
  onChange: (positions: LocationPosition[]) => void;
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

export function PositionsAiSuggest({ context, positions, onChange }: Props): React.ReactElement | null {
  const enabled = useFeatureFlagsStore((s) => s.editorialAiEnabled);
  const mutation = useSuggestLocationPositions();
  const [applied, setApplied] = React.useState(false);

  if (!enabled) return null;

  // Come il backend: serve il tipo di luogo (un tag) o un minimo di descrizione, altrimenti il modello inventa.
  const canRun = context.name.trim() !== '' && (context.tags.length > 0 || hasEnoughText(context.description));
  const run = (): void => {
    setApplied(false);
    mutation.mutate({
      name: context.name.trim(),
      description: context.description,
      tags: context.tags,
      existing: positions.map((p) => p.name).filter((n) => n.trim() !== ''),
    });
  };
  const discard = (): void => {
    setApplied(false);
    mutation.reset();
  };
  const apply = (mode: 'add' | 'replace'): void => {
    const proposed = (mutation.data?.positions ?? []).map((p) => ({ name: p.name, image: '', description: p.description }));
    if (mode === 'replace') onChange(proposed);
    else onChange([...positions, ...proposed.filter((p) => !positions.some((x) => sameName(x.name, p.name)))]);
    setApplied(true);
  };

  const data = mutation.data;
  return (
    <div className={styles.aiBox}>
      <button type="button" className={styles.aiButton} onClick={run} disabled={mutation.isPending || !canRun}>
        {mutation.isPending ? 'Sto scrivendo… (fino a un minuto)' : '✨ Genera posizioni (max 3)'}
      </button>
      {!canRun && (
        <p className={styles.aiNote}>Scrivi il nome e la descrizione (o scegli almeno un tag): l&apos;AI ricava le posizioni dal tipo di luogo.</p>
      )}

      {mutation.isError && (
        <p className={styles.aiError} role="alert">
          {mutation.error instanceof Error ? mutation.error.message : 'Il servizio AI non è disponibile.'}
        </p>
      )}

      {applied && <p className={styles.aiNote}>Inserite nel modulo: rileggile, modificale e salva. Nulla è stato salvato.</p>}

      {data && !applied && (
        <div className={styles.aiResult}>
          {data.positions.length === 0 ? (
            <p className={styles.aiNote}>Il modello non ha proposto posizioni utilizzabili.</p>
          ) : (
            <ul className={styles.aiChecks}>
              {data.positions.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong> — {p.description}
                </li>
              ))}
            </ul>
          )}
          <ul className={styles.aiChecks}>
            {data.checks.filter((c) => !c.ok).map((c) => (
              <li key={c.code} className={styles.aiCheckWarn}>⚠ {c.detail ?? c.code}</li>
            ))}
          </ul>
          <div className={styles.aiActions}>
            {data.positions.length > 0 && (
              <>
                <button type="button" onClick={() => apply('replace')}>Sostituisci le attuali</button>
                <button type="button" onClick={() => apply('add')}>Aggiungi alle attuali</button>
              </>
            )}
            <button type="button" onClick={run}>Riprova</button>
            <button type="button" onClick={discard}>Scarta</button>
          </div>
        </div>
      )}
    </div>
  );
}
