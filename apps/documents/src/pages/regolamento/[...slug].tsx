/**
 * Regolamento Document Detail Page (Catch-all)
 *
 * Handles both single and nested paths.
 * Uses Server-Side Rendering (SSR) to support authenticated access to private documents.
 *
 * @module pages/regolamento/[...slug]
 * @since 1.0.0
 */

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';

interface RegolamentoDetailProps {
  data: DocumentDetailType | null;
  error?: string;
}

export default function RegolamentoDetail({ data, error }: RegolamentoDetailProps) {
  const router = useRouter();

  // Handle errors (404, private documents, etc.)
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
        title={`${document.title} - Regolamento`}
        description={document.description || document.title}
        ogType="article"
      />

      <DocumentDetail data={data} />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const slugArray = params?.slug as string[] | undefined;

  if (!slugArray || slugArray.length === 0) {
    return {
      notFound: true,
    };
  }

  // Join array back to path string
  const path = slugArray.join('/');

  try {
    // Fetch document with sections
    // Forward authentication cookies from browser to backend API
    const cookies = req.headers.cookie || '';
    const data = await documentsApi.get('regolamento', path, cookies);

    return {
      props: {
        data,
      },
    };
  } catch (error: any) {
    console.error(`[Regolamento Detail] Error fetching ${path}:`, error);

    // Handle 302 redirect (typo-tolerant fallback)
    if (error?.statusCode === 302 || error?.response?.status === 302) {
      const location =
        error.response?.headers?.location ||
        error.response?.headers?.Location ||
        error.headers?.location ||
        error.headers?.Location;

      if (location) {
        const redirectPath = location.replace('/game/documents', '');
        console.log(`[Regolamento Detail] Redirecting ${path} → ${redirectPath}`);

        return {
          redirect: {
            destination: redirectPath,
            permanent: false,
          },
        };
      }

      if (error.details && typeof error.details === 'string') {
        const match = error.details.match(/Redirecting to (.+)/);
        if (match) {
          const redirectPath = match[1].replace('/game/documents', '');
          console.log(`[Regolamento Detail] Redirecting ${path} → ${redirectPath} (from details)`);

          return {
            redirect: {
              destination: redirectPath,
              permanent: false,
            },
          };
        }
      }
    }

    // Return 404 for not found documents
    if (error?.statusCode === 404 || error?.response?.status === 404) {
      return {
        notFound: true,
      };
    }

    // Return error page for other errors
    return {
      props: {
        data: null,
        error: 'Errore nel caricamento del documento. Riprova più tardi.',
      },
    };
  }
};
