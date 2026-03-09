'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useDocumentTree } from '@/hooks/useDocumentTree';
import { useFavorites } from '@/hooks/useFavorites';
import { SubtypeTreeView } from '../navigation/SubtypeTreeView';
import { FavoritesTreeView } from '../navigation/FavoritesTreeView';
import styles from '@/styles/components/layout/HamburgerMenu.module.scss';

export function HamburgerMenu(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: documentsByType } = useDocumentTree();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const currentPath = router.asPath;
  const isOnPreferiti = currentPath.startsWith('/preferiti');
  const isOnRegolamento = currentPath.startsWith('/regolamento');

  const { data: favorites } = useFavorites(isAuthenticated && isOnPreferiti);

  let sectionLabel: string;
  if (isOnPreferiti) {
    sectionLabel = 'Preferiti';
  } else if (isOnRegolamento) {
    sectionLabel = 'Regolamento';
  } else {
    sectionLabel = 'Ambientazione';
  }

  const currentType = isOnRegolamento ? 'regolamento' : 'ambientazione';
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
