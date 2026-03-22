import React, { useState, useMemo, useCallback } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import {
  useOccupations, useCreateOccupation, useUpdateOccupation, useDeleteOccupation
} from '@/hooks/api/useOccupations';
import { useSkills } from '@/hooks/api/useSkills';
import { useNotificationStore } from '@/store/notificationStore';
import type {
  Occupation, OccupationListParams, CreateOccupationData,
  OccupationCategory, PopulatedSkillRef,
} from '@/types/api/Occupation';
import type { Skill as SkillItem } from '@/types/api/Skill';
import styles from '@/styles/pages/OccupationList.module.scss';

const CATEGORY_OPTIONS: { value: OccupationCategory; label: string }[] = [
  { value: 'avventurieri', label: 'Avventurieri' },
  { value: 'arti_creative', label: 'Arti Creative' },
  { value: 'artisti_spettacolo', label: 'Artisti e Spettacolo' },
  { value: 'sport', label: 'Sport' },
  { value: 'affari', label: 'Affari' },
  { value: 'religiosi', label: 'Religiosi' },
  { value: 'criminali', label: 'Criminali' },
  { value: 'giornalismo', label: 'Giornalismo' },
  { value: 'lavoro_rurale', label: 'Lavoro Rurale' },
  { value: 'lavoro_urbano', label: 'Lavoro Urbano' },
  { value: 'tutori_ordine', label: "Tutori dell'Ordine" },
  { value: 'professione_legale', label: 'Professione Legale' },
  { value: 'operatori_sanitari', label: 'Operatori Sanitari' },
  { value: 'salute_mentale', label: 'Salute Mentale' },
  { value: 'forze_armate', label: 'Forze Armate' },
  { value: 'politica', label: 'Politica' },
  { value: 'studiosi', label: 'Studiosi' },
  { value: 'professioni_varie', label: 'Professioni Varie' },
];

interface FormSlot {
  options: string[]; // skill IDs
}

interface FormBonusSkill {
  skillId: string;
  bonusValue: number;
}

interface FormData {
  name: string;
  description: string;
  category: OccupationCategory;
  contacts: string;
  earnings: string;
  requiredSkillSlots: FormSlot[];
  bonusSkills: FormBonusSkill[];
  image?: string;
  isActive: boolean;
}

const EMPTY_FORM: FormData = {
  name: '', description: '', category: 'professioni_varie',
  contacts: '', earnings: '',
  requiredSkillSlots: [], bonusSkills: [], isActive: true,
};

function getSkillId(ref: PopulatedSkillRef | string): string {
  return typeof ref === 'object' ? ref._id : ref;
}

export default function OccupationList() {
  const { filters, params, setParams, handleFilterChange } = useTableFilters<OccupationListParams>({
    page: 1, pageSize: 25,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOccupation, setEditingOccupation] = useState<Occupation | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const { data, isLoading, error } = useOccupations(params);
  const tableConfig = useTableConfig('occupation-list');
  const createOccupation = useCreateOccupation();
  const updateOccupation = useUpdateOccupation();
  const deleteOccupation = useDeleteOccupation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(s => s.addNotification);

  // Load all skills for dropdowns
  const { data: skillsData } = useSkills({ pageSize: 300 });
  const allSkills: SkillItem[] = useMemo(() => {
    const items = skillsData?.data?.skills ?? [];
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [skillsData]);

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingOccupation(null);
    setFormData(EMPTY_FORM);
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingOccupation(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((occ: Occupation) => {
    setEditingOccupation(occ);
    setFormData({
      name: occ.name,
      description: occ.description,
      category: occ.category,
      contacts: occ.contacts,
      earnings: occ.earnings,
      requiredSkillSlots: (occ.requiredSkillSlots || []).map(slot => ({
        options: slot.options.map(o => getSkillId(o)),
      })),
      bonusSkills: (occ.bonusSkills || []).map(bs => ({
        skillId: getSkillId(bs.skillId),
        bonusValue: bs.bonusValue,
      })),
      image: occ.image || '',
      isActive: occ.isActive,
    });
    setModalOpen(true);
  }, []);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // --- Slot management ---
  const addSlot = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      requiredSkillSlots: [...prev.requiredSkillSlots, { options: [''] }],
    }));
  }, []);

  const removeSlot = useCallback((slotIdx: number) => {
    setFormData(prev => ({
      ...prev,
      requiredSkillSlots: prev.requiredSkillSlots.filter((_, i) => i !== slotIdx),
    }));
  }, []);

  const setSlotOption = useCallback((slotIdx: number, optIdx: number, skillId: string) => {
    setFormData(prev => {
      const slots = [...prev.requiredSkillSlots];
      const options = [...slots[slotIdx].options];
      options[optIdx] = skillId;
      slots[slotIdx] = { options };
      return { ...prev, requiredSkillSlots: slots };
    });
  }, []);

  const addSlotOption = useCallback((slotIdx: number) => {
    setFormData(prev => {
      const slots = [...prev.requiredSkillSlots];
      slots[slotIdx] = { options: [...slots[slotIdx].options, ''] };
      return { ...prev, requiredSkillSlots: slots };
    });
  }, []);

  const removeSlotOption = useCallback((slotIdx: number, optIdx: number) => {
    setFormData(prev => {
      const slots = [...prev.requiredSkillSlots];
      const options = slots[slotIdx].options.filter((_, i) => i !== optIdx);
      if (options.length === 0) {
        return { ...prev, requiredSkillSlots: slots.filter((_, i) => i !== slotIdx) };
      }
      slots[slotIdx] = { options };
      return { ...prev, requiredSkillSlots: slots };
    });
  }, []);

  // --- Bonus skills management ---
  const addBonusSkill = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      bonusSkills: [...prev.bonusSkills, { skillId: '', bonusValue: 10 }],
    }));
  }, []);

  const removeBonusSkill = useCallback((idx: number) => {
    setFormData(prev => ({
      ...prev,
      bonusSkills: prev.bonusSkills.filter((_, i) => i !== idx),
    }));
  }, []);

  const setBonusSkillField = useCallback((idx: number, field: 'skillId' | 'bonusValue', value: string | number) => {
    setFormData(prev => {
      const skills = [...prev.bonusSkills];
      skills[idx] = { ...skills[idx], [field]: value };
      return { ...prev, bonusSkills: skills };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateOccupationData = {
      name: formData.name,
      description: formData.description,
      category: formData.category,
      contacts: formData.contacts,
      earnings: formData.earnings,
      requiredSkillSlots: formData.requiredSkillSlots
        .filter(s => s.options.some(o => o))
        .map(s => ({ options: s.options.filter(o => o) })),
      bonusSkills: formData.bonusSkills
        .filter(bs => bs.skillId)
        .map(bs => ({ skillId: bs.skillId, bonusValue: bs.bonusValue })),
      image: formData.image,
      isActive: formData.isActive,
    };
    try {
      if (editingOccupation) {
        await updateOccupation.mutateAsync({
          id: editingOccupation._id, data: { ...payload, reason: 'Aggiornamento da gestionale' },
        });
        addNotification({ type: 'success', message: `Occupazione "${formData.name}" aggiornata` });
      } else {
        await createOccupation.mutateAsync(payload);
        addNotification({ type: 'success', message: `Occupazione "${formData.name}" creata` });
      }
      closeModal();
    } catch (err) {
      addNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore nel salvataggio',
      });
    }
  };

  const handleAction = async (action: string, occ: Occupation) => {
    try {
      if (action === 'edit') {
        openEditModal(occ);
      } else if (action === 'delete') {
        const confirmed = await confirm({
          title: 'Conferma Eliminazione',
          message: `Sei sicuro di voler eliminare l'occupazione "${occ.name}"? Questa azione è irreversibile.`,
        });
        if (confirmed) {
          await deleteOccupation.mutateAsync({ id: occ._id, reason: 'Eliminazione da gestionale' });
          addNotification({ type: 'success', message: `Occupazione "${occ.name}" eliminata` });
        }
      }
    } catch (err) {
      addNotification({
        type: 'error',
        message: err instanceof Error ? err.message : "Errore nell'esecuzione azione",
      });
    }
  };

  const handlePageChange = (page: number) => setParams(prev => ({ ...prev, page }));
  const handlePageSizeChange = (pageSize: number) => setParams(prev => ({ ...prev, pageSize, page: 1 }));
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') =>
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));

  const isSaving = createOccupation.isPending || updateOccupation.isPending;
  const occupations = data?.list ?? [];
  const totalItems = data?.pagination?.totalItems ?? 0;

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento occupazioni</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head><title>Ten Penny Novels | Gestione Occupazioni</title></Head>
      <div className={styles.occupationList}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Occupazioni</h1>
            <p>Totale: {totalItems} occupazioni</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.createButton} onClick={openCreateModal}>
              + Nuova Occupazione
            </button>
          </div>
        </header>

        <ConfigurableDataTable<Occupation>
          tableName="occupation-list"
          data={occupations}
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
          title={editingOccupation ? `Modifica: ${editingOccupation.name}` : 'Nuova Occupazione'}
          size="large"
          footer={
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Annulla</button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isSaving || !formData.name.trim() || !formData.description.trim()}
              >
                {isSaving ? 'Salvataggio...' : editingOccupation ? 'Salva Modifiche' : 'Crea Occupazione'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <div className={styles.formRow}>
              <FormField label="Nome" name="name" required value={formData.name}
                onChange={(e: any) => handleChange('name', e.target.value)}
                placeholder="es. Detective Privato" />
              <FormField label="Categoria" name="category" type="select" required
                value={formData.category}
                onChange={(e: any) => handleChange('category', e.target.value)}
                options={CATEGORY_OPTIONS} />
            </div>

            <FormField label="Descrizione" name="description" type="textarea" required
              value={formData.description}
              onChange={(e: any) => handleChange('description', e.target.value)}
              placeholder="Descrizione dell'occupazione..." />

            <div className={styles.formRow}>
              <FormField label="Contatti" name="contacts" required value={formData.contacts}
                onChange={(e: any) => handleChange('contacts', e.target.value)}
                placeholder="es. Polizia, Informatori" />
              <FormField label="Guadagni" name="earnings" required value={formData.earnings}
                onChange={(e: any) => handleChange('earnings', e.target.value)}
                placeholder="es. Medio" />
            </div>

            {/* Required Skill Slots */}
            <div className={styles.skillSection}>
              <div className={styles.skillSectionHeader}>
                <label>Skill Richieste (Slot)</label>
                <button type="button" className={styles.addBtn} onClick={addSlot}>+ Aggiungi Slot</button>
              </div>
              {formData.requiredSkillSlots.length === 0 && (
                <p className={styles.emptyHint}>Nessuno slot definito</p>
              )}
              {formData.requiredSkillSlots.map((slot, slotIdx) => (
                <div key={slotIdx} className={styles.slotRow}>
                  <span className={styles.slotLabel}>Slot {slotIdx + 1}:</span>
                  <div className={styles.slotOptions}>
                    {slot.options.map((optId, optIdx) => (
                      <div key={optIdx} className={styles.slotOption}>
                        {optIdx > 0 && <span className={styles.orLabel}>oppure</span>}
                        <select
                          value={optId}
                          onChange={e => setSlotOption(slotIdx, optIdx, e.target.value)}
                          className={styles.skillSelect}
                        >
                          <option value="">-- Seleziona Skill --</option>
                          {allSkills.map(s => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                          ))}
                        </select>
                        <button type="button" className={styles.removeBtn}
                          onClick={() => removeSlotOption(slotIdx, optIdx)} title="Rimuovi opzione">×</button>
                      </div>
                    ))}
                    <button type="button" className={styles.addAltBtn}
                      onClick={() => addSlotOption(slotIdx)} title="Aggiungi alternativa">+ alt</button>
                  </div>
                  <button type="button" className={styles.removeSlotBtn}
                    onClick={() => removeSlot(slotIdx)} title="Rimuovi slot">✕</button>
                </div>
              ))}
            </div>

            {/* Bonus Skills */}
            <div className={styles.skillSection}>
              <div className={styles.skillSectionHeader}>
                <label>Skill Bonus</label>
                <button type="button" className={styles.addBtn} onClick={addBonusSkill}>+ Aggiungi Bonus</button>
              </div>
              {formData.bonusSkills.length === 0 && (
                <p className={styles.emptyHint}>Nessuna skill bonus definita</p>
              )}
              {formData.bonusSkills.map((bs, idx) => (
                <div key={idx} className={styles.bonusRow}>
                  <select
                    value={bs.skillId}
                    onChange={e => setBonusSkillField(idx, 'skillId', e.target.value)}
                    className={styles.skillSelect}
                  >
                    <option value="">-- Seleziona Skill --</option>
                    {allSkills.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                  <label className={styles.bonusLabel}>Bonus:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={bs.bonusValue}
                    onChange={e => setBonusSkillField(idx, 'bonusValue', parseInt(e.target.value) || 0)}
                    className={styles.bonusInput}
                  />
                  <button type="button" className={styles.removeBtn}
                    onClick={() => removeBonusSkill(idx)} title="Rimuovi">×</button>
                </div>
              ))}
            </div>

            <FormField label="Attiva" name="isActive" type="checkbox"
              checked={formData.isActive ?? true}
              onChange={(e: any) => handleChange('isActive', e.target.checked)} />

            <div className={styles.imageSection}>
              <div className={styles.fieldLabel}>Immagine</div>
              {editingOccupation ? (
                <ImageUploader
                  value={formData.image || ''}
                  onChange={(url) => handleChange('image', url)}
                  entityType="occupations"
                  entityId={editingOccupation._id}
                />
              ) : (
                <p className={styles.imageHelpText}>
                  Salva l&apos;occupazione per caricare un&apos;immagine.
                </p>
              )}
            </div>
          </form>
        </Modal>
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
