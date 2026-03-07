/**
 * Ambientazione Section Index Page
 *
 * Redirects to the first available leaf document in the sidebar.
 *
 * @module pages/ambientazione/index
 * @since 2.0.0
 */

import { GetServerSideProps } from 'next';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { findFirstLeafPath } from '@/lib/findFirstLeafPath';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AmbientazioneIndex() {
  return (
    <>
      <SEO
        title="Ambientazione"
        description="Documenti di ambientazione per Ten Penny Novels - Londra vittoriana, personaggi, luoghi e storie."
        ogType="website"
      />
      <LoadingSpinner fullPage message="Caricamento..." />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const hierarchical = await documentsApi.listHierarchical();
    const subtypes = hierarchical.ambientazione || [];
    const firstPath = findFirstLeafPath(subtypes, 'ambientazione');

    if (firstPath) {
      return {
        redirect: { destination: firstPath, permanent: false },
      };
    }

    return { props: {} };
  } catch (error) {
    console.error('[Ambientazione Index] Error:', error);
    return { props: {} };
  }
};
