'use client';

import type { Document } from '@/types/document';
import { useAuthStore } from '@/store/authStore';
import { useToggleFavorite, useIsFavorited } from '@/hooks/useFavorites';
import styles from '@/styles/components/documents/DocumentDetail.module.scss';

interface DocumentHeaderProps {
  document: Document;
}

export function DocumentHeader({ document }: DocumentHeaderProps): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isFavorited } = useIsFavorited(document._id, isAuthenticated);
  const toggleFavorite = useToggleFavorite();

  const handleToggleFavorite = () => {
    toggleFavorite.mutate({
      type: document.type,
      path: document.path,
      documentId: document._id,
      isFavorited: !!isFavorited,
    });
  };

  return (
    <div className={styles.stickyHeader}>
      <h1 className={styles.stickyTitle}>
        <span className={styles.titleDiamond}>✦</span>
        {document.title}
        <span className={styles.titleDiamond}>✦</span>
      </h1>

      {isAuthenticated && (
        <button
          type="button"
          className={`${styles.favoriteButton} ${isFavorited ? styles.favorited : ''}`}
          onClick={handleToggleFavorite}
          disabled={toggleFavorite.isPending}
          aria-label={isFavorited ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        >
          <span className={styles.favoriteIcon}>{isFavorited ? '★' : '☆'}</span>
          <span className={styles.favoriteLabel}>
            {isFavorited ? 'Preferito' : 'Aggiungi ai preferiti'}
          </span>
        </button>
      )}
    </div>
  );
}
