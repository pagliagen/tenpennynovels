/**
 * LocationAiSuggest - suggerimento AI di descrizione o tag per una location.
 *
 * Compare solo se l'AI editoriale è attiva (flag del server + gateway raggiungibile). Non salva
 * mai: la bozza si riempie nel form con «Usa» e la persona la rilegge, la modifica e salva come
 * sempre. I controlli sotto la bozza dicono cosa non torna (anni, anacronismi, nomi inventati,
 * fatti persi): non bloccano, informano.
 */

import React from 'react';
import { useSuggestLocationDescription, useSuggestLocationTags } from '@/hooks/api/useEditorial';
import { useLocationTags } from '@/hooks/api/useLocations';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import type { DraftCheck } from '@/types/api/Editorial';
import styles from '@/styles/components/CreateLocationModal.module.scss';

const CHECK_LABELS: Record<DraftCheck['code'], string> = {
  length: 'Lunghezza',
  year: 'Anni',
  anachronism: 'Anacronismi',
  'foreign-words': 'Parole straniere',
  'unknown-name': 'Nomi propri',
  'lost-facts': 'Fatti della descrizione attuale',
  'game-meta': 'Testo di gioco',
};

type Props =
  | { kind: 'description'; locationId: string; onApplyDescription: (text: string) => void }
  | { kind: 'tags'; locationId: string; onApplyTags: (tags: string[]) => void };

export function LocationAiSuggest(props: Props): React.ReactElement | null {
  const editorialAiEnabled = useFeatureFlagsStore((s) => s.editorialAiEnabled);
  const descriptionMutation = useSuggestLocationDescription();
  const tagsMutation = useSuggestLocationTags();
  const { data: tagOptions } = useLocationTags();
  const [applied, setApplied] = React.useState(false);

  if (!editorialAiEnabled) return null;

  const isDescription = props.kind === 'description';
  const mutation = isDescription ? descriptionMutation : tagsMutation;
  const run = (): void => {
    setApplied(false);
    mutation.mutate(props.locationId);
  };
  const discard = (): void => {
    setApplied(false);
    mutation.reset();
  };

  const labelOf = (tag: string): string => tagOptions?.find((o) => o.tag === tag)?.label ?? tag;

  return (
    <div className={styles.aiBox}>
      <button type="button" className={styles.aiButton} onClick={run} disabled={mutation.isPending}>
        {mutation.isPending ? 'Sto scrivendo… (fino a un minuto)' : isDescription ? '✨ Suggerisci descrizione' : '✨ Suggerisci tag'}
      </button>

      {mutation.isError && (
        <p className={styles.aiError} role="alert">
          {mutation.error instanceof Error ? mutation.error.message : 'Il servizio AI non è disponibile.'}
        </p>
      )}

      {applied && <p className={styles.aiNote}>Inserita nel modulo: rileggila, modificala e salva. Nulla è stato salvato.</p>}

      {isDescription && descriptionMutation.data && !applied && (
        <div className={styles.aiResult}>
          <p className={styles.aiDraft}>{descriptionMutation.data.draft}</p>
          <ul className={styles.aiChecks}>
            {descriptionMutation.data.checks.map((c) => (
              <li key={c.code} className={c.ok ? styles.aiCheckOk : styles.aiCheckWarn}>
                {c.ok ? '✓' : '⚠'} {CHECK_LABELS[c.code]}{c.detail ? `: ${c.detail}` : ''}
              </li>
            ))}
          </ul>
          {descriptionMutation.data.sources.length > 0 && (
            <p className={styles.aiNote}>Ancorata a: {descriptionMutation.data.sources.join(', ')}.</p>
          )}
          <div className={styles.aiActions}>
            <button
              type="button"
              onClick={() => {
                if (props.kind === 'description') props.onApplyDescription(descriptionMutation.data!.draft);
                setApplied(true);
              }}
            >
              Usa questa bozza
            </button>
            <button type="button" onClick={run}>Riprova</button>
            <button type="button" onClick={discard}>Scarta</button>
          </div>
        </div>
      )}

      {!isDescription && tagsMutation.data && !applied && (
        <div className={styles.aiResult}>
          {tagsMutation.data.tags.length === 0 ? (
            <p className={styles.aiNote}>Il modello non ha proposto nessun tag del registro.</p>
          ) : (
            <p className={styles.aiDraft}>{tagsMutation.data.tags.map(labelOf).join(' · ')}</p>
          )}
          <div className={styles.aiActions}>
            {tagsMutation.data.tags.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (props.kind === 'tags') props.onApplyTags(tagsMutation.data!.tags);
                  setApplied(true);
                }}
              >
                Applica questi tag
              </button>
            )}
            <button type="button" onClick={run}>Riprova</button>
            <button type="button" onClick={discard}>Scarta</button>
          </div>
        </div>
      )}
    </div>
  );
}
