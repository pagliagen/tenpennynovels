'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDocumentTree } from '@/hooks/useDocumentTree';
import { SubtypeTreeView } from '../navigation/SubtypeTreeView';
import styles from '@/styles/components/layout/Sidebar.module.scss';

export function Sidebar(): JSX.Element {
  const router = useRouter();
  const { data: documentsByType } = useDocumentTree();

  const currentPath = router.asPath;
  const isOnRegolamento = currentPath.startsWith('/regolamento');
  const currentType = isOnRegolamento ? 'regolamento' : 'ambientazione';
  const sectionLabel = isOnRegolamento ? 'Regolamento' : 'Ambientazione';

  const subtypes = documentsByType?.[currentType] || [];

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
          {subtypes.length === 0 ? (
            <p className={styles.emptyMessage}>Nessun documento disponibile</p>
          ) : (
            <SubtypeTreeView
              subtypes={subtypes}
              type={currentType}
              currentPath={currentPath}
            />
          )}
        </div>
      </div>
    </aside>
  );
}
