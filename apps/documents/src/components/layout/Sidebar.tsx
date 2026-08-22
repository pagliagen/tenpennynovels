'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';

import { useDocumentTree } from '@/hooks/useDocumentTree';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/layout/Sidebar.module.scss';
import { resolveDocumentSection } from '@/utils/documentSection';

import { FavoritesTreeView } from '../navigation/FavoritesTreeView';
import { SubtypeTreeView } from '../navigation/SubtypeTreeView';

export function Sidebar(): JSX.Element {
  const router = useRouter();
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
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.logo}>
        <img
          src="/images/title.png"
          alt="Ten Penny Novels"
          width={140}
          height={60}
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
