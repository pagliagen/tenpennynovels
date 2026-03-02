/**
 * Approfondimenti Document Detail Page (Catch-all)
 *
 * Handles both single and nested paths (e.g., /approfondimenti/medicina, /approfondimenti/medicina/chirurgia).
 * Uses Server-Side Rendering (SSR) to support authenticated access to private documents.
 *
 * @module pages/approfondimenti/[...slug]
 * @since 1.0.0
 */

import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { DocumentDetail } from '@/components/documents/DocumentDetail';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';

interface ApprofondimentiDetailProps {
  data: DocumentDetailType | null;
  error?: string;
}

export default function ApprofondimentiDetail({ data, error }: ApprofondimentiDetailProps) {
  const router = useRouter();

  // Handle errors (404, private documents, etc.)
  if (error || !data) {
    return (
      <ErrorMessage
        fullPage
        title="Approfondimento non trovato"
        message={error || 'L\'approfondimento richiesto non è disponibile o è privato.'}
        onRetry={() => router.reload()}
      />
    );
  }

  const { document } = data;

  return (
    <>
      <SEO
        title={`${document.title} - Approfondimenti`}
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
  // e.g., ["medicina", "chirurgia"] → "medicina/chirurgia"
  const path = slugArray.join('/');

  try {
    // Fetch document with sections
    // Forward authentication cookies from browser to backend API
    const cookies = req.headers.cookie || '';
    const data = await documentsApi.get('approfondimenti', path, cookies);

    return {
      props: {
        data,
      },
    };
  } catch (error: any) {
    console.error(`[Approfondimenti Detail] Error fetching ${path}:`, error);

    // Handle 302 redirect (typo-tolerant fallback or explicit redirect routes)
    if (error?.statusCode === 302 || error?.response?.status === 302) {
      // Try to extract location from different possible sources
      const location =
        error.response?.headers?.location ||
        error.response?.headers?.Location ||
        error.headers?.location ||
        error.headers?.Location;

      if (location) {
        // Extract path from location (e.g., "/game/documents/approfondimenti/medicina" → "/approfondimenti/medicina")
        const redirectPath = location.replace('/game/documents', '');
        console.log(`[Approfondimenti Detail] Redirecting ${path} → ${redirectPath}`);

        return {
          redirect: {
            destination: redirectPath,
            permanent: false, // 302 temporary redirect for SEO
          },
        };
      }

      // Fallback: try to parse from details string
      if (error.details && typeof error.details === 'string') {
        const match = error.details.match(/Redirecting to (.+)/);
        if (match) {
          const redirectPath = match[1].replace('/game/documents', '');
          console.log(`[Approfondimenti Detail] Redirecting ${path} → ${redirectPath} (from details)`);

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
        error: 'Errore nel caricamento dell\'approfondimento. Riprova più tardi.',
      },
    };
  }
};
