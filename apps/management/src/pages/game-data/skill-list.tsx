import React, { useState, useMemo, useCallback } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useSkills, useCreateSkill, useUpdateSkill, useDeleteSkill } from '@/hooks/api/useSkills';
import { useNotificationStore } from '@/store/notificationStore';
import type { Skill, SkillListParams, CreateSkillData } from '@/types/api/Skill';
import styles from '@/styles/pages/SkillList.module.scss';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'Generale' },
  { value: 'combat', label: 'Combattimento' },
  { value: 'knowledge', label: 'Conoscenza' },
  { value: 'social', label: 'Sociale' },
  { value: 'technical', label: 'Tecnico' },
  { value: 'special', label: 'Speciale' },
  { value: 'criminal', label: 'Criminale' },
  { value: 'physical', label: 'Fisico' },
  { value: 'artistic', label: 'Artistico' },
  { value: 'financial', label: 'Finanziario' },
  { value: 'occult', label: 'Occulto' },
];

const EMPTY_FORM: CreateSkillData = {
  name: '', baseValue: 0, category: 'general', description: '',
  visible: true, defaultSkill: false, isPlaceholder: false,
  placeholderType: '', predefinedValues: [], canRollWithoutPoints: false,
  lockedForPlayer: false,
};

export default function SkillList() {
  const { filters, params, setParams, handleFilterChange } = useTableFilters<SkillListParams>({
    page: 1, pageSize: 25, sortBy: 'name', sortOrder: 'asc',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState<CreateSkillData>(EMPTY_FORM);

  const { data, isLoading, error } = useSkills(params);
  const tableConfig = useTableConfig('skill-list');
  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(s => s.addNotification);

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingSkill(null);
    setFormData(EMPTY_FORM);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingSkill(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((skill: Skill) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name, baseValue: skill.baseValue, category: skill.category,
      description: skill.description, visible: skill.visible, defaultSkill: skill.defaultSkill,
      isPlaceholder: skill.isPlaceholder,
      placeholderType: skill.placeholderType || '', predefinedValues: skill.predefinedValues || [],
      canRollWithoutPoints: skill.canRollWithoutPoints,
      lockedForPlayer: skill.lockedForPlayer,
    });
    setModalOpen(true);
  }, []);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSkill) {
        await updateSkill.mutateAsync({ id: editingSkill._id, data: formData });
        addNotification({ type: 'success', message: `Skill "${formData.name}" aggiornata` });
      } else {
        await createSkill.mutateAsync(formData);
        addNotification({ type: 'success', message: `Skill "${formData.name}" creata` });
      }
      closeModal();
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Errore nel salvataggio' });
    }
  };

  const handleAction = async (action: string, skill: Skill) => {
    try {
      if (action === 'edit') {
        openEditModal(skill);
      } else if (action === 'delete') {
        const confirmed = await confirm({
          title: 'Conferma Eliminazione',
          message: `Sei sicuro di voler eliminare la skill "${skill.name}"? Questa azione è irreversibile.`,
        });
        if (confirmed) {
          await deleteSkill.mutateAsync({ id: skill._id });
          addNotification({ type: 'success', message: `Skill "${skill.name}" eliminata` });
        }
      }
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Errore nell\'esecuzione azione' });
    }
  };

  const handlePageChange = (page: number) => setParams(prev => ({ ...prev, page }));
  const handlePageSizeChange = (pageSize: number) => setParams(prev => ({ ...prev, pageSize, page: 1 }));
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') =>
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));

  const isSaving = createSkill.isPending || updateSkill.isPending;
  const skills = data?.data?.skills ?? [];
  const totalItems = data?.data?.pagination?.totalItems ?? 0;

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento skills</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head><title>Ten Penny Novels | Gestione Skills</title></Head>
      <div className={styles.skillList}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Skills</h1>
            <p>Totale: {totalItems} skills</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.createButton} onClick={openCreateModal}>+ Nuova Skill</button>
          </div>
        </header>

        <ConfigurableDataTable<Skill>
          tableName="skill-list"
          data={skills}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          pagination={{
            page: params.page ?? 1, pageSize: params.pageSize ?? 25, total: totalItems,
            onPageChange: handlePageChange, onPageSizeChange: handlePageSizeChange,
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={handleSortChange}
          filters={filters}
          onFilterChange={handleFilterChange}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config, visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue,
          } : undefined}
        />

        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={editingSkill ? `Modifica: ${editingSkill.name}` : 'Nuova Skill'}
          size="large"
          footer={
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Annulla</button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isSaving || !formData.name.trim() || !formData.description.trim()}
              >
                {isSaving ? 'Salvataggio...' : editingSkill ? 'Salva Modifiche' : 'Crea Skill'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <div className={styles.formRow}>
              <FormField label="Nome" name="name" required value={formData.name}
                onChange={(e: any) => handleChange('name', e.target.value)} placeholder="es. Pugilato" />
              <FormField label="Valore Base" name="baseValue" required value={String(formData.baseValue)}
                onChange={(e: any) => handleChange('baseValue', e.target.value)}
                placeholder="es. 0, VALUE:XX" helpText="Numeri o formule come VALUE:XX" />
            </div>
            <FormField label="Categoria" name="category" type="select" required value={formData.category}
              onChange={(e: any) => handleChange('category', e.target.value)} options={CATEGORY_OPTIONS} />
            <FormField label="Descrizione" name="description" type="textarea" required value={formData.description}
              onChange={(e: any) => handleChange('description', e.target.value)} placeholder="Descrizione della skill..." />
            <div className={styles.formRow3}>
              <FormField label="Visibile" name="visible" type="checkbox" checked={formData.visible ?? true}
                onChange={(e: any) => handleChange('visible', e.target.checked)} />
              <FormField label="Skill Default" name="defaultSkill" type="checkbox" checked={formData.defaultSkill ?? false}
                onChange={(e: any) => handleChange('defaultSkill', e.target.checked)} />
              <FormField label="Tiro senza punti" name="canRollWithoutPoints" type="checkbox"
                checked={formData.canRollWithoutPoints ?? false}
                onChange={(e: any) => handleChange('canRollWithoutPoints', e.target.checked)} />
            </div>
            <FormField label="Placeholder" name="isPlaceholder" type="checkbox" checked={formData.isPlaceholder ?? false}
              onChange={(e: any) => handleChange('isPlaceholder', e.target.checked)} />
            <FormField label="Modificabile solo dal master" name="lockedForPlayer" type="checkbox"
              checked={formData.lockedForPlayer ?? false}
              onChange={(e: any) => handleChange('lockedForPlayer', e.target.checked)}
              helpText="Il giocatore non può spendere px su questa skill (es. Occultismo/Mythos): cresce solo per assegnazione del master." />
            {formData.isPlaceholder && (
              <div className={styles.formRow}>
                <FormField label="Tipo Placeholder" name="placeholderType" value={formData.placeholderType || ''}
                  onChange={(e: any) => handleChange('placeholderType', e.target.value)} placeholder="es. language, instrument" />
                <FormField label="Valori Predefiniti (separati da virgola)" name="predefinedValues" type="textarea"
                  value={(formData.predefinedValues || []).join(', ')}
                  onChange={(e: any) => handleChange('predefinedValues',
                    e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean))}
                  placeholder="es. Inglese, Francese, Tedesco" />
              </div>
            )}
          </form>
        </Modal>
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
