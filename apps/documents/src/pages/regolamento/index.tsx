/**
 * Regolamento Section Index Page
 *
 * Server-side redirect (307) to the first available leaf document.
 * SSR redirect lets crawlers follow through to the content; the previous
 * ISR + client-side redirect forced noindex/nofollow on this entry point.
 * (Next.js 16 disallows `redirect` from getStaticProps during prerender,
 * hence getServerSideProps.)
 *
 * @module pages/regolamento/index
 * @since 2.0.0
 */

import { GetServerSideProps } from 'next';
import { SEO } from '@/components/SEO';
import { documentsApi } from '@/lib/api/documents';
import { findFirstLeafPath } from '@/lib/findFirstLeafPath';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function RegolamentoIndex() {
  // Rendered only when no leaf document exists (API empty or unreachable).
  return (
    <>
      <SEO
        title="Ten Penny Novels | Regolamento"
        description="Regolamento di gioco per Ten Penny Novels - Regole Call of Cthulhu, meccaniche e linee guida per il roleplay vittoriano."
        ogType="website"
        noindex
      />
      <LoadingSpinner fullPage message="Caricamento..." />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const hierarchical = await documentsApi.listHierarchical();
    const subtypes = hierarchical.regolamento || [];
    const firstPath = findFirstLeafPath(subtypes, 'regolamento');

    if (firstPath) {
      return {
        redirect: {
          destination: firstPath,
          permanent: false,
        },
      };
    }

    return { props: {} };
  } catch {
    // API unreachable: render fallback page instead of erroring
    return { props: {} };
  }
};
