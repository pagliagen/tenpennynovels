/**
 * DocumentHeader Component
 *
 * Document title, metadata, and favorite button (only for authenticated users).
 *
 * @module components/documents/DocumentHeader
 * @since 1.0.0
 */

'use client';

import type { Document } from '@/types/document';
import { DOCUMENT_TYPE_CONFIGS } from '@/types/document';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/documents/DocumentDetail.module.scss';

interface DocumentHeaderProps {
  document: Document;
}

export function DocumentHeader({ document }: DocumentHeaderProps): JSX.Element {
  const typeConfig = DOCUMENT_TYPE_CONFIGS[document.type];
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <header className={styles.header}>
      <div className={styles.metadata}>
        <span className={styles.typeBadge} style={{ backgroundColor: typeConfig.color }}>
          {typeConfig.icon} {typeConfig.label}
        </span>
        {!document.isPublic && (
          <span className={styles.privateBadge} title="Documento privato">
            🔒 Privato
          </span>
        )}
      </div>

      <h1 className={styles.title}>{document.title}</h1>

      {document.description && <p className={styles.description}>{document.description}</p>}

      {isAuthenticated && (
        <div className={styles.actions}>
          {/* TODO: collegare FavoriteButton al backend */}
          <button type="button" className={styles.favoriteButton}>
            ☆ Aggiungi ai preferiti
          </button>
        </div>
      )}
    </header>
  );
}
