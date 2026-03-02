/**
 * DocumentGroup Component
 *
 * Collapsible group of documents in tree navigation.
 * Displays group name with expand/collapse control.
 *
 * @module components/navigation/DocumentGroup
 * @since 1.0.0
 */

'use client';

import type { DocumentGroup as DocumentGroupType } from '@/types/document';
import { DocumentLink } from './DocumentLink';
import styles from '@/styles/components/navigation/DocumentTree.module.scss';

interface DocumentGroupProps {
  group: DocumentGroupType;
  onToggle: (groupName: string) => void;
}

export function DocumentGroup({ group, onToggle }: DocumentGroupProps): JSX.Element {
  return (
    <div className={styles.group}>
      <button
        type="button"
        className={styles.groupHeader}
        onClick={() => onToggle(group.name)}
        aria-expanded={!group.isCollapsed}
      >
        <span className={styles.groupIcon}>{group.isCollapsed ? '▶' : '▼'}</span>
        <span className={styles.groupName}>{group.name}</span>
        <span className={styles.groupCount}>({group.documents.length})</span>
      </button>

      {!group.isCollapsed && (
        <div className={styles.groupContent}>
          {group.documents.map((doc) => (
            <DocumentLink key={doc._id} document={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
