/**
 * Deleted Records Page
 *
 * View and manage soft deleted records (gestore-only)
 */

import React, { useState } from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { ContextMenu } from '@/components/shared/ContextMenu';
import ConflictResolutionModal from '@/components/shared/ConflictResolutionModal';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useNotificationStore } from '@/store/notificationStore';
import {
  useDeletedRecords,
  useRestoreRecord,
  usePermanentlyDeleteRecord
} from '@/hooks/api/useDeletedRecords';
import type {
  DeletedRecord,
  RecordType,
  DeletedRecordsParams
} from '@/types/api/DeletedRecord';
import styles from './deleted-records.module.scss';

type TabType = RecordType | 'all';

export default function DeletedRecordsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedRecords, setSelectedRecords] = useState<DeletedRecord[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<DeletedRecord | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, boolean>>({});

  const { confirm, ConfirmDialogComponent } = useConfirm();
  const { addNotification } = useNotificationStore();

  // Table filters
  const { params, setParams } = useTableFilters<DeletedRecordsParams>({
    page: 1,
    pageSize: 25,
    sortBy: 'deletedAt',
    sortOrder: 'desc'
  });

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setParams({ ...params, page });
  };

  const handlePageSizeChange = (pageSize: number) => {
    setParams({ ...params, page: 1, pageSize });
  };

  // Query params based on active tab
  const queryParams: DeletedRecordsParams = {
    ...params,
    type: activeTab === 'all' ? undefined : activeTab
  };

  // Query and mutations
  const { data, isLoading, error } = useDeletedRecords(queryParams);
  const restoreMutation = useRestoreRecord();
  const permanentDeleteMutation = usePermanentlyDeleteRecord();

  /**
   * Handle restore action
   */
  const handleRestore = async (record: DeletedRecord) => {
    const confirmed = await confirm({
      title: 'Conferma Ripristino',
      message: `Sei sicuro di voler ripristinare "${record.displayName}"? Il record sarà nuovamente visibile nel sistema.`,
      confirmLabel: 'Ripristina',
      cancelLabel: 'Annulla'
    });

    if (!confirmed) return;

    try {
      await restoreMutation.mutateAsync({
        id: record._id,
        data: { type: record.type }
      });

      addNotification({
        type: 'success',
        message: `"${record.displayName}" ripristinato con successo`
      });
    } catch (error: any) {
      // Handle key conflicts
      if (error.code === 'KEY_CONFLICT') {
        setCurrentRecord(record);
        setConflicts(error.data?.conflicts || {});
        setConflictModalOpen(true);
      } else {
        addNotification({
          type: 'error',
          message: error.message || 'Errore durante il ripristino'
        });
      }
    }
  };

  /**
   * Handle conflict resolution
   */
  const handleResolveConflict = async (newKeys: Record<string, string>) => {
    if (!currentRecord) return;

    try {
      await restoreMutation.mutateAsync({
        id: currentRecord._id,
        data: {
          type: currentRecord.type,
          newKeys
        }
      });

      addNotification({
        type: 'success',
        message: `"${currentRecord.displayName}" ripristinato con nuovi valori`
      });

      setConflictModalOpen(false);
      setCurrentRecord(null);
      setConflicts({});
    } catch (error: any) {
      // If still conflicts, modal will show error
      throw error;
    }
  };

  /**
   * Handle permanent delete action
   */
  const handlePermanentDelete = async (record: DeletedRecord) => {
    // Check retention policy (30 days)
    const daysSinceDeleted = (Date.now() - new Date(record.deletedAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDeleted < 30) {
      addNotification({
        type: 'warning',
        message: `Retention policy: puoi eliminare definitivamente solo dopo 30 giorni. Record eliminato ${Math.floor(daysSinceDeleted)} giorni fa.`
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Eliminazione Permanente',
      message: `Sei sicuro di voler eliminare DEFINITIVAMENTE "${record.displayName}"? Questa azione è IRREVERSIBILE e il record non potrà più essere ripristinato.`,
      confirmLabel: 'Elimina Definitivamente',
      cancelLabel: 'Annulla',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await permanentDeleteMutation.mutateAsync({
        id: record._id,
        type: record.type
      });

      addNotification({
        type: 'success',
        message: `"${record.displayName}" eliminato definitivamente`
      });
    } catch (error: any) {
      addNotification({
        type: 'error',
        message: error.message || 'Errore durante l\'eliminazione permanente'
      });
    }
  };

  /**
   * Handle tab change
   */
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setParams({ ...params, page: 1 }); // Reset to page 1
    setSelectedRecords([]); // Clear selection
  };

  /**
   * Get badge color by type
   */
  const getTypeBadgeColor = (type: RecordType): string => {
    const colors: Record<string, string> = {
      users: '#2196f3',
      characters: '#9c27b0',
      documents: '#ff9800',
      locations: '#4caf50',
      items: '#f44336',
      skills: '#00bcd4',
      occupations: '#795548',
      socialclassconfigs: '#607d8b'
    };
    return colors[type] || '#9e9e9e';
  };

  const getTypeLabel = (type: RecordType): string => {
    const labels: Record<string, string> = {
      users: 'User',
      characters: 'Character',
      documents: 'Document',
      locations: 'Location',
      items: 'Item',
      skills: 'Skill',
      occupations: 'Occupazione',
      socialclassconfigs: 'Classe Sociale'
    };
    return labels[type] || type;
  };

  return (
    <ManagementLayout>
      <div className={styles.deletedRecords}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>
              Record Cancellati
              {data?.counts.total !== undefined && (
                <span className={styles.countBadge}>{data.counts.total}</span>
              )}
            </h1>
            <p className={styles.subtitle}>
              Gestisci record eliminati (soft delete). Solo il gestore può vedere e ripristinare.
            </p>
          </div>
        </header>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={activeTab === 'all' ? styles.active : ''}
            onClick={() => handleTabChange('all')}
          >
            Tutti ({data?.counts.total || 0})
          </button>
          <button
            className={activeTab === 'users' ? styles.active : ''}
            onClick={() => handleTabChange('users')}
          >
            👥 Users ({data?.counts.users || 0})
          </button>
          <button
            className={activeTab === 'characters' ? styles.active : ''}
            onClick={() => handleTabChange('characters')}
          >
            🎭 Characters ({data?.counts.characters || 0})
          </button>
          <button
            className={activeTab === 'documents' ? styles.active : ''}
            onClick={() => handleTabChange('documents')}
          >
            📄 Documents ({data?.counts.documents || 0})
          </button>
          <button
            className={activeTab === 'locations' ? styles.active : ''}
            onClick={() => handleTabChange('locations')}
          >
            📍 Locations ({data?.counts.locations || 0})
          </button>
          <button
            className={activeTab === 'items' ? styles.active : ''}
            onClick={() => handleTabChange('items')}
          >
            🎒 Items ({data?.counts.items || 0})
          </button>
          <button
            className={activeTab === 'skills' ? styles.active : ''}
            onClick={() => handleTabChange('skills')}
          >
            🎯 Skills ({data?.counts.skills || 0})
          </button>
          <button
            className={activeTab === 'occupations' ? styles.active : ''}
            onClick={() => handleTabChange('occupations')}
          >
            💼 Occupazioni ({data?.counts.occupations || 0})
          </button>
          <button
            className={activeTab === 'socialclassconfigs' ? styles.active : ''}
            onClick={() => handleTabChange('socialclassconfigs')}
          >
            🏛️ Classi Sociali ({data?.counts.socialclassconfigs || 0})
          </button>
        </div>

        {/* Table */}
        {error ? (
          <div className={styles.error}>
            ❌ Errore nel caricamento: {error.message}
          </div>
        ) : (
          <ConfigurableDataTable<DeletedRecord>
            tableName="deleted-records"
            data={data?.list || []}
            pagination={{
              page: params.page ?? 1,
              pageSize: params.pageSize ?? 25,
              total: data?.pagination.totalItems ?? 0,
              onPageChange: handlePageChange,
              onPageSizeChange: handlePageSizeChange
            }}
            loading={isLoading}
            selectedItems={selectedRecords}
            onSelectionChange={setSelectedRecords}
            renderActions={(record) => (
              <ContextMenu
                items={[
                  {
                    key: 'restore',
                    label: '↩️ Ripristina',
                    onClick: () => handleRestore(record)
                  },
                  {
                    key: 'permanent-delete',
                    label: '🗑️ Elimina Definitivamente',
                    variant: 'danger',
                    onClick: () => handlePermanentDelete(record)
                  }
                ]}
              />
            )}
          />
        )}

        {/* Conflict Resolution Modal */}
        <ConflictResolutionModal
          isOpen={conflictModalOpen}
          record={currentRecord}
          conflicts={conflicts}
          onResolve={handleResolveConflict}
          onCancel={() => {
            setConflictModalOpen(false);
            setCurrentRecord(null);
            setConflicts({});
          }}
        />

        {/* Confirm Dialog */}
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
