/**
 * Hierarchical Document Editor - Drag & Drop Style
 * Edits parent + children with drag & drop for reordering and reparenting
 * SAFE: No merge/split algorithms, each document independent
 */
import React, { useState, useMemo } from 'react';
import { Modal } from '@/components/shared/Modal';
import { DocumentContentEditor } from './DocumentContentEditor';
import { useDocumentWithChildren, useUpdateDocument, useReorderDocument } from '@/hooks/api/useDocuments';
import { useNotificationStore } from '@/store/notificationStore';
import classNames from 'classnames';
import styles from './HierarchicalDocumentEditor.module.scss';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable
} from '@dnd-kit/core';

interface HierarchicalDocumentEditorProps {
  rootDocumentId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DocumentEdit {
  _id: string;
  title: string;
  contentDelta: any;
  modified: boolean;
}

interface DraggableDocumentItemProps {
  doc: any;
  index: number;
  isRoot: boolean;
  edit: DocumentEdit;
  isExpanded: boolean;
  onToggleExpand: (docId: string) => void;
  onTitleChange: (docId: string, newTitle: string) => void;
  onContentChange: (docId: string, newContentDelta: any) => void;
  isDragging?: boolean;
}

const DraggableDocumentItem: React.FC<DraggableDocumentItemProps> = ({
  doc,
  index,
  isRoot,
  edit,
  isExpanded,
  onToggleExpand,
  onTitleChange,
  onContentChange,
  isDragging = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isCurrentDragging
  } = useDraggable({
    id: doc._id,
    disabled: isRoot, // Root cannot be dragged
    data: {
      index,
      doc
    }
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `droppable-${doc._id}`,
    disabled: isRoot, // Cannot drop on root
    data: {
      doc
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isCurrentDragging ? 0.5 : 1
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={classNames(styles.accordionItem, {
        [styles.expanded]: isExpanded,
        [styles.modified]: edit.modified,
        [styles.root]: isRoot,
        [styles.dragging]: isCurrentDragging,
        [styles.dropTarget]: isOver && !isRoot
      })}
    >
      {/* Header */}
      <div className={styles.accordionHeaderWrapper}>
        {/* Drag handle (only for children) */}
        {!isRoot && (
          <div
            {...listeners}
            {...attributes}
            className={styles.dragHandle}
            title="Trascina per riordinare o spostare"
          >
            ⋮⋮
          </div>
        )}

        <button
          className={styles.accordionHeader}
          onClick={() => onToggleExpand(doc._id)}
          type="button"
        >
          <span className={styles.icon}>{isExpanded ? '▼' : '▶'}</span>
          <span className={styles.title}>
            {isRoot ? '📄' : '📃'} {edit.title}
          </span>
          {edit.modified && <span className={styles.badge}>Modificato</span>}
        </button>
      </div>

      {/* Drop indicator */}
      {isOver && !isRoot && (
        <div className={styles.dropIndicator}>
          Rilascia qui per spostare dentro "{edit.title}"
        </div>
      )}

      {/* Content (collapsible) */}
      {isExpanded && (
        <div className={styles.accordionContent}>
          {/* Title Input */}
          <div className={styles.titleSection}>
            <label htmlFor={`title-${doc._id}`}>Titolo</label>
            <input
              id={`title-${doc._id}`}
              type="text"
              value={edit.title}
              onChange={(e) => onTitleChange(doc._id, e.target.value)}
              className={styles.titleInput}
              placeholder="Inserisci titolo..."
            />
          </div>

          {/* TipTap Editor */}
          <DocumentContentEditor
            contentDelta={edit.contentDelta}
            onChange={(newDelta) => onContentChange(doc._id, newDelta)}
          />
        </div>
      )}

      {/* Make entire item a drop target for becoming parent */}
      <div ref={setDroppableRef} className={styles.dropZone} />
    </div>
  );
};

export const HierarchicalDocumentEditor: React.FC<HierarchicalDocumentEditorProps> = ({
  rootDocumentId,
  isOpen,
  onClose
}) => {
  const { data, isLoading, refetch } = useDocumentWithChildren(rootDocumentId, { enabled: isOpen });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([rootDocumentId]));
  const [edits, setEdits] = useState<Map<string, DocumentEdit>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const updateDocument = useUpdateDocument();
  const reorderDocument = useReorderDocument();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, { active }) => {
        // Keyboard navigation for accessibility
        return { x: 0, y: 0 };
      },
    })
  );

  // Initialize edits when data loads
  React.useEffect(() => {
    if (data && edits.size === 0) {
      const initialEdits = new Map<string, DocumentEdit>();

      // Add root document
      initialEdits.set(data.document._id, {
        _id: data.document._id,
        title: data.document.title,
        contentDelta: data.document.contentDelta || { type: 'doc', content: [] },
        modified: false
      });

      // Add children
      data.children.forEach((child: any) => {
        initialEdits.set(child._id, {
          _id: child._id,
          title: child.title,
          contentDelta: child.contentDelta || { type: 'doc', content: [] },
          modified: false
        });
      });

      setEdits(initialEdits);
    }
  }, [data, edits.size]);

  // Toggle document expansion
  const toggleExpanded = (docId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // Update document content
  const handleContentChange = (docId: string, newContentDelta: any) => {
    setEdits(prev => {
      const next = new Map(prev);
      const current = next.get(docId);
      if (current) {
        next.set(docId, {
          ...current,
          contentDelta: newContentDelta,
          modified: true
        });
      }
      return next;
    });
  };

  // Update document title
  const handleTitleChange = (docId: string, newTitle: string) => {
    setEdits(prev => {
      const next = new Map(prev);
      const current = next.get(docId);
      if (current) {
        next.set(docId, {
          ...current,
          title: newTitle,
          modified: true
        });
      }
      return next;
    });
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const draggedDoc = data!.children.find((c: any) => c._id === active.id);
    if (!draggedDoc) return;

    // Check if dropped on a droppable zone (to become child)
    if (over.id.toString().startsWith('droppable-')) {
      const newParentId = over.id.toString().replace('droppable-', '');

      // Prevent dropping on itself or its current parent
      if (newParentId === draggedDoc._id || newParentId === draggedDoc.parentId) {
        return;
      }

      try {
        await reorderDocument.mutateAsync({
          documentId: draggedDoc._id,
          order: 1, // First position in new parent
          parentId: newParentId
        });

        await refetch();

        addNotification({
          type: 'success',
          message: 'Documento spostato'
        });
      } catch (error) {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Errore nello spostamento'
        });
      }
    } else {
      // Reorder within same level
      const sortedChildren = [...data!.children].sort((a, b) => a.order - b.order);
      const oldIndex = sortedChildren.findIndex((c: any) => c._id === active.id);
      const newIndex = sortedChildren.findIndex((c: any) => c._id === over.id);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return;
      }

      const movedDoc = sortedChildren[oldIndex];
      const targetDoc = sortedChildren[newIndex];

      try {
        // Swap orders
        await Promise.all([
          reorderDocument.mutateAsync({
            documentId: movedDoc._id,
            order: targetDoc.order,
            parentId: data!.document._id
          }),
          reorderDocument.mutateAsync({
            documentId: targetDoc._id,
            order: movedDoc.order,
            parentId: data!.document._id
          })
        ]);

        await refetch();

        addNotification({
          type: 'success',
          message: 'Documenti riordinati'
        });
      } catch (error) {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Errore nel riordinamento'
        });
      }
    }
  };

  // Save all modified documents
  const handleSave = async () => {
    const modifiedDocs = Array.from(edits.values()).filter(doc => doc.modified);

    if (modifiedDocs.length === 0) {
      addNotification({ type: 'info', message: 'Nessuna modifica da salvare' });
      onClose();
      return;
    }

    try {
      // Update all modified documents in parallel
      await Promise.all(
        modifiedDocs.map((doc) =>
          updateDocument.mutateAsync({
            id: doc._id,
            data: {
              title: doc.title,
              contentDelta: doc.contentDelta,
              lastUpdated: new Date().toISOString()
            }
          })
        )
      );

      addNotification({
        type: 'success',
        message: `${modifiedDocs.length} documenti salvati con successo`
      });

      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel salvataggio'
      });
    }
  };

  // Count modified documents
  const modifiedCount = useMemo(() => {
    return Array.from(edits.values()).filter(doc => doc.modified).length;
  }, [edits]);

  if (isLoading || !data) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Caricamento..." size="large">
        <div className={styles.loading}>Caricamento gerarchia documenti...</div>
      </Modal>
    );
  }

  const { childCount, exceededLimit } = data;
  // Sort children by order before displaying
  const sortedChildren = [...data.children].sort((a, b) => a.order - b.order);
  const allDocs = [data.document, ...sortedChildren];

  const activeDoc = activeId ? allDocs.find((d: any) => d._id === activeId) : null;
  const activeEdit = activeId ? edits.get(activeId) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Modifica Gerarchica: ${data.document.title}`}
      size="large"
      footer={
        <>
          <span className={styles.modifiedBadge}>
            {modifiedCount > 0 ? `${modifiedCount} modificati` : 'Nessuna modifica'}
          </span>
          <button onClick={onClose} className={styles.cancelButton}>
            Annulla
          </button>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={updateDocument.isPending || modifiedCount === 0}
          >
            {updateDocument.isPending ? 'Salvataggio...' : `Salva ${modifiedCount > 0 ? `(${modifiedCount})` : ''}`}
          </button>
        </>
      }
    >
      <div className={styles.hierarchicalEditor}>
        {/* Warning if > 10 children */}
        {exceededLimit && (
          <div className={styles.warning}>
            ⚠️ Questo documento ha {childCount} figli. Solo i primi 10 sono mostrati.
          </div>
        )}

        {/* Info header */}
        <div className={styles.infoHeader}>
          Stai editando: <strong>{data.document.title}</strong> + {Math.min(childCount, 10)} documenti figli
          <div className={styles.dragHint}>
            💡 Trascina i documenti per riordinarli o spostarli dentro altri documenti
          </div>
        </div>

        {/* Drag & Drop Context */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Accordion List */}
          <div className={styles.accordion}>
            {allDocs.map((doc: any, index: number) => {
              const edit = edits.get(doc._id);
              if (!edit) return null;

              const isExpanded = expandedIds.has(doc._id);
              const isRoot = index === 0;

              return (
                <DraggableDocumentItem
                  key={doc._id}
                  doc={doc}
                  index={index}
                  isRoot={isRoot}
                  edit={edit}
                  isExpanded={isExpanded}
                  onToggleExpand={toggleExpanded}
                  onTitleChange={handleTitleChange}
                  onContentChange={handleContentChange}
                />
              );
            })}
          </div>

          {/* Drag Overlay (preview while dragging) */}
          <DragOverlay>
            {activeDoc && activeEdit ? (
              <div className={classNames(styles.accordionItem, styles.dragOverlay)}>
                <div className={styles.accordionHeaderWrapper}>
                  <div className={styles.dragHandle}>⋮⋮</div>
                  <div className={styles.accordionHeader}>
                    <span className={styles.icon}>▶</span>
                    <span className={styles.title}>📃 {activeEdit.title}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Modal>
  );
};
