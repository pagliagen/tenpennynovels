/**
 * Home Page
 *
 * Server-side redirect straight to the first leaf document (same target
 * /ambientazione/index.tsx resolves to), skipping that intermediate hop.
 * Google Search Console flagged the previous "/" -> "/ambientazione" ->
 * "/ambientazione/<first-leaf>" chain as a redirect error; a single 307
 * hop is the fix, not a status-code change (the target is data-dependent,
 * so it can't be a permanent redirect).
 *
 * @module pages/index
 * @since 1.0.0
 */

import { GetServerSideProps } from 'next';
import { SEO } from '@/components/SEO';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { documentsApi } from '@/lib/api/documents';
import { findFirstLeafPath } from '@/lib/findFirstLeafPath';

export default function HomePage() {
  // Never rendered: getServerSideProps always redirects.
  return (
    <>
      <SEO
        title="Ten Penny Novels | Archivi"
        description="Archivi di ambientazione e regolamento di Ten Penny Novels. Esplora la Londra Vittoriana del 1890 e le regole del gioco."
        ogType="website"
        noindex
      />
      <LoadingSpinner fullPage message="Reindirizzamento..." />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  try {
    const hierarchical = await documentsApi.listHierarchical();
    const subtypes = hierarchical.ambientazione || [];
    const firstPath = findFirstLeafPath(subtypes, 'ambientazione');

    return {
      redirect: {
        destination: firstPath || '/ambientazione',
        permanent: false,
      },
    };
  } catch {
    // API unreachable: fall back to the section index, which has its own
    // fallback (renders a loading page instead of erroring) if it's down too.
    return {
      redirect: {
        destination: '/ambientazione',
        permanent: false,
      },
    };
  }
};
