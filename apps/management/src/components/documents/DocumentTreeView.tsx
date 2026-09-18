/**
 * Document Tree View
 *
 * Features:
 * - Shows documents as primary tree structure
 * - Nested document hierarchy (parent/child documents)
 * - Drag & drop: riordina fra fratelli E cambia genitore
 *     · rilascio sul bordo alto/basso di una riga → fratello di quella riga
 *     · rilascio al centro di una riga → figlio di quella riga (in coda)
 *     · sui bordi di un documento di primo livello → il documento diventa di primo livello
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import styles from './DocumentTreeView.module.scss';
import {
  DOC_ROW_ATTRIBUTE,
  DraggableDocumentNode,
  type DropIndicator
} from './DraggableDocumentNode';
import { resolveDrop, zoneFromPointer, type MoveTarget } from '@/lib/documentTree';
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
  onMoveDocument?: (documentId: string, target: MoveTarget) => void;
}

interface ActiveDrop {
  indicator: DropIndicator;
  target: MoveTarget;
}

function findTitle(nodes: DocumentTreeNode[], id: string): string | null {
  for (const node of nodes) {
    if (node._id === id) return node.title;
    const found = findTitle(node.children, id);
    if (found) return found;
  }
  return null;
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
  onMoveDocument
}: DocumentTreeViewProps): React.ReactElement {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDrop, setActiveDrop] = useState<ActiveDrop | null>(null);

  // La posizione del puntatore si legge direttamente dal browser: `delta` di
  // dnd-kit non include lo scroll fatto durante il drag, e la zona (bordo o
  // centro della riga) dipende dalla posizione reale sullo schermo.
  const pointerY = useRef(0);
  const stopTracking = useRef<(() => void) | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  );

  const toggleDoc = useCallback((docId: string) => {
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

  const endTracking = useCallback(() => {
    stopTracking.current?.();
    stopTracking.current = null;
    setActiveId(null);
    setActiveDrop(null);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));

    const start = event.activatorEvent as PointerEvent;
    pointerY.current = start.clientY;
    const onMove = (e: PointerEvent) => {
      pointerY.current = e.clientY;
    };
    window.addEventListener('pointermove', onMove);
    stopTracking.current = () => window.removeEventListener('pointermove', onMove);
  };

  const updateDrop = (event: DragMoveEvent) => {
    const overId = event.over ? String(event.over.id) : null;
    const dragged = String(event.active.id);

    const row = overId
      ? document.querySelector<HTMLElement>(`[${DOC_ROW_ATTRIBUTE}="${CSS.escape(overId)}"]`)
      : null;
    if (!overId || !row) {
      setActiveDrop(prev => (prev ? null : prev));
      return;
    }

    const position = zoneFromPointer(pointerY.current, row.getBoundingClientRect());
    const target = resolveDrop(documents, dragged, overId, position, expandedDocs);

    setActiveDrop(prev => {
      if (!target) return prev ? null : prev;
      if (prev && prev.indicator.overId === overId && prev.indicator.position === position) return prev;
      return { indicator: { overId, position }, target };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const drop = activeDrop;
    endTracking();

    if (!drop || !onMoveDocument) return;

    onMoveDocument(String(event.active.id), drop.target);

    // Il nuovo genitore va aperto, altrimenti il documento sparisce dalla vista.
    const { parentId } = drop.target;
    if (parentId) {
      setExpandedDocs(prev => (prev.has(parentId) ? prev : new Set(prev).add(parentId)));
    }
  };

  const activeTitle = activeId ? findTitle(documents, activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={updateDrop}
      onDragEnd={handleDragEnd}
      onDragCancel={endTracking}
    >
      <div className={styles.treeView}>
        {documents.length > 0 ? (
          documents.map(doc => (
            <DraggableDocumentNode
              key={doc._id}
              doc={doc}
              depth={0}
              isExpanded={expandedDocs.has(doc._id)}
              expandedDocs={expandedDocs}
              dropIndicator={activeDrop?.indicator ?? null}
              onToggle={toggleDoc}
              onEdit={onEditDocument}
              onEditHierarchical={onEditDocumentHierarchical}
              onDelete={onDeleteDocument}
              onToggleVisibility={onToggleDocumentVisibility}
              onToggleDraft={onToggleDocumentDraft}
              onTogglePublic={onToggleDocumentPublic}
              onCreateChildDocument={onCreateChildDocument}
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            Nessun documento trovato
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTitle ? <div className={styles.dragOverlay}>📝 {activeTitle}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
