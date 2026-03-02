/**
 * Document Tree View - DOCUMENTS-FIRST Architecture
 *
 * Features:
 * - Shows documents as primary tree structure
 * - Route metadata attached to each document (route indicator 🔗)
 * - Nested document hierarchy (parent/child documents)
 * - Drag & drop to reorder documents
 * - Conditional actions based on route existence
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
import type { DocumentWithRoute } from '@/types/api/Document';

interface DocumentTreeViewProps {
  documents: DocumentWithRoute[];
  // Route actions (conditional based on route existence)
  onCreateRoute: (documentId: string) => void;
  onEditRoute: (routeId: string) => void;
  onToggleRouteEnabled: (routeId: string) => void;
  onDeleteRoute: (routeId: string) => void;
  // Document actions (always available)
  onEditDocument: (docId: string) => void;
  onEditDocumentHierarchical: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onToggleDocumentVisibility: (docId: string) => void;
  onToggleDocumentDraft: (docId: string) => void;
  // Drag & drop
  onReorderSiblings?: (parentId: string | null, orderedIds: string[]) => void;
}

export function DocumentTreeView({
  documents,
  onCreateRoute,
  onEditRoute,
  onToggleRouteEnabled,
  onDeleteRoute,
  onEditDocument,
  onEditDocumentHierarchical,
  onDeleteDocument,
  onToggleDocumentVisibility,
  onToggleDocumentDraft,
  onReorderSiblings
}: DocumentTreeViewProps): React.ReactElement {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [localDocuments, setLocalDocuments] = useState(documents);

  // Update local documents when props change
  React.useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px movement before drag starts
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Toggle document expansion
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

  /**
   * Handle drag end - reorder documents within same parent
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onReorderSiblings) {
      return;
    }

    // Find the dragged document and target document
    const findDocumentAndParent = (
      docId: string,
      docs: DocumentWithRoute[],
      parentId: string | null = null
    ): { doc: DocumentWithRoute; parentId: string | null; siblings: DocumentWithRoute[] } | null => {
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

    if (!activeData || !overData) {
      return;
    }

    // Only allow reordering within same parent
    if (activeData.parentId !== overData.parentId) {
      return;
    }

    const siblings = activeData.siblings;
    const oldIndex = siblings.findIndex(d => d._id === active.id);
    const newIndex = siblings.findIndex(d => d._id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Optimistic update
    const reorderedSiblings = arrayMove(siblings, oldIndex, newIndex);

    // Update local state
    const updateDocumentTree = (docs: DocumentWithRoute[]): DocumentWithRoute[] => {
      return docs.map(doc => {
        if (doc._id === activeData.parentId || activeData.parentId === null) {
          // This is the parent level, replace children
          if (activeData.parentId === null) {
            // Root level
            return reorderedSiblings.find(d => d._id === doc._id) || doc;
          }
          return {
            ...doc,
            children: reorderedSiblings
          };
        }
        if (doc.children && doc.children.length > 0) {
          return {
            ...doc,
            children: updateDocumentTree(doc.children)
          };
        }
        return doc;
      });
    };

    const newDocuments = activeData.parentId === null
      ? reorderedSiblings
      : updateDocumentTree(localDocuments);

    setLocalDocuments(newDocuments);

    // Call API to persist (pass FULL ordered array of siblings)
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
                onCreateRoute={onCreateRoute}
                onEditRoute={onEditRoute}
                onToggleRouteEnabled={onToggleRouteEnabled}
                onDeleteRoute={onDeleteRoute}
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
