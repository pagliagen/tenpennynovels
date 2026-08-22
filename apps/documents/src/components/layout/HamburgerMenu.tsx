'use client';

import { useRouter } from 'next/router';
import { useState } from 'react';

import { useDocumentTree } from '@/hooks/useDocumentTree';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/layout/HamburgerMenu.module.scss';
import { resolveDocumentSection } from '@/utils/documentSection';

import { FavoritesTreeView } from '../navigation/FavoritesTreeView';
import { SubtypeTreeView } from '../navigation/SubtypeTreeView';

export function HamburgerMenu(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: documentsByType } = useDocumentTree();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const currentPath = router.asPath;
  const { type: currentType, label: sectionLabel, isFavorites: isOnPreferiti } =
    resolveDocumentSection(currentPath);

  const { data: favorites } = useFavorites(isAuthenticated && isOnPreferiti);

  const subtypes = documentsByType?.[currentType] || [];

  const renderTree = () => {
    if (isOnPreferiti) {
      if (!favorites || favorites.length === 0) {
        return <p className={styles.emptyMessage}>Nessun preferito</p>;
      }
      return <FavoritesTreeView favorites={favorites} currentPath={currentPath} />;
    }

    if (subtypes.length === 0) {
      return <p className={styles.emptyMessage}>Nessun documento disponibile</p>;
    }
    return (
      <SubtypeTreeView
        subtypes={subtypes}
        type={currentType}
        currentPath={currentPath}
      />
    );
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.hamburgerButton} ${open ? styles.open : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Chiudi indice' : 'Apri indice'}
        aria-expanded={open}
      >
        <span className={styles.hamburgerIcon} />
      </button>

      {open && (
        <>
          <div
            className={styles.backdrop}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <span className={styles.sectionLabel}>{sectionLabel}</span>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>
            <div className={styles.drawerContent}>
              {renderTree()}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
