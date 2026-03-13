'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { SEO } from '@/components/SEO';
import { useAuthStore } from '@/store/authStore';
import { useFavorites } from '@/hooks/useFavorites';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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
        <SEO title="Ten Penny Novels | Preferiti" description="I tuoi documenti preferiti" />
        <div style={{ textAlign: 'center', padding: '64px' }}>
          <p>Devi essere autenticato per visualizzare i tuoi documenti preferiti.</p>
        </div>
      </>
    );
  }

  if (!isLoading && favorites && favorites.length === 0) {
    return (
      <>
        <SEO title="Ten Penny Novels | Preferiti" description="I tuoi documenti preferiti" />
        <div style={{ textAlign: 'center', padding: '64px', fontStyle: 'italic' }}>
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
      <SEO title="Ten Penny Novels | Preferiti" description="I tuoi documenti preferiti" />
      <LoadingSpinner fullPage message="Caricamento preferiti..." />
    </>
  );
}
