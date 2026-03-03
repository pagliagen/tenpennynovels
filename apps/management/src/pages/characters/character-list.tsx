/**
 * Character List Page
 *
 * Pagina gestione personaggi con ConfigurableDataTable, SidePanel, e TanStack Query.
 * Max 200 linee per mantenibilità.
 */

import React, { useState, useMemo, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable, FilterState } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import {
  useCharacters,
  useUpdateCharacter,
  useDeleteCharacter,
  useApproveCharacter,
  useRejectCharacter,
  useBulkApproveCharacters,
  useBulkRejectCharacters,
  useBulkDeleteCharacters
} from '@/hooks/api/useCharacters';
import { useNotificationStore } from '@/store/notificationStore';
import { useURLFilter } from '@/hooks/useURLFilter';
import { clearFilterHash } from '@/lib/utils/urlFilters';
import type { Character, CharacterListParams } from '@/types/api/Character';
import styles from '@/styles/pages/CharacterList.module.scss';

export default function CharacterList() {
  // State
  const { filters, params, setParams, handleFilterChange } = useTableFilters<CharacterListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'metadata.createdAt',
    sortOrder: 'desc'
  });
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [activeSidePanel, setActiveSidePanel] = useState<'edit' | 'view' | 'reject' | 'bulk-reject' | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);
  const [characterToReject, setCharacterToReject] = useState<Character | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [bulkRejectCharacters, setBulkRejectCharacters] = useState<Character[]>([]);
  const [bulkRejectReason, setBulkRejectReason] = useState<string>('');

  // Hooks
  const router = useRouter();
  const urlFilter = useURLFilter<{ userId?: string }>();

  // Apply URL filter to params
  const filteredParams = useMemo(() => {
    if (urlFilter?.userId) {
      return { ...params, userId: urlFilter.userId };
    }
    return params;
  }, [params, urlFilter]);

  const { data, isLoading, error } = useCharacters(filteredParams);
  const tableConfig = useTableConfig('character-list');
  const updateCharacter = useUpdateCharacter();
  const deleteCharacter = useDeleteCharacter();
  const approveCharacter = useApproveCharacter();
  const rejectCharacter = useRejectCharacter();
  const bulkApprove = useBulkApproveCharacters();
  const bulkReject = useBulkRejectCharacters();
  const bulkDelete = useBulkDeleteCharacters();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  // Prepare visible columns for ConfigurableDataTable
  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(
      col => tableConfig.columnVisibility[col.key] !== false
    );
  }, [tableConfig.config, tableConfig.columnVisibility]);

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

        case 'approve': {
          const confirmed = await confirm({
            title: 'Conferma Approvazione',
            message: `Sei sicuro di voler approvare ${character.fullName}?`
          });

          if (confirmed) {
            await approveCharacter.mutateAsync({ id: character._id });
            addNotification({ type: 'success', message: `${character.fullName} approvato con successo` });
          }
          break;
        }

        case 'reject': {
          // Open SidePanel to request rejection reason (like ban system)
          setCharacterToReject(character);
          setRejectReason('');
          setActiveSidePanel('reject');
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
          data: formData
        });

        addNotification({ type: 'success', message: 'Personaggio aggiornato con successo' });
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
   * Handler reject submit
   */
  const handleRejectSubmit = async (reason: string) => {
    if (!characterToReject || !reason?.trim()) {
      addNotification({ type: 'error', message: 'Motivo del rifiuto obbligatorio' });
      return;
    }

    try {
      await rejectCharacter.mutateAsync({
        id: characterToReject._id,
        data: { reason: reason.trim() }
      });
      addNotification({ type: 'success', message: `${characterToReject.fullName} rifiutato` });
      setActiveSidePanel(null);
      setCharacterToReject(null);
      setRejectReason('');
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel rifiuto del personaggio'
      });
    }
  };

  /**
   * Handler bulk reject submit
   */
  const handleBulkRejectSubmit = async (reason: string) => {
    if (bulkRejectCharacters.length === 0 || !reason?.trim()) {
      addNotification({ type: 'error', message: 'Motivo del rifiuto obbligatorio' });
      return;
    }

    try {
      const characterIds = bulkRejectCharacters.map(c => c._id);
      const result = await bulkReject.mutateAsync({ characterIds, reason: reason.trim() });

      if (result.failed > 0) {
        addNotification({
          type: 'warning',
          message: `${result.success} personaggi rifiutati, ${result.failed} falliti`
        });
      } else {
        addNotification({
          type: 'success',
          message: `${result.success} personaggi rifiutati con successo`
        });
      }

      setActiveSidePanel(null);
      setBulkRejectCharacters([]);
      setBulkRejectReason('');
      setSelectedCharacters([]);
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel rifiuto multiplo'
      });
    }
  };

  /**
   * Handler pagination
   */
  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setParams(prev => ({ ...prev, pageSize, page: 1 }));
  };

  /**
   * Handler sorting
   */
  const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setParams(prev => ({ ...prev, sortBy, sortOrder, page: 1 }));
  };


  /**
   * Handler bulk actions
   */
  const handleBulkAction = async (actionKey: string, items: Character[], allPagesSelected: boolean = false) => {
    try {
      if (allPagesSelected) {
        addNotification({
          type: 'warning',
          message: 'Bulk action per tutte le pagine non ancora implementato'
        });
        return;
      }

      if (actionKey === 'bulk-approve') {
        const confirmed = await confirm({
          title: 'Conferma Approvazione Multipla',
          message: `Vuoi approvare ${items.length} personaggi selezionati? Verranno creati finanziamenti e inventari iniziali.`,
          confirmLabel: 'Approva',
          type: 'info'
        });

        if (!confirmed) return;

        const characterIds = items.map(c => c._id);
        const result = await bulkApprove.mutateAsync(characterIds);

        if (result.failed > 0) {
          addNotification({
            type: 'warning',
            message: `${result.success} personaggi approvati, ${result.failed} falliti`
          });
        } else {
          addNotification({
            type: 'success',
            message: `${result.success} personaggi approvati con successo`
          });
        }

        setSelectedCharacters([]);
      } else if (actionKey === 'bulk-reject') {
        // Open SidePanel to request rejection reason
        setBulkRejectCharacters(items);
        setBulkRejectReason('');
        setActiveSidePanel('bulk-reject');
        return;
      } else if (actionKey === 'bulk-delete') {
        const confirmed = await confirm({
          title: 'Conferma Eliminazione Multipla',
          message: `Vuoi eliminare ${items.length} personaggi selezionati? Questa azione è irreversibile.`,
          confirmLabel: 'Elimina',
          type: 'danger'
        });

        if (!confirmed) return;

        const characterIds = items.map(c => c._id);
        const result = await bulkDelete.mutateAsync(characterIds);

        if (result.failed > 0) {
          addNotification({
            type: 'warning',
            message: `${result.success} personaggi eliminati, ${result.failed} falliti`
          });
        } else {
          addNotification({
            type: 'success',
            message: `${result.success} personaggi eliminati con successo`
          });
        }

        setSelectedCharacters([]);
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'esecuzione bulk action'
      });
    }
  };

  /**
   * Render error state
   */
  if (error) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento personaggi</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Gestione Personaggi - TenpennyNovels Management</title>
      </Head>

      <div className={styles.characterList}>
        <header className={styles.header}>
          <h1>Gestione Personaggi</h1>
          <p>Totale: {data?.pagination.totalItems ?? 0} personaggi</p>
        </header>

        {/* Filter Badge */}
        {urlFilter?.userId && (
          <div className={styles.filterBadge}>
            <span className={styles.filterLabel}>
              🔓 Filtrato per utente
            </span>
            <button
              className={styles.filterRemove}
              onClick={() => {
                clearFilterHash();
                router.reload();
              }}
              title="Rimuovi filtro"
            >
              ✕
            </button>
          </div>
        )}

        <ConfigurableDataTable<Character>
          tableName="character-list"
          data={data?.items ?? []}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          pagination={{
            page: params.page,
            pageSize: params.pageSize,
            total: data?.pagination.totalItems ?? 0,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange
          }}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortChange={handleSortChange}
          filters={filters}
          onFilterChange={handleFilterChange}
          selectedItems={selectedCharacters}
          onSelectionChange={setSelectedCharacters}
          onBulkAction={handleBulkAction}
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
              fields: [
                { key: 'name', label: 'Nome', type: 'text', required: true, disabled: false },
                { key: 'surname', label: 'Cognome', type: 'text', required: true, disabled: false },
                { key: 'age', label: 'Età', type: 'number', required: true, disabled: false },
                { key: 'status', label: 'Stato', type: 'select', required: true, disabled: false, options: [
                  { value: 'pending', label: 'In Attesa' },
                  { value: 'approved', label: 'Approvato' },
                  { value: 'rejected', label: 'Rifiutato' },
                  { value: 'active', label: 'Attivo' },
                  { value: 'inactive', label: 'Inattivo' }
                ]}
              ],
              actions: [
                { key: 'save', label: 'Salva', type: 'primary', loading: false },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              name: currentCharacter.name,
              surname: currentCharacter.surname,
              age: currentCharacter.age,
              status: currentCharacter.status
            }}
            onAction={handleSidePanelAction}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentCharacter(null);
            }}
          />
        )}

        {/* Side Panel: Reject Character */}
        {activeSidePanel === 'reject' && characterToReject && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Rifiuta ${characterToReject.fullName}`,
              width: 'medium',
              fields: [
                { key: 'characterName', label: 'Personaggio', type: 'text', required: false, disabled: true },
                { key: 'userName', label: 'Giocatore', type: 'text', required: false, disabled: true },
                {
                  key: 'rejectReason',
                  label: 'Motivo Rifiuto',
                  type: 'textarea',
                  required: false,
                  disabled: false,
                  placeholder: 'Inserisci il motivo del rifiuto (obbligatorio)...'
                }
              ],
              actions: [
                { key: 'submit', label: 'Rifiuta Personaggio', type: 'danger', loading: rejectCharacter.isPending },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              characterName: characterToReject.fullName,
              userName: characterToReject.user?.username || 'Unknown',
              rejectReason: ''
            }}
            onAction={(action, formData) => {
              if (action === 'submit') {
                const reason = formData.rejectReason as string;
                handleRejectSubmit(reason);
              } else if (action === 'cancel') {
                setActiveSidePanel(null);
                setCharacterToReject(null);
                setRejectReason('');
              }
            }}
            onClose={() => {
              setActiveSidePanel(null);
              setCharacterToReject(null);
              setRejectReason('');
            }}
          />
        )}

        {/* Side Panel: Bulk Reject Characters */}
        {activeSidePanel === 'bulk-reject' && bulkRejectCharacters.length > 0 && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Rifiuta ${bulkRejectCharacters.length} personaggi`,
              width: 'medium',
              fields: [
                {
                  key: 'characters',
                  label: 'Personaggi Selezionati',
                  type: 'text',
                  required: false,
                  disabled: true
                },
                {
                  key: 'bulkRejectReason',
                  label: 'Motivo Rifiuto (applicato a tutti)',
                  type: 'textarea',
                  required: false,
                  disabled: false,
                  placeholder: 'Inserisci il motivo del rifiuto che verrà applicato a tutti i personaggi selezionati...'
                }
              ],
              actions: [
                {
                  key: 'submit',
                  label: `Rifiuta ${bulkRejectCharacters.length} Personaggi`,
                  type: 'danger',
                  loading: bulkReject.isPending
                },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              characters: bulkRejectCharacters.map(c => c.fullName).join(', '),
              bulkRejectReason: ''
            }}
            onAction={(action, formData) => {
              if (action === 'submit') {
                const reason = formData.bulkRejectReason as string;
                handleBulkRejectSubmit(reason);
              } else if (action === 'cancel') {
                setActiveSidePanel(null);
                setBulkRejectCharacters([]);
                setBulkRejectReason('');
              }
            }}
            onClose={() => {
              setActiveSidePanel(null);
              setBulkRejectCharacters([]);
              setBulkRejectReason('');
            }}
          />
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
