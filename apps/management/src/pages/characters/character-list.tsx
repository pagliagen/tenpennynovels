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
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import {
  useCharacters,
  useUpdateCharacter,
  useDeleteCharacter,
  useApproveCharacter,
  useRejectCharacter
} from '@/hooks/api/useCharacters';
import { useNotificationStore } from '@/store/notificationStore';
import { useURLFilter } from '@/hooks/useURLFilter';
import { clearFilterHash } from '@/lib/utils/urlFilters';
import type { Character, CharacterListParams } from '@/types/api/Character';
import styles from '@/styles/pages/CharacterList.module.scss';

export default function CharacterList() {
  // State
  const [params, setParams] = useState<CharacterListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'metadata.createdAt',
    sortOrder: 'desc'
  });
  const [activeSidePanel, setActiveSidePanel] = useState<'edit' | 'view' | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(null);

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
          const confirmed = await confirm({
            title: 'Conferma Rifiuto',
            message: `Sei sicuro di voler rifiutare ${character.fullName}?`
          });

          if (confirmed) {
            const reason = prompt('Motivo del rifiuto:');
            if (!reason) {
              addNotification({ type: 'warning', message: 'Rifiuto annullato: motivo obbligatorio' });
              return;
            }

            await rejectCharacter.mutateAsync({ id: character._id, data: { reason } });
            addNotification({ type: 'success', message: `${character.fullName} rifiutato` });
          }
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
   * Handler pagination
   */
  const handlePageChange = (page: number) => {
    setParams(prev => ({ ...prev, page }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setParams(prev => ({ ...prev, pageSize, page: 1 }));
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

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
