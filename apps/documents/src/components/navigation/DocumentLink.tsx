/**
 * DocumentLink Component
 *
 * Single document link in tree navigation.
 * Highlights active document and shows public/private status.
 *
 * @module components/navigation/DocumentLink
 * @since 1.0.0
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import type { Document } from '@/types/document';
import styles from '@/styles/components/navigation/DocumentTree.module.scss';

interface DocumentLinkProps {
  document: Document;
}

export function DocumentLink({ document }: DocumentLinkProps): JSX.Element {
  const router = useRouter();
  const isActive = router.asPath === `/${document.type}/${document.path}`;

  return (
    <Link
      href={`/${document.type}/${document.path}`}
      className={`${styles.documentLink} ${isActive ? styles.active : ''}`}
      title={document.title}
    >
      <span className={styles.documentTitle}>{document.title}</span>
      {!document.isPublic && (
        <span className={styles.privateBadge} title="Ten Penny Novels | Documento privato (richiede login)">
          🔒
        </span>
      )}
    </Link>
  );
}
