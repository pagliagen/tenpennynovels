/**
 * Preview live del documento per l'iframe nel gestionale.
 *
 * A differenza delle pagine [...slug].tsx (ISR, revalidate: 3600, isDraft/visible
 * hardcoded a false/true su getByPath), questa è SSR pura (sempre fresca) e
 * autorizzata da un token firmato (PreviewTokenService) invece che da sessione:
 * ignora isDraft/visible/isPublic per poter mostrare bozze non pubblicate.
 * Renderizza solo il contenuto ("MAIN"), niente nav/sidebar del sito — vedi
 * _app.tsx che salta DocumentsLayout per le route /preview/*.
 *
 * @module pages/preview/[id]
 */

import { GetServerSideProps } from 'next';
import Head from 'next/head';

import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { documentsApi } from '@/lib/api/documents';
import { logger } from '@/lib/logger';
import styles from '@/styles/components/documents/PreviewEmbed.module.scss';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';

interface PreviewPageProps {
  data: DocumentDetailType | null;
  error?: string;
}

export default function PreviewPage({ data, error }: PreviewPageProps) {
  if (error || !data) {
    return (
      <ErrorMessage
        fullPage
        title="Preview non disponibile"
        message={error || 'Documento non trovato o token scaduto.'}
      />
    );
  }

  return (
    <>
      <Head>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className={styles.container}>
        {data.document.isDraft && (
          <div className={styles.draftBanner}>Bozza — non pubblicata</div>
        )}
        <DocumentDetail data={data} />
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PreviewPageProps> = async ({ params, query }) => {
  const id = params?.id as string | undefined;
  const token = query?.token as string | undefined;

  if (!id || !token) {
    return { props: { data: null, error: 'Parametri mancanti' } };
  }

  try {
    const data = await documentsApi.getPreview(id, token);
    return { props: { data } };
  } catch (error: any) {
    logger.error('[Preview documento] Errore caricamento', { id, error });

    const status = error?.statusCode || error?.response?.status;
    if (status === 403) {
      return { props: { data: null, error: 'Token di preview non valido o scaduto' } };
    }
    if (status === 404) {
      return { props: { data: null, error: 'Documento non trovato' } };
    }

    return { props: { data: null, error: 'Errore nel caricamento della preview' } };
  }
};
