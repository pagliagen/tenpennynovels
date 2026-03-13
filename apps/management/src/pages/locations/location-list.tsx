/**
 * Location List Page
 *
 * Mostra le location come albero gerarchico (root → district → location).
 * Azioni: crea, modifica, elimina location.
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { LocationTreeView } from '@/components/locations/LocationTreeView';
import { CreateLocationModal } from '@/components/locations/CreateLocationModal';
import { EditLocationModal } from '@/components/locations/EditLocationModal';
import { useConfirm } from '@/hooks/useConfirm';
import {
  useLocationHierarchy,
  useLocationStats,
  useDeleteLocation
} from '@/hooks/api/useLocations';
import { useNotificationStore } from '@/store/notificationStore';
import type { LocationLevel } from '@/types/api/Location';
import styles from '@/styles/pages/LocationList.module.scss';

export default function LocationList() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [preselectedParentId, setPreselectedParentId] = useState<string | null>(null);
  const [preselectedLevel, setPreselectedLevel] = useState<LocationLevel | undefined>(undefined);

  const { data: hierarchy, isLoading: hierarchyLoading, error: hierarchyError } = useLocationHierarchy();
  const { data: stats } = useLocationStats();
  const deleteLocation = useDeleteLocation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const addNotification = useNotificationStore(state => state.addNotification);

  const handleCreateChild = (parentId: string, parentLevel: string) => {
    setPreselectedParentId(parentId);
    const childLevel: LocationLevel = parentLevel === 'root' ? 'district' : 'location';
    setPreselectedLevel(childLevel);
    setCreateModalOpen(true);
  };

  const handleEditLocation = (locationId: string) => {
    setSelectedLocationId(locationId);
    setEditModalOpen(true);
  };

  const handleDeleteLocation = async (locationId: string, locationName: string) => {
    const reason = window.prompt(`Motivo dell'eliminazione di "${locationName}":`);
    if (!reason) return;

    const confirmed = await confirm({
      title: 'Conferma Eliminazione',
      message: `Sei sicuro di voler eliminare la location "${locationName}"? Le sotto-location verranno spostate al livello superiore.`
    });

    if (!confirmed) return;

    try {
      await deleteLocation.mutateAsync({ id: locationId, reason, forceDelete: true });
      addNotification({ type: 'success', message: `Location "${locationName}" eliminata` });
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'eliminazione'
      });
    }
  };

  if (hierarchyError) {
    return (
      <ManagementLayout>
        <div className={styles.errorContainer}>
          <h2>Errore nel caricamento location</h2>
          <p>{hierarchyError instanceof Error ? hierarchyError.message : 'Errore sconosciuto'}</p>
          <button onClick={() => window.location.reload()}>Riprova</button>
        </div>
      </ManagementLayout>
    );
  }

  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Gestione Location</title>
      </Head>

      <div className={styles.locationList}>
        <header className={styles.header}>
          <div>
            <h1>Gestione Location</h1>
            <p>Totale: {hierarchy?.totalLocations ?? 0} location ({hierarchy?.publicLocations ?? 0} pubbliche, {hierarchy?.privateLocations ?? 0} private)</p>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.createButton}
              onClick={() => {
                setPreselectedParentId(null);
                setPreselectedLevel('root');
                setCreateModalOpen(true);
              }}
            >
              + Crea Location
            </button>
          </div>
        </header>

        {/* Stats */}
        {stats && (
          <div className={styles.statsBar}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>Totali</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.visible}</div>
              <div className={styles.statLabel}>Visibili</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.activeOccupants}</div>
              <div className={styles.statLabel}>Occupanti</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.withChat}</div>
              <div className={styles.statLabel}>Con Chat</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.withShop}</div>
              <div className={styles.statLabel}>Con Shop</div>
            </div>
          </div>
        )}

        {/* Tree View */}
        {hierarchyLoading ? (
          <div className={styles.loading}>Caricamento...</div>
        ) : (
          <LocationTreeView
            tree={hierarchy?.tree ?? []}
            onEditLocation={handleEditLocation}
            onCreateChild={handleCreateChild}
            onDeleteLocation={handleDeleteLocation}
          />
        )}

        {ConfirmDialogComponent}

        {createModalOpen && (
          <CreateLocationModal
            isOpen={createModalOpen}
            onClose={() => {
              setCreateModalOpen(false);
              setPreselectedParentId(null);
              setPreselectedLevel(undefined);
            }}
            preselectedParentId={preselectedParentId}
            preselectedLevel={preselectedLevel}
          />
        )}

        {editModalOpen && selectedLocationId && (
          <EditLocationModal
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false);
              setSelectedLocationId(null);
            }}
            locationId={selectedLocationId}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
