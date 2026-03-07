/**
 * User List Page
 *
 * Pagina gestione utenti con ConfigurableDataTable, SidePanel, e TanStack Query.
 * Max 200 linee per mantenibilità.
 */

import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable, FilterState } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { ContextMenu, ContextMenuItem } from '@/components/shared/ContextMenu';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useUsers, useUpdateUser, useDeleteUser, useBanUser, useUnbanUser, useBulkActivateUsers, useBulkDeactivateUsers } from '@/hooks/api/useUsers';
import { useNotificationStore } from '@/store/notificationStore';
import { useURLFilter } from '@/hooks/useURLFilter';
import { encodeFilter, clearFilterHash } from '@/lib/utils/urlFilters';
import type { User, UserListParams, BanUserData } from '@/types/api/User';
import styles from '@/styles/pages/UserList.module.scss';

export default function UserList() {
  // State
  const { filters, params, setParams, handleFilterChange } = useTableFilters<UserListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'registrationInfo.registeredAt',
    sortOrder: 'desc'
  });
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [activeSidePanel, setActiveSidePanel] = useState<'edit' | 'view' | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Hooks
  const router = useRouter();
  const urlFilter = useURLFilter<{ characterId?: string }>();

  // Apply URL filter to params
  const filteredParams = useMemo(() => {
    if (urlFilter?.characterId) {
      return { ...params, characterId: urlFilter.characterId };
    }
    return params;
  }, [params, urlFilter]);

  const { data, isLoading, error } = useUsers(filteredParams);
  const tableConfig = useTableConfig('user-list');
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const bulkActivate = useBulkActivateUsers();
  const bulkDeactivate = useBulkDeactivateUsers();
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
   * Build context menu items for user row
   */
  const getMenuItems = (user: User): ContextMenuItem[] => {
    const characterCount = user.characters?.length || 0;

    return [
      {
        key: 'edit',
        label: 'Modifica',
        icon: '✏️',
        onClick: () => handleAction('edit', user)
      },
      {
        key: 'characters',
        label: `Personaggi (${characterCount})`,
        icon: '🔓',
        onClick: () => {
          const filter = encodeFilter({ userId: user._id });
          router.push(`/characters/character-list#filter=${filter}`);
        },
        disabled: characterCount === 0,
        dividerAfter: true
      },
      {
        key: 'delete',
        label: 'Elimina',
        icon: '🗑️',
        variant: 'danger',
        onClick: () => handleAction('delete', user)
      }
    ];
  };

  /**
   * Handler azioni row
   */
  const handleAction = async (action: string, user: User) => {
    try {
      switch (action) {
        case 'edit':
          setCurrentUser(user);
          setActiveSidePanel('edit');
          break;

        case 'delete': {
          const confirmed = await confirm({
            title: 'Conferma Eliminazione',
            message: `Sei sicuro di voler eliminare ${user.username}? Questa azione è irreversibile.`
          });

          if (confirmed) {
            await deleteUser.mutateAsync(user._id);
            addNotification({ type: 'success', message: `${user.username} eliminato` });
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
    if (action === 'save' && currentUser) {
      try {
        await updateUser.mutateAsync({
          id: currentUser._id,
          data: formData
        });

        addNotification({ type: 'success', message: 'Utente aggiornato con successo' });
        setActiveSidePanel(null);
        setCurrentUser(null);
      } catch (error) {
        addNotification({
          type: 'error',
          message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
        });
      }
    } else if (action === 'cancel') {
      setActiveSidePanel(null);
      setCurrentUser(null);
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
  const handleBulkAction = async (actionKey: string, items: User[], allPagesSelected: boolean = false) => {
    try {
      if (allPagesSelected) {
        addNotification({
          type: 'warning',
          message: 'Bulk action per tutte le pagine non ancora implementato'
        });
        return;
      }

      if (actionKey === 'bulk-activate') {
        const confirmed = await confirm({
          title: 'Conferma Attivazione Multipla',
          message: `Vuoi attivare ${items.length} utenti selezionati?`,
          confirmLabel: 'Attiva',
          type: 'info'
        });

        if (!confirmed) return;

        // Execute bulk activate with dedicated endpoint
        const userIds = items.map(user => user._id);
        const result = await bulkActivate.mutateAsync(userIds);

        if (result.failed > 0) {
          addNotification({
            type: 'warning',
            message: `${result.success} utenti attivati, ${result.failed} falliti`
          });
        } else {
          addNotification({
            type: 'success',
            message: `${result.success} utenti attivati con successo`
          });
        }

        // Clear selection
        setSelectedUsers([]);
      } else if (actionKey === 'bulk-deactivate') {
        const confirmed = await confirm({
          title: 'Conferma Disattivazione Multipla',
          message: `Vuoi disattivare ${items.length} utenti selezionati? Gli utenti non potranno più accedere al sistema.`,
          confirmLabel: 'Disattiva',
          type: 'danger'
        });

        if (!confirmed) return;

        // Execute bulk deactivate with dedicated endpoint
        const userIds = items.map(user => user._id);
        const result = await bulkDeactivate.mutateAsync(userIds);

        if (result.failed > 0) {
          addNotification({
            type: 'warning',
            message: `${result.success} utenti disattivati, ${result.failed} falliti`
          });
        } else {
          addNotification({
            type: 'success',
            message: `${result.success} utenti disattivati con successo`
          });
        }

        // Clear selection
        setSelectedUsers([]);
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
          <h2>Errore nel caricamento utenti</h2>
          <p>{error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Gestione Utenti - Ten Penny Novels Management</title>
      </Head>

      <div className={styles.userList}>
        <header className={styles.header}>
          <h1>Gestione Utenti</h1>
          <p>Totale: {data?.pagination.totalItems ?? 0} utenti</p>
        </header>

        {/* Filter Badge */}
        {urlFilter?.characterId && (
          <div className={styles.filterBadge}>
            <span className={styles.filterLabel}>
              🔓 Filtrato per personaggio
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

        <ConfigurableDataTable<User>
          tableName="user-list"
          data={data?.items ?? []}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          renderActions={(user) => (
            <ContextMenu
              items={getMenuItems(user)}
              position="left"
              ariaLabel={`Menu azioni per ${user.username}`}
            />
          )}
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
          selectedItems={selectedUsers}
          onSelectionChange={setSelectedUsers}
          onBulkAction={handleBulkAction}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config,
            visibleColumns: visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue
          } : undefined}
        />

        {activeSidePanel === 'edit' && currentUser && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Modifica ${currentUser.username}`,
              width: 'medium',
              fields: [
                { key: 'displayName', label: 'Nome Visualizzato', type: 'text', required: true, disabled: false },
                { key: 'email', label: 'Email', type: 'email', required: true, disabled: false },
                { key: 'canAccessAdminPanel', label: 'Accesso Admin Panel', type: 'checkbox', required: false, disabled: false },
                { key: 'accountStatus.isActive', label: 'Account Attivo', type: 'checkbox', required: false, disabled: false },
                { key: 'accountStatus.isEmailVerified', label: 'Email Verificata', type: 'checkbox', required: false, disabled: false }
              ],
              actions: [
                { key: 'save', label: 'Salva', type: 'primary', loading: false },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              displayName: currentUser.displayName,
              email: currentUser.email,
              canAccessAdminPanel: currentUser.canAccessAdminPanel,
              'accountStatus.isActive': currentUser.accountStatus.isActive,
              'accountStatus.isEmailVerified': currentUser.accountStatus.isEmailVerified
            }}
            onAction={handleSidePanelAction}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentUser(null);
            }}
          />
        )}

        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
