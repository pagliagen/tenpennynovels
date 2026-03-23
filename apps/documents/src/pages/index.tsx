/**
 * Home Page
 *
 * Redirects to /ambientazione as default landing page.
 *
 * @module pages/index
 * @since 1.0.0
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/ambientazione');
  }, [router]);

  return (
    <>
      <SEO
        title="Ten Penny Novels | Archivi"
        description="Archivi di ambientazione e regolamento di Ten Penny Novels. Esplora la Londra Vittoriana del 1890 e le regole del gioco."
        ogType="website"
        noindex
        nofollow
      />
      <LoadingSpinner fullPage message="Reindirizzamento..." />
    </>
  );
}
