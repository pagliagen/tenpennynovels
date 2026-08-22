/**
 * Manuale Master — indice di sezione.
 *
 * Client-only, a differenza di /ambientazione e /regolamento che usano
 * getServerSideProps: il permesso di lettura dipende dal personaggio, e il
 * personaggio è identificato dall'header X-Session-Id che vive in
 * sessionStorage (per-tab). Il server Next non lo vede, quindi una redirect
 * SSR non saprebbe mai quali documenti esistono.
 *
 * @module pages/manuale-master/index
 */

import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { MasterManualGate } from '@/components/documents/MasterManualGate';
import { SEO } from '@/components/SEO';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useDocumentTree } from '@/hooks/useDocumentTree';
import { findFirstLeafPath } from '@/lib/findFirstLeafPath';

function ManualeMasterRedirect(): JSX.Element {
  const router = useRouter();
  const { data: documentsByType, isLoading } = useDocumentTree();

  const subtypes = documentsByType?.['manuale-master'] ?? [];
  const firstPath = findFirstLeafPath(subtypes, 'manuale-master');

  useEffect(() => {
    if (firstPath) {
      void router.replace(firstPath);
    }
  }, [firstPath, router]);

  if (isLoading || firstPath) {
    return <LoadingSpinner fullPage message="Caricamento..." />;
  }

  return (
    <ErrorMessage
      fullPage
      title="Ten Penny Novels | Manuale Master"
      message="Il manuale master non contiene ancora documenti."
    />
  );
}

export default function ManualeMasterIndex(): JSX.Element {
  return (
    <>
      <SEO
        title="Ten Penny Novels | Manuale Master"
        description="Documentazione riservata ai master di Ten Penny Novels."
        ogType="website"
        noindex
      />
      <MasterManualGate>
        <ManualeMasterRedirect />
      </MasterManualGate>
    </>
  );
}
