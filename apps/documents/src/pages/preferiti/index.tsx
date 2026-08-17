'use client';

import { useRouter } from 'next/router';
import { useEffect } from 'react';

import { SEO } from '@/components/SEO';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/pages/PreferitiIndex.module.scss';

export default function PreferitiIndex() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: favorites, isLoading } = useFavorites(isAuthenticated);

  useEffect(() => {
    if (isLoading || !favorites) return;

    const first = favorites[0];
    if (first) {
      router.replace(`/preferiti/${first.document.type}/${first.document.path}`);
    }
  }, [favorites, isLoading, router]);

  if (!isAuthenticated) {
    return (
      <>
        <SEO title="Ten Penny Novels | Preferiti" description="I tuoi documenti preferiti" noindex={true} nofollow={true} />
        <div className={styles.centerBox}>
          <p>Devi essere autenticato per visualizzare i tuoi documenti preferiti.</p>
        </div>
      </>
    );
  }

  if (!isLoading && favorites && favorites.length === 0) {
    return (
      <>
        <SEO title="Ten Penny Novels | Preferiti" description="I tuoi documenti preferiti" noindex={true} nofollow={true} />
        <div className={styles.centerBoxItalic}>
          <p>Non hai ancora aggiunto documenti ai preferiti.</p>
          <p>
            Usa il pulsante <strong>&#9734; Aggiungi ai preferiti</strong> nelle pagine dei documenti
            per salvarli qui.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Ten Penny Novels | Preferiti" description="I tuoi documenti preferiti" noindex={true} nofollow={true} />
      <LoadingSpinner fullPage message="Caricamento preferiti..." />
    </>
  );
}
