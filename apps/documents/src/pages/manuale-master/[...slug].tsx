/**
 * Dettaglio documento del Manuale Master (catch-all).
 *
 * Client-only, deliberatamente: /ambientazione e /regolamento usano ISR
 * (getStaticProps + revalidate), che è una cache CONDIVISA fra tutti i
 * visitatori — la prima visita di un master materializzerebbe la pagina sul
 * server e da lì verrebbe servita a chiunque. getServerSideProps non è
 * un'alternativa: il permesso dipende dall'header X-Session-Id, che vive in
 * sessionStorage e il server Next non vede.
 *
 * Conseguenze volute: nessuna indicizzazione, nessuna voce in sitemap,
 * nessuno structured data.
 *
 * @module pages/manuale-master/[...slug]
 */

import { useRouter } from 'next/router';

import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { MasterManualGate } from '@/components/documents/MasterManualGate';
import { SEO } from '@/components/SEO';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useDocumentDetail } from '@/hooks/useDocumentDetail';
import styles from '@/styles/components/documents/MainContent.module.scss';

function ManualeMasterContent({ path }: { path: string }): JSX.Element {
  const router = useRouter();
  const { data, isLoading, error } = useDocumentDetail('manuale-master', path);

  if (isLoading) {
    return <LoadingSpinner fullPage message="Caricamento..." />;
  }

  if (error || !data) {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;

    return (
      <ErrorMessage
        fullPage
        title="Ten Penny Novels | Documento non trovato"
        message={
          status === 403
            ? 'Non hai i permessi per consultare questo documento.'
            : 'Il documento richiesto non è disponibile.'
        }
        onRetry={status === 403 ? undefined : () => router.reload()}
      />
    );
  }

  return (
    <div className={styles.mainContainer}>
      <DocumentHeader document={data.document} />
      <DocumentDetail data={data} />
    </div>
  );
}

export default function ManualeMasterDetail(): JSX.Element {
  const router = useRouter();
  const slug = router.query.slug;
  const path = Array.isArray(slug) ? slug.join('/') : '';

  return (
    <>
      <SEO
        title="Manuale Master - Ten Penny Novels"
        description="Documentazione riservata ai master di Ten Penny Novels."
        ogType="website"
        noindex
      />
      <MasterManualGate>
        {/* router.query è vuoto al primo render sulla route dinamica */}
        {path ? <ManualeMasterContent path={path} /> : <LoadingSpinner fullPage message="Caricamento..." />}
      </MasterManualGate>
    </>
  );
}
