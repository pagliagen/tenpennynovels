'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useDocumentTree } from '@/hooks/useDocumentTree';
import { useFavorites } from '@/hooks/useFavorites';
import { SubtypeTreeView } from '../navigation/SubtypeTreeView';
import { FavoritesTreeView } from '../navigation/FavoritesTreeView';
import styles from '@/styles/components/layout/Sidebar.module.scss';

export function Sidebar(): JSX.Element {
  const router = useRouter();
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
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.logo}>
        <Image
          src="/images/title.png"
          alt="Ten Penny Novels - Chapter One"
          width={140}
          height={60}
          priority
          className={styles.logoImage}
        />
      </Link>

      <div className={styles.sidebarContent}>
        <div className={styles.sectionLabel}>
          {sectionLabel}
        </div>

        <div className={styles.treeContainer}>
          {renderTree()}
        </div>
      </div>
    </aside>
  );
}
