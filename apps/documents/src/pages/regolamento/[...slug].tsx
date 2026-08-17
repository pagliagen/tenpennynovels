/**
 * Dettaglio documento regolamento (catch-all).
 *
 * Esempio: /regolamento/regole-base/combattimento.
 * ISR (getStaticProps): come per ambientazione, senza cookie in fase di generazione.
 *
 * @module pages/regolamento/[...slug]
 * @since 2.0.0
 */

import { GetStaticPaths, GetStaticProps } from 'next';
import { useRouter } from 'next/router';

import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import { SEO } from '@/components/SEO';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { API_CONFIG } from '@/constants/config';
import { documentsApi } from '@/lib/api/documents';
import { logger } from '@/lib/logger';
import styles from '@/styles/components/documents/MainContent.module.scss';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';
import { createArticleSchema, createDocumentBreadcrumbSchema } from '@/utils/schemas';

interface RegolamentoDetailProps {
  data: DocumentDetailType | null;
  error?: string;
}

export default function RegolamentoDetail({ data, error }: RegolamentoDetailProps) {
  const router = useRouter();

  if (error || !data) {
    return (
      <ErrorMessage
        fullPage
        title="Ten Penny Novels | Documento non trovato"
        message={error || 'Il documento richiesto non è disponibile o è privato.'}
        onRetry={() => router.reload()}
      />
    );
  }

  const { document } = data;

  // Generate structured data schemas for SEO
  const pathSegments = document.path.split('/');
  const pathTitles = pathSegments.map((segment, idx) => {
    // Use document title for last segment, capitalize others
    if (idx === pathSegments.length - 1) return document.title;
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
  });

  const schemas = [
    createArticleSchema({
      title: document.title,
      description: document.description || `Regole su ${document.title} - Sistema di gioco Ten Penny Novels`,
      type: document.type,
      path: document.path,
      createdAt: document.createdAt ? new Date(document.createdAt) : new Date(),
      lastUpdated: document.lastUpdated ? new Date(document.lastUpdated) : undefined,
      content: document.content
    }),
    createDocumentBreadcrumbSchema(document.type, pathSegments, pathTitles)
  ];

  const canonical = `https://documenti.tenpennynovels.com/${document.type}/${document.path}`;

  return (
    <>
      <SEO
        title={`${document.title} - Ten Penny Novels`}
        description={document.description || `Regole su ${document.title} - Sistema di gioco Ten Penny Novels`}
        canonical={canonical}
        ogType="article"
        articlePublishedTime={document.createdAt ? new Date(document.createdAt).toISOString() : undefined}
        articleModifiedTime={document.lastUpdated ? new Date(document.lastUpdated).toISOString() : undefined}
        schema={schemas}
      />

      <div className={styles.mainContainer}>
        <DocumentHeader document={data.document} />
        <DocumentDetail data={data} />
      </div>
    </>
  );
}

/**
 * Static Path Generation (ISR)
 *
 * Pre-generates all public regolamento document paths at build time.
 * Uses fallback: 'blocking' for new documents added after build.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}/documents/routes/list?type=regolamento&all=true`
    );
    const result = await response.json();

    if (!result.success || !result.data) {
      logger.warn('[getStaticPaths] Impossibile recuperare le route regolamento');
      return { paths: [], fallback: 'blocking' };
    }

    const paths = result.data.map((doc: { path: string }) => ({
      params: { slug: doc.path.split('/') }
    }));

    return {
      paths,
      fallback: 'blocking'  // ISR on-demand for new documents
    };
  } catch (error) {
    logger.error('[getStaticPaths] Errore', { error });
    return { paths: [], fallback: 'blocking' };
  }
};

/**
 * Static Props Generation (ISR)
 *
 * Fetches document data at build time and revalidates every hour.
 * Public documents only (no authentication required).
 */
export const getStaticProps: GetStaticProps<RegolamentoDetailProps> = async ({ params }) => {
  const slugArray = params?.slug as string[] | undefined;

  if (!slugArray || slugArray.length === 0) {
    return { notFound: true };
  }

  const path = slugArray.join('/');

  try {
    const data = await documentsApi.get('regolamento', path);

    return {
      props: { data },
      revalidate: 3600  // Regenerate every 1 hour if requested
    };
  } catch (error: any) {
    logger.error('[Dettaglio regolamento] Errore caricamento', { path, error });

    if (error?.statusCode === 404 || error?.response?.status === 404) {
      return { notFound: true };
    }

    return {
      props: {
        data: null,
        error: 'Errore nel caricamento del documento. Riprova più tardi.',
      },
      revalidate: 60  // Retry failed fetches after 1 minute
    };
  }
};
