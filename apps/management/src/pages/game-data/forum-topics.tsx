import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import {
  useForumTopics,
  useCreateForumTopic,
  useUpdateForumTopic,
  useDeleteForumTopic
} from '@/hooks/api/useForumTopics';
import { useNotificationStore } from '@/store/notificationStore';
import { TopicPermissionsPanel } from '@/components/forum/TopicPermissionsPanel';
import { apiClient } from '@/lib/api/client';
import type {
  ForumTopic,
  ForumTopicListParams,
  CreateForumTopicData,
  UpdateForumTopicData,
  TopicAccessRule,
  AccessRuleType,
} from '@/types/api/ForumTopic';
import { ACCESS_RULE_TYPE_LABELS, GAMEPLAY_ROLE_OPTIONS } from '@/types/api/ForumTopic';
import styles from '@/styles/pages/ForumTopics.module.scss';

interface Corporation {
  _id: string;
  name: string;
}

const ACCESS_RULE_TYPE_OPTIONS = Object.entries(ACCESS_RULE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const EMPTY_FORM: CreateForumTopicData = {
  title: '',
  description: '',
  sortOrder: 0,
  accessRules: [],
  color: '',
  mode: 'OFF',
};

function topicToFormData(topic: ForumTopic): CreateForumTopicData {
  return {
    title: topic.title,
    description: topic.description || '',
    sortOrder: topic.sortOrder,
    accessRules: topic.accessRules || [],
    color: topic.color || '',
    mode: topic.mode || 'OFF',
  };
}

export default function ForumTopicsPage() {
  const { filters, params, setParams, handleFilterChange } = useTableFilters<ForumTopicListParams>({
    page: 1, pageSize: 25, sortBy: 'sortOrder', sortOrder: 'asc',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<ForumTopic | null>(null);
  const [formData, setFormData] = useState<CreateForumTopicData>(EMPTY_FORM);

  const [newRuleType, setNewRuleType] = useState<AccessRuleType>('public');
  const [newRuleCorporationId, setNewRuleCorporationId] = useState('');
  const [newRuleGameplayRole, setNewRuleGameplayRole] = useState('');
  const [corporations, setCorporations] = useState<Corporation[]>([]);

  const { data, isLoading, error } = useForumTopics(params);
  const tableConfig = useTableConfig('forum-topics');
  const createTopic = useCreateForumTopic();
  const updateTopic = useUpdateForumTopic();
  const deleteTopic = useDeleteForumTopic();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(s => s.addNotification);

  useEffect(() => {
    apiClient.get<{ result: boolean; data?: { corporations?: Corporation[] } }>('/admin/corporations')
      .then(res => {
        const corps = res.data?.data?.corporations ?? [];
        setCorporations(corps);
      })
      .catch(() => {});
  }, []);

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingTopic(null);
    setFormData(EMPTY_FORM);
    setNewRuleType('public');
    setNewRuleCorporationId('');
    setNewRuleGameplayRole('');
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingTopic(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((topic: ForumTopic) => {
    setEditingTopic(topic);
    setFormData(topicToFormData(topic));
    setModalOpen(true);
  }, []);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddRule = useCallback(() => {
    const rule: TopicAccessRule = { type: newRuleType };

    if (newRuleType === 'corporation') {
      if (!newRuleCorporationId) return;
      rule.corporationId = newRuleCorporationId;
      const corp = corporations.find(c => c._id === newRuleCorporationId);
      rule.label = corp?.name;
    } else if (newRuleType === 'gameplayRole') {
      if (!newRuleGameplayRole) return;
      rule.gameplayRole = newRuleGameplayRole;
      const opt = GAMEPLAY_ROLE_OPTIONS.find(o => o.value === newRuleGameplayRole);
      rule.label = opt?.label;
    }

    setFormData(prev => ({
      ...prev,
      accessRules: [...(prev.accessRules || []), rule],
    }));
    setNewRuleType('public');
    setNewRuleCorporationId('');
    setNewRuleGameplayRole('');
  }, [newRuleType, newRuleCorporationId, newRuleGameplayRole, corporations]);

  const handleRemoveRule = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      accessRules: (prev.accessRules || []).filter((_, i) => i !== index),
    }));
  }, []);

  const getRuleLabel = (rule: TopicAccessRule): string => {
    const typeLabel = ACCESS_RULE_TYPE_LABELS[rule.type];
    if (rule.type === 'corporation') {
      return `${typeLabel}: ${rule.label || rule.corporationId}`;
    }
    if (rule.type === 'gameplayRole') {
      return `${typeLabel}: ${rule.label || rule.gameplayRole}`;
    }
    return typeLabel;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTopic) {
        const updateData: UpdateForumTopicData = { ...formData };
        await updateTopic.mutateAsync({ topicId: editingTopic._id, data: updateData });
        addNotification({ type: 'success', message: `Argomento "${formData.title}" aggiornato` });
      } else {
        await createTopic.mutateAsync(formData);
        addNotification({ type: 'success', message: `Argomento "${formData.title}" creato` });
      }
      closeModal();
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Errore nel salvataggio' });
    }
  };

  const handleAction = async (action: string, topic: ForumTopic) => {
    try {
      if (action === 'edit') {
        openEditModal(topic);
      } else if (action === 'delete') {
        const confirmed = await confirm({
          title: 'Conferma Eliminazione',
          message: `Sei sicuro di voler eliminare l'argomento "${topic.title}"? Questa azione è irreversibile.`,
        });
        if (confirmed) {
          await deleteTopic.mutateAsync({ topicId: topic._id });
          addNotification({ type: 'success', message: `Argomento "${topic.title}" eliminato` });
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

  const isSaving = createTopic.isPending || updateTopic.isPending;
  const topics = data?.list ?? [];
  const totalItems = data?.pagination?.totalItems ?? 0;

  const canAddRule = newRuleType === 'public' || newRuleType === 'authenticated'
    || (newRuleType === 'corporation' && !!newRuleCorporationId)
    || (newRuleType === 'gameplayRole' && !!newRuleGameplayRole);

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento argomenti</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head><title>Ten Penny Novels | Forum - Argomenti</title></Head>
      <div className={styles.forumTopics}>
        <header className={styles.header}>
          <div>
            <h1>Forum - Argomenti</h1>
            <p>Totale: {totalItems} argomenti</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.createButton} onClick={openCreateModal}>+ Nuovo Argomento</button>
          </div>
        </header>

        <ConfigurableDataTable<ForumTopic>
          tableName="forum-topics"
          data={topics}
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
          title={editingTopic ? `Modifica: ${editingTopic.title}` : 'Nuovo Argomento'}
          size="large"
          footer={
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Annulla</button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isSaving || !formData.title.trim()}
              >
                {isSaving ? 'Salvataggio...' : editingTopic ? 'Salva Modifiche' : 'Crea Argomento'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <FormField label="Titolo" name="title" required value={formData.title}
              onChange={(e: any) => handleChange('title', e.target.value)}
              placeholder="es. Discussioni Generali" />

            <FormField label="Descrizione" name="description" type="textarea"
              value={formData.description || ''}
              onChange={(e: any) => handleChange('description', e.target.value)}
              placeholder="Descrizione dell'argomento..." />

            <div className={styles.formRow}>
              <FormField label="Ordine" name="sortOrder" type="number"
                value={formData.sortOrder ?? 0}
                onChange={(e: any) => handleChange('sortOrder', parseInt(e.target.value) || 0)} />
              <FormField label="Colore" name="color"
                value={formData.color || ''}
                onChange={(e: any) => handleChange('color', e.target.value)}
                placeholder="es. #3B82F6" />
            </div>

            <div className={styles.formRow}>
              <FormField
                label="Modalità"
                name="mode"
                type="select"
                value={formData.mode || 'OFF'}
                onChange={(e: any) => handleChange('mode', e.target.value)}
                options={[
                  { value: 'OFF', label: 'OFF — nessun anonimato, editing libero, segnalazione consentita' },
                  { value: 'ON', label: 'ON — anonimato consentito, editing risposta entro 15min' },
                ]}
              />
            </div>

            <p className={styles.sectionTitle}>Regole di Accesso</p>
            <p className={styles.helpText}>
              Definisci chi può visualizzare e partecipare a questo argomento.
              Se nessuna regola è definita, l'argomento è accessibile a tutti.
            </p>

            <div className={styles.accessRulesSection}>
              {(formData.accessRules || []).length > 0 && (
                <div className={styles.accessRulesList}>
                  {(formData.accessRules || []).map((rule, index) => (
                    <span key={index} className={styles.accessRuleTag}>
                      {getRuleLabel(rule)}
                      <button type="button" className={styles.removeRuleBtn}
                        onClick={() => handleRemoveRule(index)}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className={styles.addRuleRow}>
                <select
                  className={styles.ruleSelect}
                  value={newRuleType}
                  onChange={(e) => {
                    setNewRuleType(e.target.value as AccessRuleType);
                    setNewRuleCorporationId('');
                    setNewRuleGameplayRole('');
                  }}
                >
                  {ACCESS_RULE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {newRuleType === 'corporation' && (
                  <select
                    className={styles.ruleSelect}
                    value={newRuleCorporationId}
                    onChange={(e) => setNewRuleCorporationId(e.target.value)}
                  >
                    <option value="">Seleziona corporazione...</option>
                    {corporations.map(corp => (
                      <option key={corp._id} value={corp._id}>{corp.name}</option>
                    ))}
                  </select>
                )}

                {newRuleType === 'gameplayRole' && (
                  <select
                    className={styles.ruleSelect}
                    value={newRuleGameplayRole}
                    onChange={(e) => setNewRuleGameplayRole(e.target.value)}
                  >
                    <option value="">Seleziona ruolo...</option>
                    {GAMEPLAY_ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  className={styles.addRuleBtn}
                  onClick={handleAddRule}
                  disabled={!canAddRule}
                >
                  + Aggiungi
                </button>
              </div>
            </div>

            {editingTopic && (
              <>
                <p className={styles.sectionTitle}>Permessi per Personaggio</p>
                <TopicPermissionsPanel topicId={editingTopic._id} />
              </>
            )}
          </form>
        </Modal>
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
