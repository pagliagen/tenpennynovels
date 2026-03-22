import React, { useState, useMemo, useCallback } from 'react';
import Head from 'next/head';
import classNames from 'classnames';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { GenerateImageButton } from '@/components/shared/GenerateImageButton';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useItems, useCreateItem, useUpdateItem, useDeleteItem } from '@/hooks/api/useItems';
import { useLocations } from '@/hooks/api/useLocations';
import { useNotificationStore } from '@/store/notificationStore';
import type { Item, ItemListParams, CreateItemData, ItemCategory } from '@/types/api/Item';
import { ITEM_CATEGORY_LABELS } from '@/types/api/Item';
import styles from '@/styles/pages/ItemList.module.scss';

const CATEGORY_OPTIONS = Object.entries(ITEM_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const CONSUMPTION_TYPE_OPTIONS = [
  { value: '', label: 'Nessuno' },
  { value: 'direct', label: 'Diretto' },
  { value: 'indirect', label: 'Indiretto' },
];

type TabKey = 'base' | 'availability' | 'properties' | 'shop' | 'finance';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'base', label: 'Base' },
  { key: 'availability', label: 'Disponibilità' },
  { key: 'properties', label: 'Proprietà' },
  { key: 'shop', label: 'Shop' },
  { key: 'finance', label: 'Finanza' },
];

const EMPTY_FORM: CreateItemData = {
  name: '',
  description: '',
  category: 'clothing' as ItemCategory,
  subcategory: '',
  imageUrl: '',
  isPublic: false,
  isAdminOnly: false,
  availableLocations: [],
  basePrice: 0,
  properties: {
    isStackable: false,
    isConsumable: false,
  },
  financialSettings: {
    eligibleForCredit: true,
  },
  shopSettings: {
    canBePurchased: true,
    canBeSold: true,
    canBeTradedBetweenPlayers: true,
    hasLimitedStock: false,
  },
};

function itemToFormData(item: Item): CreateItemData {
  const locations = (item.availableLocations || []).map((loc: any) =>
    typeof loc === 'string' ? loc : loc._id || loc.id
  );
  return {
    name: item.name,
    description: item.description,
    category: item.category,
    subcategory: item.subcategory || '',
    imageUrl: item.imageUrl || '',
    isPublic: item.isPublic,
    isAdminOnly: item.isAdminOnly,
    availableLocations: locations,
    basePrice: item.basePrice,
    properties: {
      isStackable: item.properties?.isStackable ?? false,
      maxQuantity: item.properties?.maxQuantity,
      durability: item.properties?.durability,
      isConsumable: item.properties?.isConsumable ?? false,
      consumptionType: item.properties?.consumptionType,
    },
    financialSettings: {
      eligibleForCredit: item.financialSettings?.eligibleForCredit ?? true,
    },
    shopSettings: {
      canBePurchased: item.shopSettings?.canBePurchased ?? true,
      canBeSold: item.shopSettings?.canBeSold ?? true,
      sellBackPrice: item.shopSettings?.sellBackPrice,
      canBeTradedBetweenPlayers: item.shopSettings?.canBeTradedBetweenPlayers ?? true,
      hasLimitedStock: item.shopSettings?.hasLimitedStock ?? false,
      defaultStock: item.shopSettings?.defaultStock,
      restockInterval: item.shopSettings?.restockInterval,
      restockQuantity: item.shopSettings?.restockQuantity,
    },
  };
}

export default function ItemList() {
  const { filters, params, setParams, handleFilterChange } = useTableFilters<ItemListParams>({
    page: 1, pageSize: 25, sortBy: 'name', sortOrder: 'asc',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<CreateItemData>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TabKey>('base');

  const { data, isLoading, error } = useItems(params);
  const { data: locationsData } = useLocations({ pageSize: 500 });
  const tableConfig = useTableConfig('item-list');
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(s => s.addNotification);

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setActiveTab('base');
  }, []);

  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setActiveTab('base');
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((item: Item) => {
    setEditingItem(item);
    setFormData(itemToFormData(item));
    setActiveTab('base');
    setModalOpen(true);
  }, []);

  const handleChange = useCallback((field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleNestedChange = useCallback(
    (section: 'properties' | 'financialSettings' | 'shopSettings', field: string, value: unknown) => {
      setFormData(prev => ({
        ...prev,
        [section]: { ...prev[section] as Record<string, unknown>, [field]: value },
      }));
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem._id, data: { ...formData, reason: 'Aggiornamento da pannello' } });
        addNotification({ type: 'success', message: `Item "${formData.name}" aggiornato` });
      } else {
        await createItem.mutateAsync(formData);
        addNotification({ type: 'success', message: `Item "${formData.name}" creato` });
      }
      closeModal();
    } catch (err) {
      addNotification({ type: 'error', message: err instanceof Error ? err.message : 'Errore nel salvataggio' });
    }
  };

  const handleAction = async (action: string, item: Item) => {
    try {
      if (action === 'edit') {
        openEditModal(item);
      } else if (action === 'delete') {
        const confirmed = await confirm({
          title: 'Conferma Eliminazione',
          message: `Sei sicuro di voler eliminare l'item "${item.name}"? Questa azione è irreversibile.`,
        });
        if (confirmed) {
          await deleteItem.mutateAsync({ id: item._id });
          addNotification({ type: 'success', message: `Item "${item.name}" eliminato` });
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

  const isSaving = createItem.isPending || updateItem.isPending;
  const items = data?.list ?? [];
  const totalItems = data?.pagination?.totalItems ?? 0;

  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento items</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head><title>Ten Penny Novels | Gestione Mercato</title></Head>
      <div className={styles.itemList}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Mercato</h1>
            <p>Totale: {totalItems} oggetti</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.createButton} onClick={openCreateModal}>+ Nuovo Item</button>
          </div>
        </header>

        <ConfigurableDataTable<Item>
          tableName="item-list"
          data={items}
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
          title={editingItem ? `Modifica: ${editingItem.name}` : 'Nuovo Item'}
          size="large"
          footer={
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeModal}>Annulla</button>
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isSaving || !formData.name.trim() || !formData.description.trim()}
              >
                {isSaving ? 'Salvataggio...' : editingItem ? 'Salva Modifiche' : 'Crea Item'}
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} className={styles.modalForm}>
            <div className={styles.tabs}>
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={classNames(styles.tab, activeTab === tab.key && styles.tabActive)}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={styles.slideViewport}>
              <div
                className={styles.slideTrack}
                style={{ '--slide-index': TABS.findIndex(t => t.key === activeTab) } as React.CSSProperties}
              >
                {/* Tab: Base */}
                <div className={styles.slidePanel}>
                  <div className={styles.tabContent}>
                    <div className={styles.formRow}>
                      <FormField label="Nome" name="name" required value={formData.name}
                        onChange={(e: any) => handleChange('name', e.target.value)}
                        placeholder="es. Cilindro di Seta" />
                      <FormField label="Categoria" name="category" type="select" required
                        value={formData.category}
                        onChange={(e: any) => handleChange('category', e.target.value)}
                        options={CATEGORY_OPTIONS} />
                    </div>
                    <div className={styles.formRow}>
                      <FormField label="Sottocategoria" name="subcategory"
                        value={formData.subcategory || ''}
                        onChange={(e: any) => handleChange('subcategory', e.target.value)}
                        placeholder="es. Cappelli" />
                      <FormField label="Prezzo Base (pence)" name="basePrice" type="number" required
                        value={formData.basePrice ?? 0}
                        onChange={(e: any) => handleChange('basePrice', parseInt(e.target.value) || 0)} />
                    </div>
                    <FormField label="Descrizione" name="description" type="textarea" required
                      value={formData.description}
                      onChange={(e: any) => handleChange('description', e.target.value)}
                      placeholder="Descrizione dell'item..." />

                    {editingItem ? (
                      <>
                        <ImageUploader
                          value={formData.imageUrl || ''}
                          onChange={(url) => handleChange('imageUrl', url)}
                          entityType="items"
                          entityId={editingItem._id}
                        />
                        <GenerateImageButton
                          entityType="item"
                          entityId={editingItem._id}
                          entityName={editingItem.name}
                          onSuccess={(url) => handleChange('imageUrl', url)}
                        />
                      </>
                    ) : (
                      <p className={styles.helpText}>
                        L'immagine potrà essere caricata dopo aver salvato l'item.
                      </p>
                    )}
                  </div>
                </div>

                {/* Tab: Disponibilità */}
                <div className={styles.slidePanel}>
                  <div className={styles.tabContent}>
                    <div className={styles.formRow}>
                      <FormField label="Vendita Libera" name="isPublic" type="checkbox"
                        checked={formData.isPublic ?? false}
                        onChange={(e: any) => handleChange('isPublic', e.target.checked)}
                        helpText="Disponibile nei negozi generali per l'acquisto libero" />
                      <FormField label="Solo Gestionale" name="isAdminOnly" type="checkbox"
                        checked={formData.isAdminOnly ?? false}
                        onChange={(e: any) => handleChange('isAdminOnly', e.target.checked)}
                        helpText="Assegnabile solo tramite il pannello di gestione, non acquistabile in gioco" />
                    </div>

                    <p className={styles.sectionTitle}>Location di Vendita</p>
                    <p className={styles.helpText}>
                      Seleziona le location dove questo oggetto è disponibile per l'acquisto.
                      Se nessuna è selezionata, l'oggetto sarà disponibile ovunque (se in vendita libera).
                    </p>
                    <div className={styles.locationSelector}>
                      {(() => {
                        const allLocations = locationsData?.data?.locations ?? [];
                        const selectedIds = formData.availableLocations ?? [];
                        const availableLocs = allLocations.filter((l: any) => !selectedIds.includes(l.id));
                        return (
                          <>
                            {selectedIds.length > 0 && (
                              <div className={styles.selectedLocations}>
                                {selectedIds.map((locId: string) => {
                                  const loc = allLocations.find((l: any) => l.id === locId);
                                  return (
                                    <span key={locId} className={styles.locationTag}>
                                      {loc?.name || locId}
                                      <button type="button" className={styles.removeLocationBtn}
                                        onClick={() => handleChange('availableLocations', selectedIds.filter((id: string) => id !== locId))}>
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                            <select
                              className={styles.locationDropdown}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleChange('availableLocations', [...selectedIds, e.target.value]);
                                }
                              }}
                            >
                              <option value="">+ Aggiungi location...</option>
                              {availableLocs.map((loc: any) => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                              ))}
                            </select>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Tab: Proprietà */}
                <div className={styles.slidePanel}>
                  <div className={styles.tabContent}>
                    <div className={styles.formRow}>
                      <FormField label="Impilabile" name="isStackable" type="checkbox"
                        checked={formData.properties?.isStackable ?? false}
                        onChange={(e: any) => handleNestedChange('properties', 'isStackable', e.target.checked)} />
                      <FormField label="Quantità Massima" name="maxQuantity" type="number"
                        value={formData.properties?.maxQuantity ?? ''}
                        onChange={(e: any) => handleNestedChange('properties', 'maxQuantity', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Illimitata" />
                    </div>
                    <div className={styles.formRow}>
                      <FormField label="Durabilità (1-100)" name="durability" type="number"
                        value={formData.properties?.durability ?? ''}
                        onChange={(e: any) => handleNestedChange('properties', 'durability', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Nessuna" />
                      <FormField label="Consumabile" name="isConsumable" type="checkbox"
                        checked={formData.properties?.isConsumable ?? false}
                        onChange={(e: any) => handleNestedChange('properties', 'isConsumable', e.target.checked)} />
                    </div>
                    {formData.properties?.isConsumable && (
                      <FormField label="Tipo Consumo" name="consumptionType" type="select"
                        value={formData.properties?.consumptionType || ''}
                        onChange={(e: any) => handleNestedChange('properties', 'consumptionType', e.target.value || undefined)}
                        options={CONSUMPTION_TYPE_OPTIONS} />
                    )}
                  </div>
                </div>

                {/* Tab: Shop */}
                <div className={styles.slidePanel}>
                  <div className={styles.tabContent}>
                    <div className={styles.formRow}>
                      <FormField label="Acquistabile" name="canBePurchased" type="checkbox"
                        checked={formData.shopSettings?.canBePurchased ?? true}
                        onChange={(e: any) => handleNestedChange('shopSettings', 'canBePurchased', e.target.checked)} />
                      <FormField label="Rivendibile" name="canBeSold" type="checkbox"
                        checked={formData.shopSettings?.canBeSold ?? true}
                        onChange={(e: any) => handleNestedChange('shopSettings', 'canBeSold', e.target.checked)} />
                    </div>
                    <div className={styles.formRow}>
                      <FormField label="Prezzo Rivendita (pence)" name="sellBackPrice" type="number"
                        value={formData.shopSettings?.sellBackPrice ?? ''}
                        onChange={(e: any) => handleNestedChange('shopSettings', 'sellBackPrice', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Automatico" />
                      <FormField label="Scambiabile tra giocatori" name="canBeTradedBetweenPlayers" type="checkbox"
                        checked={formData.shopSettings?.canBeTradedBetweenPlayers ?? true}
                        onChange={(e: any) => handleNestedChange('shopSettings', 'canBeTradedBetweenPlayers', e.target.checked)} />
                    </div>
                    <p className={styles.sectionTitle}>Gestione Stock</p>
                    <div className={styles.formRow}>
                      <FormField label="Stock Limitato" name="hasLimitedStock" type="checkbox"
                        checked={formData.shopSettings?.hasLimitedStock ?? false}
                        onChange={(e: any) => handleNestedChange('shopSettings', 'hasLimitedStock', e.target.checked)} />
                      {formData.shopSettings?.hasLimitedStock && (
                        <FormField label="Stock Default" name="defaultStock" type="number"
                          value={formData.shopSettings?.defaultStock ?? ''}
                          onChange={(e: any) => handleNestedChange('shopSettings', 'defaultStock', e.target.value ? parseInt(e.target.value) : undefined)} />
                      )}
                    </div>
                    {formData.shopSettings?.hasLimitedStock && (
                      <div className={styles.formRow}>
                        <FormField label="Intervallo Restock" name="restockInterval"
                          value={formData.shopSettings?.restockInterval || ''}
                          onChange={(e: any) => handleNestedChange('shopSettings', 'restockInterval', e.target.value || undefined)}
                          placeholder="es. daily, weekly" />
                        <FormField label="Quantità Restock" name="restockQuantity" type="number"
                          value={formData.shopSettings?.restockQuantity ?? ''}
                          onChange={(e: any) => handleNestedChange('shopSettings', 'restockQuantity', e.target.value ? parseInt(e.target.value) : undefined)} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab: Finanza */}
                <div className={styles.slidePanel}>
                  <div className={styles.tabContent}>
                    <FormField label="Idoneo per Credito" name="eligibleForCredit" type="checkbox"
                      checked={formData.financialSettings?.eligibleForCredit ?? true}
                      onChange={(e: any) => handleNestedChange('financialSettings', 'eligibleForCredit', e.target.checked)}
                      helpText="L'item può essere acquistato usando la linea di credito" />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Modal>
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
