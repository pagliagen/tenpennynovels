import Link from 'next/link';
import { SEO } from '@/components/SEO';
import { useAuthStore } from '@/store/authStore';
import { useFavorites, useToggleFavorite } from '@/hooks/useFavorites';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import styles from '@/styles/components/documents/Preferiti.module.scss';

export default function PreferitiPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: favorites, isLoading } = useFavorites(isAuthenticated);
  const toggleFavorite = useToggleFavorite();

  if (!isAuthenticated) {
    return (
      <>
        <SEO title="Preferiti" description="I tuoi documenti preferiti" />
        <div className={styles.notAuthenticated}>
          <h1>Preferiti</h1>
          <p>Devi essere autenticato per visualizzare i tuoi documenti preferiti.</p>
        </div>
      </>
    );
  }

  const handleRemove = (type: string, path: string, documentId: string) => {
    toggleFavorite.mutate({ type, path, documentId, isFavorited: true });
  };

  return (
    <>
      <SEO title="Preferiti" description="I tuoi documenti preferiti" />

      <div className={styles.page}>
        <h1 className={styles.title}>Preferiti</h1>

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <LoadingSpinner />
          </div>
        ) : !favorites || favorites.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Non hai ancora aggiunto documenti ai preferiti.</p>
            <p>
              Usa il pulsante <strong>&#9734; Aggiungi ai preferiti</strong> nelle pagine dei documenti
              per salvarli qui.
            </p>
          </div>
        ) : (
          <ul className={styles.list}>
            {favorites.map((fav) => (
              <li key={fav._id} className={styles.item}>
                <Link href={`/${fav.document.type}/${fav.document.path}`} className={styles.itemLink}>
                  <span className={styles.itemType}>{fav.document.type}</span>
                  <span className={styles.itemTitle}>{fav.document.title}</span>
                </Link>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemove(fav.document.type, fav.document.path, fav.document._id)}
                  disabled={toggleFavorite.isPending}
                  aria-label={`Rimuovi ${fav.document.title} dai preferiti`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
