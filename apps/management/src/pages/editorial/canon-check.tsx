/**
 * Revisione di canone
 *
 * Rapporto sulle incoerenze del materiale di ambientazione (anni, slug, anacronismi, documenti
 * vuoti, luoghi con descrizioni sottili). Regole deterministiche, nessun modello: non modifica nulla.
 * Visibile solo se il server ha ENABLE_IA_EDITORIAL=true.
 */

import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useCanonCheck } from '@/hooks/api/useEditorial';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import type { CanonFinding, CanonTarget, CanonTargetKind } from '@/types/api/Editorial';
import styles from '@/styles/pages/CanonCheck.module.scss';

const SEVERITY_LABEL: Record<CanonFinding['severity'], string> = {
  error: 'Errore',
  warning: 'Da guardare',
  info: 'Informativo',
};

const OPEN_IN: Record<CanonTargetKind, { href: string; label: string }> = {
  location: { href: '/locations/location-list', label: 'Apri Location' },
  document: { href: '/documents/document-list', label: 'Apri Documenti' },
  subtype: { href: '/documents/subtypes', label: 'Apri Sottotipi' },
};

/** Oltre questa soglia l'elenco dei luoghi coinvolti si apre su richiesta. */
const COLLAPSE_AFTER = 6;

function TargetRow({ target }: { target: CanonTarget }): React.ReactElement {
  return (
    <li className={styles.target}>
      <span className={styles.targetLabel}>{target.label}</span>
      {target.excerpt && <span className={styles.excerpt}>{target.excerpt}</span>}
      <Link href={OPEN_IN[target.kind].href} className={styles.openLink}>{OPEN_IN[target.kind].label}</Link>
    </li>
  );
}

function FindingCard({ finding }: { finding: CanonFinding }): React.ReactElement {
  const list = (
    <ul className={styles.targets}>
      {finding.targets.map((target, i) => <TargetRow key={`${target.id}-${i}`} target={target} />)}
    </ul>
  );
  return (
    <article className={`${styles.finding} ${styles[finding.severity]}`}>
      <header>
        <span className={styles.badge}>{SEVERITY_LABEL[finding.severity]}</span>
        <h2>{finding.title}</h2>
      </header>
      <p className={styles.detail}>{finding.detail}</p>
      {finding.targets.length > COLLAPSE_AFTER ? (
        <details>
          <summary>Mostra le {finding.targets.length} voci</summary>
          {list}
        </details>
      ) : list}
    </article>
  );
}

export default function CanonCheckPage(): React.ReactElement {
  const { editorialAiEnabled, isLoading: flagsLoading } = useFeatureFlagsStore();
  const { data, isFetching, error, refetch } = useCanonCheck(editorialAiEnabled);

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Revisione canone</title>
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1>Revisione canone</h1>
            <p>
              Incoerenze nel materiale di ambientazione.
              {data?.canonYear ? ` Anno del canone: ${data.canonYear} (il più citato nei documenti).` : ''}
            </p>
          </div>
          <button type="button" className={styles.refresh} onClick={() => void refetch()} disabled={!editorialAiEnabled || isFetching}>
            {isFetching ? 'Controllo...' : 'Ricontrolla'}
          </button>
        </header>

        {flagsLoading ? (
          <div className={styles.state}><LoadingSpinner size="medium" /></div>
        ) : !editorialAiEnabled ? (
          <div className={styles.state}>L&apos;AI editoriale non è attiva in questo ambiente.</div>
        ) : error ? (
          <div className={styles.state}>
            <strong>Errore nella revisione.</strong>
            <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          </div>
        ) : !data ? (
          <div className={styles.state}><LoadingSpinner size="medium" /></div>
        ) : (
          <>
            <p className={styles.summary}>
              Controllati {data.stats.documents} documenti, {data.stats.subtypes} sottotipi e {data.stats.locations} location:
              {' '}{data.stats.findings === 0 ? 'nessun rilievo.' : `${data.stats.findings} rilievi.`}
            </p>
            {data.findings.map((finding) => <FindingCard key={finding.code} finding={finding} />)}
          </>
        )}
      </div>
    </ManagementLayout>
  );
}
