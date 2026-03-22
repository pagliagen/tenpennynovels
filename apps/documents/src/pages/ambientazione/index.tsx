/**
 * Ambientazione Section Index Page
 *
 * Redirects to the first available leaf document in the sidebar.
 *
 * @module pages/ambientazione/index
 * @since 2.0.0
 */

import { useEffect } from 'react';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { findFirstLeafPath } from '@/lib/findFirstLeafPath';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

type AmbientazioneIndexProps = {
  redirectTo: string | null;
};

export default function AmbientazioneIndex({ redirectTo }: AmbientazioneIndexProps) {
  const router = useRouter();

  useEffect(() => {
    if (redirectTo) {
      void router.replace(redirectTo);
    }
  }, [redirectTo, router]);

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
 * Supplies the first ambientazione leaf path; the page redirects client-side
 * (Next.js 16 disallows `redirect` from getStaticProps during prerender).
 */
export const getStaticProps: GetStaticProps = async () => {
  try {
    const hierarchical = await documentsApi.listHierarchical();
    const subtypes = hierarchical.ambientazione || [];
    const firstPath = findFirstLeafPath(subtypes, 'ambientazione');

    return {
      props: { redirectTo: firstPath ?? null },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('[Indice ambientazione] Errore:', error);
    return {
      props: { redirectTo: null },
      revalidate: 60,
    };
  }
};
