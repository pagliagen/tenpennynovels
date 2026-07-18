/**
 * Ban List Page - User Ban Management
 *
 * Gestione ban/unban utenti.
 * Mostra TUTTI gli utenti con filtri per status ban.
 */

import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable, FilterState } from '@/components/shared/ConfigurableDataTable';
import { SidePanel } from '@/components/shared/SidePanel';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useUsers, useBanUser, useUnbanUser, useBulkBanUsers, useBulkUnbanUsers } from '@/hooks/api/useUsers';
import { useNotificationStore } from '@/store/notificationStore';
import { useURLFilter } from '@/hooks/useURLFilter';
import { clearFilterHash } from '@/lib/utils/urlFilters';
import type { User, UserListParams } from '@/types/api/User';
import styles from '@/styles/pages/UserList.module.scss';
import { logger } from '@/lib/logger';

export default function BanList() {
  // State
  const { filters, params, setParams, handleFilterChange } = useTableFilters<UserListParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc'
    // Nessun filtro fisso - mostra TUTTI gli utenti
  });
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [activeSidePanel, setActiveSidePanel] = useState<'view' | 'ban' | 'bulk-ban' | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [banReason, setBanReason] = useState<string>('');
  const [bulkBanUsers_state, setBulkBanUsers_state] = useState<User[]>([]);
  const [bulkBanReason, setBulkBanReason] = useState<string>('');

  // Hooks
  const urlFilter = useURLFilter<{ characterId?: string }>();

  // Apply URL filter to params
  const filteredParams = useMemo(() => {
    if (urlFilter?.characterId) {
      return { ...params, characterId: urlFilter.characterId };
    }
    return params;
  }, [params, urlFilter]);

  const { data, isLoading, error } = useUsers(filteredParams);
  const tableConfig = useTableConfig('ban-list');
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const bulkBanUsers = useBulkBanUsers();
  const bulkUnbanUsers = useBulkUnbanUsers();
  const { confirm, ConfirmDialogComponent } = useConfirm();
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
  const handleAction = async (action: string, user: User) => {
    try {
      switch (action) {
        case 'ban': {
          // Open side panel for ban reason
          setCurrentUser(user);
          setBanReason('');
          setActiveSidePanel('ban');
          break;
        }

        case 'unban': {
          const confirmed = await confirm({
            title: 'Conferma Rimozione Ban',
            message: `Sei sicuro di voler rimuovere il ban per ${user.username}?`
          });

          if (confirmed) {
            await unbanUser.mutateAsync(user._id);
            addNotification({ type: 'success', message: `Ban rimosso per ${user.username}` });
          }
          break;
        }

        case 'view-details':
          setCurrentUser(user);
          setActiveSidePanel('view');
          break;

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
   * Helper to calculate bannedUntil based on duration
   */
  const calculateBannedUntil = (duration: string): Date | undefined => {
    if (duration === 'permanent') return undefined;

    const now = new Date();
    const durations: Record<string, number> = {
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000
    };

    const milliseconds = durations[duration];
    if (!milliseconds) return undefined;

    return new Date(now.getTime() + milliseconds);
  };

  /**
   * Handler ban submit
   */
  const handleBanSubmit = async (reason: string, duration: string) => {
    if (!currentUser || !reason?.trim()) {
      addNotification({ type: 'error', message: 'Motivo del ban obbligatorio' });
      return;
    }

    if (!duration || duration.trim() === '') {
      addNotification({ type: 'error', message: 'Durata del ban obbligatoria' });
      return;
    }

    try {
      const bannedUntil = calculateBannedUntil(duration);
      const banData: any = {
        reason: reason.trim(),
        duration: duration === 'permanent' ? 'permanent' : 'temporary'
      };

      if (bannedUntil) {
        banData.bannedUntil = bannedUntil.toISOString();
      }

      await banUser.mutateAsync({ id: currentUser._id, banData });
      addNotification({ type: 'success', message: `${currentUser.username} bannato con successo` });
      setActiveSidePanel(null);
      setCurrentUser(null);
      setBanReason('');
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel ban dell\'utente'
      });
    }
  };

  /**
   * Handler bulk ban submit
   */
  const handleBulkBanSubmit = async (reason: string, duration: string) => {
    if (bulkBanUsers_state.length === 0 || !reason?.trim()) {
      addNotification({ type: 'error', message: 'Motivo del ban obbligatorio' });
      return;
    }

    if (!duration || duration.trim() === '') {
      addNotification({ type: 'error', message: 'Durata del ban obbligatoria' });
      return;
    }

    try {
      const bannedUntil = calculateBannedUntil(duration);
      const banData: any = {
        reason: reason.trim(),
        duration: duration === 'permanent' ? 'permanent' : 'temporary'
      };

      if (bannedUntil) {
        banData.bannedUntil = bannedUntil.toISOString();
      }

      const userIds = bulkBanUsers_state.map(user => user._id);
      const result = await bulkBanUsers.mutateAsync({ userIds, ...banData });

      if (result.failed > 0) {
        addNotification({
          type: 'warning',
          message: `${result.success} utenti bannati, ${result.failed} falliti`
        });
      } else {
        addNotification({
          type: 'success',
          message: `${result.success} utenti bannati con successo`
        });
      }

      setActiveSidePanel(null);
      setBulkBanUsers_state([]);
      setBulkBanReason('');
      setSelectedUsers([]);
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nel ban multiplo'
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
  const handleBulkAction = async (actionKey: string, items: User[], allPagesSelected: boolean = false) => {
    try {
      if (actionKey === 'bulk-ban') {
        if (allPagesSelected) {
          addNotification({
            type: 'warning',
            message: 'Bulk ban per tutte le pagine non ancora implementato'
          });
          return;
        }
        // Open side panel to request ban reason
        setBulkBanUsers_state(items);
        setBulkBanReason('');
        setActiveSidePanel('bulk-ban');
        return;
      }

      if (actionKey === 'bulk-unban') {
        const confirmed = await confirm({
          title: 'Conferma Rimozione Ban Multipla',
          message: allPagesSelected
            ? `Sei sicuro di voler rimuovere il ban per tutti i ${data?.pagination.totalItems} utenti?`
            : `Sei sicuro di voler rimuovere il ban per ${items.length} utenti selezionati?`
        });

        if (confirmed) {
          if (allPagesSelected) {
            addNotification({
              type: 'warning',
              message: 'Bulk unban per tutte le pagine non ancora implementato'
            });
          } else {
            const userIds = items.map(user => user._id);
            const result = await bulkUnbanUsers.mutateAsync(userIds);

            if (result.failed > 0) {
              addNotification({
                type: 'warning',
                message: `Ban rimosso per ${result.success} utenti, ${result.failed} falliti`
              });
            } else {
              addNotification({
                type: 'success',
                message: `Ban rimosso per ${result.success} utenti`
              });
            }
          }
        }
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
        <title>Ten Penny Novels | Gestione Ban Utenti</title>
      </Head>

      <div className={styles.userList}>
        <header className={styles.header}>
          <h1>🚫 Gestione Ban Utenti</h1>
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
                window.location.reload();
              }}
              title="Rimuovi filtro"
            >
              ✕
            </button>
          </div>
        )}

        <ConfigurableDataTable<User>
          tableName="ban-list"
          data={data?.list ?? []}
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

        {/* Side Panel: Bulk Ban Users */}
        {activeSidePanel === 'bulk-ban' && bulkBanUsers_state.length > 0 && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Banna ${bulkBanUsers_state.length} utenti`,
              width: 'medium',
              fields: [
                {
                  key: 'users',
                  label: 'Utenti Selezionati',
                  type: 'text',
                  required: false,
                  disabled: true
                },
                {
                  key: 'bulkBanDuration',
                  label: 'Durata Ban',
                  type: 'select',
                  required: false,
                  disabled: false,
                  options: [
                    { value: '15m', label: '15 minuti' },
                    { value: '30m', label: '30 minuti' },
                    { value: '1h', label: '1 ora' },
                    { value: '2h', label: '2 ore' },
                    { value: '6h', label: '6 ore' },
                    { value: '12h', label: '12 ore' },
                    { value: '1d', label: '1 giorno' },
                    { value: '1w', label: '1 settimana' },
                    { value: '1y', label: '1 anno' },
                    { value: 'permanent', label: 'Permanente' }
                  ]
                },
                {
                  key: 'bulkBanReason',
                  label: 'Motivo Ban (applicato a tutti)',
                  type: 'textarea',
                  required: false,
                  disabled: false,
                  placeholder: 'Inserisci il motivo del ban che verrà applicato a tutti gli utenti selezionati...'
                }
              ],
              actions: [
                {
                  key: 'submit',
                  label: `Banna ${bulkBanUsers_state.length} Utenti`,
                  type: 'danger',
                  loading: bulkBanUsers.isPending
                },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              users: bulkBanUsers_state.map(u => u.username).join(', '),
              bulkBanDuration: '1d',
              bulkBanReason: ''
            }}
            onAction={(action, formData) => {
              if (action === 'submit') {
                logger.info('BULK BAN formData:', { formData });
                const reason = formData.bulkBanReason as string;
                const duration = formData.bulkBanDuration as string;
                handleBulkBanSubmit(reason, duration);
              } else if (action === 'cancel') {
                setActiveSidePanel(null);
                setBulkBanUsers_state([]);
                setBulkBanReason('');
              }
            }}
            onClose={() => {
              setActiveSidePanel(null);
              setBulkBanUsers_state([]);
              setBulkBanReason('');
            }}
          />
        )}

        {/* Side Panel: Ban User */}
        {activeSidePanel === 'ban' && currentUser && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Banna ${currentUser.username}`,
              width: 'medium',
              fields: [
                { key: 'username', label: 'Username', type: 'text', required: false, disabled: true },
                { key: 'email', label: 'Email', type: 'email', required: false, disabled: true },
                {
                  key: 'banDuration',
                  label: 'Durata Ban',
                  type: 'select',
                  required: false,
                  disabled: false,
                  options: [
                    { value: '15m', label: '15 minuti' },
                    { value: '30m', label: '30 minuti' },
                    { value: '1h', label: '1 ora' },
                    { value: '2h', label: '2 ore' },
                    { value: '6h', label: '6 ore' },
                    { value: '12h', label: '12 ore' },
                    { value: '1d', label: '1 giorno' },
                    { value: '1w', label: '1 settimana' },
                    { value: '1y', label: '1 anno' },
                    { value: 'permanent', label: 'Permanente' }
                  ]
                },
                { key: 'banReason', label: 'Motivo Ban', type: 'textarea', required: false, disabled: false, placeholder: 'Inserisci il motivo del ban...' }
              ],
              actions: [
                { key: 'submit', label: 'Banna Utente', type: 'danger', loading: banUser.isPending },
                { key: 'cancel', label: 'Annulla', type: 'secondary', loading: false }
              ]
            }}
            data={{
              username: currentUser.username,
              email: currentUser.email,
              banDuration: '1d',
              banReason: ''
            }}
            onAction={(action, formData) => {
              if (action === 'submit') {
                logger.info('SINGLE BAN formData:', { formData });
                const reason = formData.banReason as string;
                const duration = formData.banDuration as string;
                handleBanSubmit(reason, duration);
              } else if (action === 'cancel') {
                setActiveSidePanel(null);
                setCurrentUser(null);
                setBanReason('');
              }
            }}
            onClose={() => {
              setActiveSidePanel(null);
              setCurrentUser(null);
              setBanReason('');
            }}
          />
        )}

        {/* Side Panel: View Details */}
        {activeSidePanel === 'view' && currentUser && (
          <SidePanel
            isOpen={true}
            config={{
              title: `Dettagli: ${currentUser.username}`,
              width: 'medium',
              fields: [
                { key: 'username', label: 'Username', type: 'text', required: false, disabled: true },
                { key: 'email', label: 'Email', type: 'email', required: false, disabled: true },
                { key: 'isBanned', label: 'Bannato', type: 'text', required: false, disabled: true },
                { key: 'banReason', label: 'Motivo Ban', type: 'textarea', required: false, disabled: true },
                { key: 'bannedAt', label: 'Bannato Il', type: 'text', required: false, disabled: true },
                { key: 'bannedBy', label: 'Bannato Da', type: 'text', required: false, disabled: true }
              ],
              actions: [
                { key: 'close', label: 'Chiudi', type: 'secondary', loading: false }
              ]
            }}
            data={{
              username: currentUser.username,
              email: currentUser.email,
              isBanned: currentUser.accountStatus.isBanned ? 'Sì' : 'No',
              banReason: currentUser.accountStatus.banReason || 'N/A',
              bannedAt: currentUser.accountStatus.bannedAt
                ? new Date(currentUser.accountStatus.bannedAt).toLocaleString('it-IT')
                : 'N/A',
              bannedBy: currentUser.accountStatus.bannedBy || 'N/A'
            }}
            onAction={(action) => {
              if (action === 'close') {
                setActiveSidePanel(null);
                setCurrentUser(null);
              }
            }}
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
