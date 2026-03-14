/**
 * Character Pending Page
 *
 * Pagina personaggi in attesa di approvazione con ConfigurableDataTable.
 * Filtro fisso: status=pending
 */

import React, { useState, useMemo, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable, FilterState } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useURLFilter } from '@/hooks/useURLFilter';
import { clearFilterHash } from '@/lib/utils/urlFilters';
import {
  useCharacters,
  useApproveCharacter,
  useRejectCharacter,
  useBulkApproveCharacters,
  useBulkRejectCharacters
} from '@/hooks/api/useCharacters';
import { useNotificationStore } from '@/store/notificationStore';
import type { Character, CharacterListParams } from '@/types/api/Character';
import styles from '@/styles/pages/CharacterList.module.scss';

export default function CharacterPending() {
  // State
  const [params, setParams] = useState<CharacterListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'metadata.createdAt',
    sortOrder: 'desc',
    status: 'pending' // CRITICAL: Fixed filter for pending characters
  });
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);
  const [activeSidePanel, setActiveSidePanel] = useState<boolean>(false);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);

  // URL filter (from notification click or external link)
  const urlFilter = useURLFilter<{ search?: string }>();
  const [defaultSearch, setDefaultSearch] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (urlFilter?.search) {
      setDefaultSearch(urlFilter.search);
      clearFilterHash();
    }
  }, [urlFilter]);

  // Hooks
  const { data, isLoading, error } = useCharacters(params);
  const tableConfig = useTableConfig('character-pending');
  const approveCharacter = useApproveCharacter();
  const rejectCharacter = useRejectCharacter();
  const bulkApprove = useBulkApproveCharacters();
  const bulkReject = useBulkRejectCharacters();
  const { confirm, confirmWithInput, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  // Prepare visible columns
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
        case 'view-details':
          setCurrentCharacter(character);
          setActiveSidePanel(true);
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
          const { confirmed, inputValue: reason } = await confirmWithInput({
            title: 'Conferma Rifiuto',
            message: `Sei sicuro di voler rifiutare ${character.fullName}?`,
            confirmLabel: 'Rifiuta',
            type: 'danger',
            input: {
              placeholder: 'Motivo del rifiuto...',
              required: true,
              multiline: true
            }
          });

          if (confirmed && reason) {
            await rejectCharacter.mutateAsync({ id: character._id, data: { note: reason.trim() } });
            addNotification({ type: 'success', message: `${character.fullName} rifiutato` });
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
   * Handler filtering
   */
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setParams(prev => ({ ...prev, ...newFilters, page: 1, status: 'pending' })); // Keep status=pending
  };

  /**
   * Handler bulk actions
   */
  const handleBulkAction = async (actionKey: string, items: Character[], allPagesSelected: boolean = false) => {
    try {
      if (actionKey === 'bulk-approve') {
        if (allPagesSelected) {
          addNotification({
            type: 'warning',
            message: 'Approvazione massiva per tutte le pagine non ancora implementata'
          });
          return;
        }

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
        if (allPagesSelected) {
          addNotification({
            type: 'warning',
            message: 'Rifiuto massivo per tutte le pagine non ancora implementato'
          });
          return;
        }

        const { confirmed, inputValue: reason } = await confirmWithInput({
          title: 'Conferma Rifiuto Multiplo',
          message: `Vuoi rifiutare ${items.length} personaggi selezionati? Torneranno in stato DRAFT.`,
          confirmLabel: 'Rifiuta',
          type: 'danger',
          input: {
            placeholder: 'Motivo del rifiuto...',
            required: true,
            multiline: true
          }
        });

        if (!confirmed || !reason) return;

        const characterIds = items.map(c => c._id);
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
        <title>Ten Penny Novels | Personaggi In Attesa</title>
      </Head> 

      <div className={styles.characterList}>
        <header className={styles.header}>
          <h1>⏳ Personaggi In Attesa di Approvazione</h1>
          <p>Totale: {data?.pagination.totalItems ?? 0} personaggi</p>
        </header>

        <ConfigurableDataTable<Character>
          tableName="character-pending"
          data={data?.list ?? []}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          defaultSearch={defaultSearch}
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

        {/* Side Panel: View Details */}
        {activeSidePanel && currentCharacter && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Dettagli: ${currentCharacter.fullName}`,
              width: 'large',
              fields: [
                { key: 'fullName', label: 'Nome Completo', type: 'text', required: false, disabled: true },
                { key: 'age', label: 'Età', type: 'text', required: false, disabled: true },
                { key: 'occupation', label: 'Occupazione', type: 'text', required: false, disabled: true },
                { key: 'socialClass', label: 'Classe Sociale', type: 'text', required: false, disabled: true },
                { key: 'personality', label: 'Personalità', type: 'textarea', required: false, disabled: true },
                { key: 'backstory', label: 'Background', type: 'textarea', required: false, disabled: true }
              ],
              actions: [
                { key: 'close', label: 'Chiudi', type: 'secondary', loading: false }
              ]
            }}
            data={{
              fullName: currentCharacter.fullName,
              age: currentCharacter.age?.toString() || 'N/A',
              occupation: currentCharacter.occupation?.name || 'N/A',
              socialClass: currentCharacter.socialClass?.name || 'N/A',
              personality: currentCharacter.biography?.personality || 'N/A',
              backstory: currentCharacter.biography?.background || 'N/A'
            }}
            onAction={(action) => {
              if (action === 'close') {
                setActiveSidePanel(false);
                setCurrentCharacter(null);
              }
            }}
            onClose={() => {
              setActiveSidePanel(false);
              setCurrentCharacter(null);
            }}
          />
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
