/**
 * Home Page
 *
 * Server-side redirect to /ambientazione (default landing section).
 * A server redirect (307) lets crawlers follow through to the content,
 * unlike the previous client-side redirect that required noindex/nofollow.
 *
 * @module pages/index
 * @since 1.0.0
 */

import { GetServerSideProps } from 'next';
import { SEO } from '@/components/SEO';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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
  return {
    redirect: {
      destination: '/ambientazione',
      permanent: false,
    },
  };
};
