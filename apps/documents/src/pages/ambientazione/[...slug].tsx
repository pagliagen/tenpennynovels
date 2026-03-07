/**
 * Ambientazione Document Detail Page (Catch-all)
 *
 * Handles paths like /ambientazione/introduzione/presentazione.
 * Uses Server-Side Rendering (SSR) for authenticated access to private documents.
 *
 * @module pages/ambientazione/[...slug]
 * @since 2.0.0
 */

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import styles from '@/styles/components/documents/MainContent.module.scss';

interface AmbientazioneDetailProps {
  data: DocumentDetailType | null;
  error?: string;
}

export default function AmbientazioneDetail({ data, error }: AmbientazioneDetailProps) {
  const router = useRouter();

  if (error || !data) {
    return (
      <ErrorMessage
        fullPage
        title="Documento non trovato"
        message={error || 'Il documento richiesto non è disponibile o è privato.'}
        onRetry={() => router.reload()}
      />
    );
  }

  const { document } = data;

  return (
    <>
      <SEO
        title={`${document.title} - Ambientazione`}
        description={document.description || document.title}
        ogType="article"
      />

      <div className={styles.mainContainer}>
        <DocumentHeader document={data.document} />
        <DocumentDetail data={data} />
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const slugArray = params?.slug as string[] | undefined;

  if (!slugArray || slugArray.length === 0) {
    return { notFound: true };
  }

  const path = slugArray.join('/');

  try {
    const cookies = req.headers.cookie || '';
    const data = await documentsApi.get('ambientazione', path, cookies);

    return { props: { data } };
  } catch (error: any) {
    console.error(`[Ambientazione Detail] Error fetching ${path}:`, error);

    if (error?.statusCode === 404 || error?.response?.status === 404) {
      return { notFound: true };
    }

    return {
      props: {
        data: null,
        error: 'Errore nel caricamento del documento. Riprova più tardi.',
      },
    };
  }
};
