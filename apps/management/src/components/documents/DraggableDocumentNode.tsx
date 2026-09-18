/**
 * DraggableDocumentNode - riga dell'albero documenti trascinabile e, insieme,
 * bersaglio di drop. Sostituisce il vecchio nodo "sortable", che permetteva
 * solo il riordino fra fratelli: qui il drop può anche cambiare genitore
 * (vedi `resolveDrop` in lib/documentTree.ts).
 */

import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import classNames from 'classnames';
import { DocumentNode } from './DocumentNode';
import type { DocumentTreeNode } from '@/types/api/Document';
import type { DropPosition } from '@/lib/documentTree';
import styles from './DocumentTreeView.module.scss';

/** Attributo con cui il contenitore ritrova la riga nel DOM per misurarla. */
export const DOC_ROW_ATTRIBUTE = 'data-doc-row';

export interface DropIndicator {
  overId: string;
  position: DropPosition;
}

export interface DraggableDocumentNodeProps {
  doc: DocumentTreeNode;
  depth: number;
  isExpanded: boolean;
  expandedDocs: Set<string>;
  dropIndicator: DropIndicator | null;
  onToggle: (docId: string) => void;
  onEdit: (docId: string) => void;
  onEditHierarchical: (docId: string) => void;
  onDelete: (docId: string) => void;
  onToggleVisibility: (docId: string) => void;
  onToggleDraft: (docId: string) => void;
  onTogglePublic: (docId: string) => void;
  onCreateChildDocument: (parentDocId: string) => void;
}

export const DraggableDocumentNode: React.FC<DraggableDocumentNodeProps> = (props) => {
  const { doc, dropIndicator } = props;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: doc._id });
  const { setNodeRef: setDropRef } = useDroppable({ id: doc._id });

  const setRef = React.useCallback(
    (element: HTMLElement | null) => {
      setDragRef(element);
      setDropRef(element);
    },
    [setDragRef, setDropRef]
  );

  const position = dropIndicator?.overId === doc._id ? dropIndicator.position : null;
  const hasChildren = doc.children.length > 0;

  return (
    <>
      <div
        ref={setRef}
        {...{ [DOC_ROW_ATTRIBUTE]: doc._id }}
        className={classNames(styles.dragRow, {
          [styles.dragging]: isDragging,
          [styles.dropBefore]: position === 'before',
          [styles.dropAfter]: position === 'after',
          [styles.dropInside]: position === 'inside'
        })}
        {...attributes}
        {...listeners}
      >
        <DocumentNode
          doc={doc}
          depth={props.depth}
          isExpanded={props.isExpanded}
          expandedDocs={props.expandedDocs}
          onToggle={props.onToggle}
          onEdit={props.onEdit}
          onEditHierarchical={props.onEditHierarchical}
          onDelete={props.onDelete}
          onToggleVisibility={props.onToggleVisibility}
          onToggleDraft={props.onToggleDraft}
          onTogglePublic={props.onTogglePublic}
          onCreateChildDocument={props.onCreateChildDocument}
        />
      </div>

      {hasChildren && props.isExpanded && (
        <div className={styles.children}>
          {doc.children.map((child) => (
            <DraggableDocumentNode
              key={child._id}
              {...props}
              doc={child}
              depth={props.depth + 1}
              isExpanded={props.expandedDocs.has(child._id)}
            />
          ))}
        </div>
      )}
    </>
  );
};
