import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';
import { DocumentHeader } from '@/components/documents/DocumentHeader';
import styles from '@/styles/components/documents/MainContent.module.scss';

interface PreferitiDetailProps {
  data: DocumentDetailType | null;
  error?: string;
}

export default function PreferitiDetail({ data, error }: PreferitiDetailProps) {
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

  return (
    <>
      <SEO
        title={`Ten Penny Novels | Preferiti | ${document.title}`}
        description={document.description || `Leggi ${document.title} su Ten Penny Novels.`}
        canonical={`https://documenti.tenpennynovels.com/${document.type}/${document.path}`}
        ogType="article"
        noindex={true}
        nofollow={true}
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

  if (!slugArray || slugArray.length < 2) {
    return { notFound: true };
  }

  const type = slugArray[0];
  const path = slugArray.slice(1).join('/');

  if (type !== 'ambientazione' && type !== 'regolamento') {
    return { notFound: true };
  }

  try {
    const cookies = req.headers.cookie || '';
    const data = await documentsApi.get(type, path, cookies);

    return { props: { data } };
  } catch (error: any) {
    console.error(`[Dettaglio preferiti] Errore caricamento ${type}/${path}:`, error);

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
