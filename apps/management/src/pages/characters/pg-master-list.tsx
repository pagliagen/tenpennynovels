/**
 * PG Master List Page
 * Shows only characters with characterType='pg_master'
 */

import React, { useState, useMemo, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useConfirm } from '@/hooks/useConfirm';
import { useNotificationStore } from '@/store/notificationStore';
import {
  useCharacters,
  useUpdateCharacter,
  useDeleteCharacter,
  useChangeReferent
} from '@/hooks/api/useCharacters';
import * as characterAPI from '@/lib/api/characters';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { GenerateImageButton } from '@/components/shared/GenerateImageButton';
import { FormField } from '@/components/shared/FormField';
import type { Character, CharacterListParams } from '@/types/api/Character';
import styles from '@/styles/pages/CharacterList.module.scss';

export default function PGMasterList() {
  const router = useRouter();

  // State
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [activeSidePanel, setActiveSidePanel] = useState<'edit' | 'view' | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [changeReferentPanelOpen, setChangeReferentPanelOpen] = useState(false);
  const [characterToChangeReferent, setCharacterToChangeReferent] = useState<Character | null>(null);
  const [availablePGPrincipali, setAvailablePGPrincipali] = useState<Character[]>([]);
  const [editFormData, setEditFormData] = useState({ avatar: '' });

  const { filters, params, setParams, handleFilterChange } = useTableFilters<CharacterListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'metadata.createdAt',
    sortOrder: 'desc',
    characterType: 'pg_master' // FILTER BY TYPE
  });

  const { data, isLoading } = useCharacters(params);
  const tableConfig = useTableConfig('pg-master-list');
  const updateCharacter = useUpdateCharacter();
  const deleteCharacter = useDeleteCharacter();
  const changeReferent = useChangeReferent();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  // Prepare visible columns for ConfigurableDataTable
  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

  // Initialize form data when character is selected for editing
  useEffect(() => {
    if (currentCharacter) {
      setEditFormData({ avatar: currentCharacter.avatar || '' });
    }
  }, [currentCharacter]);

  // Handle form field changes for custom fields
  const handleFormChange = (field: string, value: any) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Fetch ALL available PG principale (approved)
   * Changing referent = changing owner, so we need all PG from all users
   */
  const fetchAvailablePGPrincipali = async () => {
    try {
      const fetchParams: CharacterListParams = {
        page: 1,
        pageSize: 500, // Get all PG principale (unlikely to have more than 500)
        characterType: 'pg_principale',
        status: 'approved',
        sortBy: 'name',
        sortOrder: 'asc'
      };
      const response = await characterAPI.getCharacters(fetchParams);
      setAvailablePGPrincipali(response.list);
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'Errore nel caricamento PG principali'
      });
      setAvailablePGPrincipali([]);
    }
  };

  /**
   * Handler azioni row
   */
  const handleAction = async (action: string, character: Character) => {
    try {
      switch (action) {
        case 'edit':
          setCurrentCharacter(character);
          setActiveSidePanel('edit');
          break;

        case 'view-details':
          setCurrentCharacter(character);
          setActiveSidePanel('view');
          break;

        case 'change-referent': {
          setCharacterToChangeReferent(character);
          // Fetch ALL PG principali (changing referent = changing owner)
          fetchAvailablePGPrincipali().then(() => {
            setChangeReferentPanelOpen(true);
          });
          break;
        }

        case 'delete': {
          const confirmed = await confirm({
            title: 'Conferma Eliminazione',
            message: `Sei sicuro di voler eliminare ${character.fullName}? Questa azione è irreversibile.`
          });

          if (confirmed) {
            await deleteCharacter.mutateAsync(character._id);
            addNotification({ type: 'success', message: `${character.fullName} eliminato` });
          }
          break;
        }

        default:
          addNotification({ type: 'info', message: `Azione "${action}" non implementata` });
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'esecuzione azione'
      });
    }
  };

  /**
   * Handler SidePanel save
   */
  const handleSidePanelAction = async (action: string, formData: Record<string, unknown>) => {
    if (action === 'save' && currentCharacter) {
      try {
        await updateCharacter.mutateAsync({
          id: currentCharacter._id,
          data: { ...formData, avatar: editFormData.avatar }
        });
        addNotification({ type: 'success', message: 'Master aggiornato con successo' });
        setActiveSidePanel(null);
        setCurrentCharacter(null);
      } catch (error) {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
        });
      }
    } else if (action === 'cancel') {
      setActiveSidePanel(null);
      setCurrentCharacter(null);
    }
  };

  /**
   * Handler change referent submit
   */
  const handleChangeReferentSubmit = async (newReferentId: string) => {
    if (!characterToChangeReferent || !newReferentId) {
      addNotification({ type: 'error', message: 'Seleziona un PG principale' });
      return;
    }

    try {
      await changeReferent.mutateAsync({
        characterId: characterToChangeReferent._id,
        newReferentId
      });

      addNotification({
        type: 'success',
        message: `Referente di ${characterToChangeReferent.fullName} aggiornato con successo`
      });

      setChangeReferentPanelOpen(false);
      setCharacterToChangeReferent(null);
      setAvailablePGPrincipali([]);
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel cambio referente'
      });
    }
  };

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Master Characters</title>
      </Head>
      <div className={styles.characterList}>
        <header className={styles.header}>
          <h1>Master Characters</h1>
          <p>Totale: {data?.pagination.totalItems ?? 0} master</p>
        </header>
        <ConfigurableDataTable<Character>
          tableName="pg-master-list"
          data={data?.list ?? []}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          selectedItems={selectedCharacters}
          onSelectionChange={setSelectedCharacters}
          pagination={{
            page: params.page,
            pageSize: params.pageSize,
            total: data?.pagination.totalItems ?? 0,
            onPageChange: (page) => setParams({ ...params, page }),
            onPageSizeChange: (pageSize) => setParams({ ...params, pageSize, page: 1 })
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={(sortBy, sortOrder) => setParams({ ...params, sortBy, sortOrder })}
          filters={filters}
          onFilterChange={handleFilterChange}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config,
            visibleColumns: visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue
          } : undefined}
        />

        {activeSidePanel === 'edit' && currentCharacter && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Modifica ${currentCharacter.fullName}`,
              width: 'medium',
              fields: [],
              actions: [
                { key: 'save', label: 'Salva', type: 'primary', loading: false },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              name: currentCharacter.name,
              surname: currentCharacter.surname
            }}
            customContent={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <FormField label="Nome" name="name" value={currentCharacter.name} disabled type="text" />
                <FormField label="Cognome" name="surname" value={currentCharacter.surname || ''} disabled type="text" />

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  <h3 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                    Avatar
                  </h3>

                  <ImageUploader
                    value={editFormData.avatar || ''}
                    onChange={(url) => handleFormChange('avatar', url)}
                    entityType="characters"
                    entityId={currentCharacter._id}
                  />

                  <GenerateImageButton
                    entityType="character"
                    entityId={currentCharacter._id}
                    entityName={`${currentCharacter.name} ${currentCharacter.surname || ''}`.trim()}
                    onSuccess={(url) => handleFormChange('avatar', url)}
                  />
                </div>
              </div>
            }
            onAction={handleSidePanelAction}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentCharacter(null);
            }}
          />
        )}

        {changeReferentPanelOpen && characterToChangeReferent && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Cambia PG di Riferimento - ${characterToChangeReferent.fullName}`,
              width: 'medium',
              fields: [],
              actions: [
                { key: 'submit', label: 'Cambia Riferimento', type: 'primary', loading: changeReferent.isPending },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              currentReferent: (characterToChangeReferent as any).referent?.name || 'Nessuno',
              newReferent: ''
            }}
            customContent={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                    PG Attuale
                  </label>
                  <input
                    type="text"
                    value={(characterToChangeReferent as any).referent?.name || 'Nessuno'}
                    disabled
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '14px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      color: 'rgba(255,255,255,0.5)',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="newReferent" style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                    Nuovo PG di Riferimento *
                  </label>
                  <select
                    id="newReferent"
                    name="newReferent"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '14px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '4px',
                      color: 'rgba(255,255,255,0.9)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">Seleziona nuovo PG principale...</option>
                    {availablePGPrincipali.map(pg => (
                      <option key={pg._id} value={pg._id}>
                        {pg.fullName}
                      </option>
                    ))}
                  </select>
                  {availablePGPrincipali.length === 0 && (
                    <p style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,193,7,0.9)' }}>
                      ⚠ Nessun PG principale approvato disponibile nel sistema
                    </p>
                  )}
                </div>
              </div>
            }
            onAction={async (action, formData) => {
              if (action === 'submit') {
                const select = document.getElementById('newReferent') as HTMLSelectElement;
                const newReferentId = select?.value;
                if (newReferentId) {
                  await handleChangeReferentSubmit(newReferentId);
                } else {
                  addNotification({ type: 'error', message: 'Seleziona un PG principale' });
                }
              } else if (action === 'cancel') {
                setChangeReferentPanelOpen(false);
                setCharacterToChangeReferent(null);
              }
            }}
            onClose={() => {
              setChangeReferentPanelOpen(false);
              setCharacterToChangeReferent(null);
            }}
          />
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
