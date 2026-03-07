/**
 * SortableDocumentNode - Draggable wrapper for DocumentNode
 * Enables drag & drop functionality using @dnd-kit
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DocumentNode } from './DocumentNode';
import type { DocumentTreeNode } from '@/types/api/Document';
import styles from './DocumentTreeView.module.scss';

export interface SortableDocumentNodeProps {
  doc: DocumentTreeNode;
  depth: number;
  isExpanded: boolean;
  expandedDocs: Set<string>;
  onToggle: (docId: string) => void;
  onEdit: (docId: string) => void;
  onEditHierarchical: (docId: string) => void;
  onDelete: (docId: string) => void;
  onToggleVisibility: (docId: string) => void;
  onToggleDraft: (docId: string) => void;
  onCreateChildDocument: (parentDocId: string) => void;
}

export const SortableDocumentNode: React.FC<SortableDocumentNodeProps> = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.doc._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  const hasChildren = props.doc.children && props.doc.children.length > 0;

  return (
    <>
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <DocumentNode {...props} />
      </div>

      {hasChildren && props.isExpanded && (
        <div className={styles.children}>
          <SortableContext
            items={props.doc.children.map(c => c._id)}
            strategy={verticalListSortingStrategy}
          >
            {props.doc.children.map(child => (
              <SortableDocumentNode
                key={child._id}
                doc={child}
                depth={props.depth + 1}
                isExpanded={props.expandedDocs.has(child._id)}
                expandedDocs={props.expandedDocs}
                onToggle={props.onToggle}
                onEdit={props.onEdit}
                onEditHierarchical={props.onEditHierarchical}
                onDelete={props.onDelete}
                onToggleVisibility={props.onToggleVisibility}
                onToggleDraft={props.onToggleDraft}
                onCreateChildDocument={props.onCreateChildDocument}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </>
  );
};
