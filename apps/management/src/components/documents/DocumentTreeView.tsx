/**
 * Document Tree View
 *
 * Features:
 * - Shows documents as primary tree structure
 * - Nested document hierarchy (parent/child documents)
 * - Drag & drop to reorder documents
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import styles from './DocumentTreeView.module.scss';
import { SortableDocumentNode } from './SortableDocumentNode';
import type { DocumentTreeNode } from '@/types/api/Document';

interface DocumentTreeViewProps {
  documents: DocumentTreeNode[];
  onCreateChildDocument: (parentDocId: string) => void;
  onEditDocument: (docId: string) => void;
  onEditDocumentHierarchical: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onToggleDocumentVisibility: (docId: string) => void;
  onToggleDocumentDraft: (docId: string) => void;
  onToggleDocumentPublic: (docId: string) => void;
  onReorderSiblings?: (parentId: string | null, orderedIds: string[]) => void;
}

export function DocumentTreeView({
  documents,
  onCreateChildDocument,
  onEditDocument,
  onEditDocumentHierarchical,
  onDeleteDocument,
  onToggleDocumentVisibility,
  onToggleDocumentDraft,
  onToggleDocumentPublic,
  onReorderSiblings
}: DocumentTreeViewProps): React.ReactElement {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [localDocuments, setLocalDocuments] = useState(documents);

  React.useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const toggleDoc = React.useCallback((docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onReorderSiblings) {
      return;
    }

    const findDocumentAndParent = (
      docId: string,
      docs: DocumentTreeNode[],
      parentId: string | null = null
    ): { doc: DocumentTreeNode; parentId: string | null; siblings: DocumentTreeNode[] } | null => {
      for (const doc of docs) {
        if (doc._id === docId) {
          return { doc, parentId, siblings: docs };
        }
        if (doc.children && doc.children.length > 0) {
          const found = findDocumentAndParent(docId, doc.children, doc._id);
          if (found) return found;
        }
      }
      return null;
    };

    const activeData = findDocumentAndParent(active.id as string, localDocuments);
    const overData = findDocumentAndParent(over.id as string, localDocuments);

    if (!activeData || !overData) return;
    if (activeData.parentId !== overData.parentId) return;

    const siblings = activeData.siblings;
    const oldIndex = siblings.findIndex(d => d._id === active.id);
    const newIndex = siblings.findIndex(d => d._id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex);

    const updateDocumentTree = (docs: DocumentTreeNode[]): DocumentTreeNode[] => {
      return docs.map(doc => {
        if (doc._id === activeData.parentId || activeData.parentId === null) {
          if (activeData.parentId === null) {
            return reorderedSiblings.find(d => d._id === doc._id) || doc;
          }
          return { ...doc, children: reorderedSiblings };
        }
        if (doc.children && doc.children.length > 0) {
          return { ...doc, children: updateDocumentTree(doc.children) };
        }
        return doc;
      });
    };

    const newDocuments = activeData.parentId === null
      ? reorderedSiblings
      : updateDocumentTree(localDocuments);

    setLocalDocuments(newDocuments);

    const orderedIds = reorderedSiblings.map(d => d._id);
    onReorderSiblings(activeData.parentId, orderedIds);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.treeView}>
        {localDocuments.length > 0 ? (
          <SortableContext
            items={localDocuments.map(d => d._id)}
            strategy={verticalListSortingStrategy}
          >
            {localDocuments.map(doc => (
              <SortableDocumentNode
                key={doc._id}
                doc={doc}
                depth={0}
                isExpanded={expandedDocs.has(doc._id)}
                expandedDocs={expandedDocs}
                onToggle={toggleDoc}
                onEdit={onEditDocument}
                onEditHierarchical={onEditDocumentHierarchical}
                onDelete={onDeleteDocument}
                onToggleVisibility={onToggleDocumentVisibility}
                onToggleDraft={onToggleDocumentDraft}
                onTogglePublic={onToggleDocumentPublic}
                onCreateChildDocument={onCreateChildDocument}
              />
            ))}
          </SortableContext>
        ) : (
          <div className={styles.emptyState}>
            Nessun documento trovato
          </div>
        )}
      </div>
    </DndContext>
  );
}
