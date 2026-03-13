/**
 * Subtypes Management Page
 *
 * CRUD operations and drag-and-drop reordering for DocumentSubtype entities.
 * Subtypes are filtered by document type (ambientazione/regolamento).
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useSubtypes,
  useCreateSubtype,
  useUpdateSubtype,
  useDeleteSubtype,
  useReorderSubtypes
} from '@/hooks/api/useDocuments';
import { useNotificationStore } from '@/store/notificationStore';
import type { DocumentSubtype } from '@/types/api/Document';
import styles from '@/styles/pages/Subtypes.module.scss';

type DocumentType = 'ambientazione' | 'regolamento';

function SortableSubtypeRow({
  subtype,
  onEdit,
  onDelete,
  onToggleExpanded
}: {
  subtype: DocumentSubtype;
  onEdit: (s: DocumentSubtype) => void;
  onDelete: (id: string) => void;
  onToggleExpanded: (id: string, value: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: subtype._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.subtypeRow}>
      <div className={styles.dragHandle} {...attributes} {...listeners}>
        ⠿
      </div>
      <span className={styles.subtypeOrder}>#{subtype.order}</span>
      <span className={styles.subtypeTitle}>{subtype.title}</span>
      <span className={styles.subtypeSlug}>{subtype.slug}</span>
      <button
        className={`${styles.expandToggle} ${subtype.expandedByDefault ? styles.expanded : ''}`}
        onClick={() => onToggleExpanded(subtype._id, !subtype.expandedByDefault)}
        title={subtype.expandedByDefault ? 'Espanso in sidebar' : 'Chiuso in sidebar'}
      >
        {subtype.expandedByDefault ? '▼' : '▶'}
      </button>
      <div className={styles.subtypeActions}>
        <button onClick={() => onEdit(subtype)} className={styles.editBtn} title="Modifica">
          ✏️
        </button>
        <button onClick={() => onDelete(subtype._id)} className={styles.deleteBtn} title="Elimina">
          🗑️
        </button>
      </div>
    </div>
  );
}

export default function SubtypesPage() {
  const [typeFilter, setTypeFilter] = useState<DocumentType>('ambientazione');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSubtype, setEditingSubtype] = useState<DocumentSubtype | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [localSubtypes, setLocalSubtypes] = useState<DocumentSubtype[]>([]);

  const { data: subtypes, isLoading } = useSubtypes(typeFilter);
  const createSubtype = useCreateSubtype();
  const updateSubtype = useUpdateSubtype();
  const deleteSubtype = useDeleteSubtype();
  const reorderSubtypes = useReorderSubtypes();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  useEffect(() => {
    if (subtypes) {
      setLocalSubtypes(subtypes);
    }
  }, [subtypes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (value: string) => {
    setFormTitle(value);
    if (!editingSubtype) {
      setFormSlug(generateSlug(value));
    }
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditingSubtype(null);
    setFormTitle('');
    setFormSlug('');
  };

  const handleEdit = (subtype: DocumentSubtype) => {
    setEditingSubtype(subtype);
    setFormTitle(subtype.title);
    setFormSlug(subtype.slug);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim() || !formSlug.trim()) return;

    try {
      if (editingSubtype) {
        await updateSubtype.mutateAsync({
          id: editingSubtype._id,
          data: { title: formTitle.trim(), slug: formSlug.trim() }
        });
        addNotification({ type: 'success', message: 'Sottotipo aggiornato' });
      } else {
        await createSubtype.mutateAsync({
          title: formTitle.trim(),
          slug: formSlug.trim(),
          type: typeFilter
        });
        addNotification({ type: 'success', message: 'Sottotipo creato' });
      }
      resetForm();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel salvataggio'
      });
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Conferma Eliminazione',
      message: 'Sei sicuro di voler eliminare questo sottotipo? I documenti associati perderanno il riferimento.'
    });
    if (!confirmed) return;

    try {
      await deleteSubtype.mutateAsync(id);
      addNotification({ type: 'success', message: 'Sottotipo eliminato' });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'eliminazione'
      });
    }
  };

  const handleToggleExpanded = async (id: string, value: boolean) => {
    setLocalSubtypes(prev => prev.map(s => s._id === id ? { ...s, expandedByDefault: value } : s));
    try {
      await updateSubtype.mutateAsync({ id, data: { expandedByDefault: value } });
    } catch (error) {
      setLocalSubtypes(subtypes || []);
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localSubtypes.findIndex(s => s._id === active.id);
    const newIndex = localSubtypes.findIndex(s => s._id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localSubtypes, oldIndex, newIndex);
    setLocalSubtypes(reordered);

    try {
      await reorderSubtypes.mutateAsync({
        type: typeFilter,
        orderedIds: reordered.map(s => s._id)
      });
      addNotification({ type: 'success', message: 'Ordine aggiornato' });
    } catch (error) {
      setLocalSubtypes(subtypes || []);
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel riordinamento'
      });
    }
  };

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Gestione Sottotipi</title>
      </Head>

      <div className={styles.subtypesPage}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Sottotipi</h1>
            <p>Organizza i documenti in sottocategorie ordinabili</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.createButton}
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
            >
              + Nuovo Sottotipo
            </button>
          </div>
        </header>

        {/* Type filters */}
        <div className={styles.filters}>
          <button
            className={`${styles.filterButton} ${typeFilter === 'ambientazione' ? styles.active : ''}`}
            onClick={() => setTypeFilter('ambientazione')}
          >
            🌍 Ambientazione
          </button>
          <button
            className={`${styles.filterButton} ${typeFilter === 'regolamento' ? styles.active : ''}`}
            onClick={() => setTypeFilter('regolamento')}
          >
            📜 Regolamento
          </button>
        </div>

        {/* Create/Edit form */}
        {formOpen && (
          <form className={styles.subtypeForm} onSubmit={handleSubmit}>
            <h3>{editingSubtype ? 'Modifica Sottotipo' : 'Nuovo Sottotipo'}</h3>
            <div className={styles.formFields}>
              <div className={styles.formField}>
                <label htmlFor="subtype-title">Titolo</label>
                <input
                  id="subtype-title"
                  type="text"
                  value={formTitle}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="es. Introduzione"
                  required
                />
              </div>
              <div className={styles.formField}>
                <label htmlFor="subtype-slug">Slug</label>
                <input
                  id="subtype-slug"
                  type="text"
                  value={formSlug}
                  onChange={e => setFormSlug(e.target.value)}
                  placeholder="es. introduzione"
                  required
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={resetForm}>
                Annulla
              </button>
              <button type="submit" className={styles.submitBtn}>
                {editingSubtype ? 'Salva Modifiche' : 'Crea Sottotipo'}
              </button>
            </div>
          </form>
        )}

        {/* Subtypes list with drag & drop */}
        {isLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : localSubtypes.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className={styles.subtypesList}>
              <div className={styles.listHeader}>
                <span className={styles.colDrag}></span>
                <span className={styles.colOrder}>#</span>
                <span className={styles.colTitle}>Titolo</span>
                <span className={styles.colSlug}>Slug</span>
                <span className={styles.colExpand}>Sidebar</span>
                <span className={styles.colActions}>Azioni</span>
              </div>
              <SortableContext
                items={localSubtypes.map(s => s._id)}
                strategy={verticalListSortingStrategy}
              >
                {localSubtypes.map(subtype => (
                  <SortableSubtypeRow
                    key={subtype._id}
                    subtype={subtype}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleExpanded={handleToggleExpanded}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
        ) : (
          <div className={styles.emptyState}>
            Nessun sottotipo per "{typeFilter}". Creane uno con il pulsante sopra.
          </div>
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
