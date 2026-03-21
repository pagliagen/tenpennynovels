/**
 * Ambientazione Section Index Page
 *
 * Redirects to the first available leaf document in the sidebar.
 *
 * @module pages/ambientazione/index
 * @since 2.0.0
 */

import { GetStaticProps } from 'next';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { findFirstLeafPath } from '@/lib/findFirstLeafPath';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AmbientazioneIndex() {
  return (
    <>
      <SEO
        title="Ten Penny Novels | Ambientazione"
        description="Documenti di ambientazione per Ten Penny Novels - Londra vittoriana, personaggi, luoghi e storie."
        ogType="website"
      />
      <LoadingSpinner fullPage message="Caricamento..." />
    </>
  );
}

/**
 * Static Props Generation (ISR)
 *
 * Redirects to first available ambientazione document.
 * Revalidates every hour to reflect document structure changes.
 */
export const getStaticProps: GetStaticProps = async () => {
  try {
    const hierarchical = await documentsApi.listHierarchical();
    const subtypes = hierarchical.ambientazione || [];
    const firstPath = findFirstLeafPath(subtypes, 'ambientazione');

    if (firstPath) {
      return {
        redirect: { destination: firstPath, permanent: false },
      };
    }

    return {
      props: {},
      revalidate: 3600  // Revalidate redirect every 1 hour
    };
  } catch (error) {
    console.error('[Ambientazione Index] Error:', error);
    return {
      props: {},
      revalidate: 60  // Retry on error after 1 minute
    };
  }
};
