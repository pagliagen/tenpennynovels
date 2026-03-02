/**
 * DocumentHeader Component
 *
 * Document title, metadata, and favorite button.
 * Shows document type and public/private status.
 *
 * @module components/documents/DocumentHeader
 * @since 1.0.0
 */

'use client';

import type { Document } from '@/types/document';
import { DOCUMENT_TYPE_CONFIGS } from '@/types/document';
import styles from '@/styles/components/documents/DocumentDetail.module.scss';

interface DocumentHeaderProps {
  document: Document;
  showFavoriteButton?: boolean;
}

export function DocumentHeader({ document, showFavoriteButton = true }: DocumentHeaderProps): JSX.Element {
  const typeConfig = DOCUMENT_TYPE_CONFIGS[document.type];

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

      {showFavoriteButton && (
        <div className={styles.actions}>
          {/* TODO: Add FavoriteButton component */}
          <button type="button" className={styles.favoriteButton}>
            ☆ Aggiungi ai preferiti
          </button>
        </div>
      )}
    </header>
  );
}
