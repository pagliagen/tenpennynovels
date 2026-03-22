/**
 * Character Face Claims Page
 *
 * Management page for face claims (prestavolti) with duplicate detection and approval workflow.
 * Shows characters grouped by face claim, allows approve/reject actions.
 *
 * @module pages/characters/character-faceclaims
 * @since 2.0.0
 */

import React, { useState, useMemo } from 'react';
import classNames from 'classnames';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { ConfigurableDataTable } from '@/components/shared/ConfigurableDataTable';
import { Modal } from '@/components/shared/Modal';
import { useConfirm } from '@/hooks/useConfirm';
import { useTableConfig } from '@/hooks/useTableConfig';
import {
  useDuplicateFaceClaims,
  useApproveFaceClaim,
  useRejectFaceClaim,
  useBulkApproveFaceClaims
} from '@/hooks/api/useFaceClaims';
import type { FaceClaimGroup, FaceClaimCharacter } from '@/lib/api/faceClaims';
import styles from '@/styles/pages/CharacterList.module.scss';

/**
 * Face Claims Management Page
 */
export default function CharacterFaceClaims() {
  // State
  const [selectedGroup, setSelectedGroup] = useState<FaceClaimGroup | null>(null);
  const [activeSidePanel, setActiveSidePanel] = useState<'view' | null>(null);

  // Hooks
  const { data, isLoading, error } = useDuplicateFaceClaims();
  const tableConfig = useTableConfig('face-claims-list');
  const { mutate: approveFaceClaim, isPending: isApproving } = useApproveFaceClaim();
  const { mutate: rejectFaceClaim, isPending: isRejecting } = useRejectFaceClaim();
  const { mutate: bulkApprove, isPending: isBulkApproving } = useBulkApproveFaceClaims();
  const { confirm, ConfirmDialogComponent } = useConfirm();

  const visibleColumns = useMemo(() => {
    if (!tableConfig.config) return [];
    return tableConfig.config.columns.filter(c => tableConfig.columnVisibility[c.key] !== false);
  }, [tableConfig.config, tableConfig.columnVisibility]);

  /**
   * Prepare table data (flatten groups to rows)
   */
  const tableData = useMemo(() => {
    if (!data?.faceClaimGroups) return [];
    return data.faceClaimGroups.map((group) => ({
      id: group.prestavolto,
      prestavolto: group.prestavolto,
      duplicateCount: group.duplicateCount,
      characters: group.characters.map((c) => `${c.name} ${c.surname}`).join(', '),
      status: group.hasApproved ? 'Approved' : group.hasPending ? 'Pending' : 'Mixed',
      _raw: group
    }));
  }, [data]);

  /**
   * Handle table action → open details side panel
   */
  const handleAction = (action: string, row: any) => {
    if (action === 'view') {
      setSelectedGroup(row._raw);
      setActiveSidePanel('view');
    }
  };

  /**
   * Handle approve face claim for single character
   */
  const handleApproveCharacter = async (character: FaceClaimCharacter) => {
    const confirmed = await confirm({
      title: 'Approva Prestavolto',
      message: `Confermi l'approvazione del prestavolto "${selectedGroup?.prestavolto}" per il personaggio ${character.name} ${character.surname}?`,
      confirmLabel: 'Approva'
    });

    if (confirmed) {
      approveFaceClaim(
        { characterId: character._id },
        {
          onSuccess: () => {
            // Keep side panel open, data will refresh automatically
          }
        }
      );
    }
  };

  /**
   * Handle reject face claim for single character
   */
  const handleRejectCharacter = async (character: FaceClaimCharacter) => {
    const confirmed = await confirm({
      title: 'Rifiuta Prestavolto',
      message: `Confermi il rifiuto del prestavolto "${selectedGroup?.prestavolto}" per ${character.name} ${character.surname}? Il campo prestavolto verrà cancellato.`,
      confirmLabel: 'Rifiuta',
      type: 'danger'
    });

    if (confirmed) {
      rejectFaceClaim(
        { characterId: character._id, reason: 'Prestavolto duplicato non autorizzato' },
        {
          onSuccess: () => {
            // Keep side panel open, data will refresh automatically
          }
        }
      );
    }
  };

  /**
   * Handle approve all characters in group
   */
  const handleApproveAll = async () => {
    if (!selectedGroup) return;

    const confirmed = await confirm({
      title: 'Approva Tutti',
      message: `Confermi l'approvazione del prestavolto "${selectedGroup.prestavolto}" per tutti i ${selectedGroup.duplicateCount} personaggi?`,
      confirmLabel: 'Approva Tutti'
    });

    if (confirmed) {
      const characterIds = selectedGroup.characters.map((c) => c._id);
      bulkApprove(characterIds, {
        onSuccess: () => {
          setActiveSidePanel(null);
        }
      });
    }
  };

  /**
   * Side Panel Content - Character Details
   */
  const renderSidePanelContent = () => {
    if (!selectedGroup) return null;

    return (
      <div className={styles.faceClaimsStack}>
        {/* Header */}
        <div>
          <h3 className={styles.faceClaimsTitle}>
            {selectedGroup.prestavolto}
          </h3>
          <p className={styles.faceClaimsSubtitle}>
            {selectedGroup.duplicateCount} personaggi usano questo prestavolto
          </p>
        </div>

        {/* Bulk Actions */}
        <div className={styles.faceClaimsDivider}>
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={isBulkApproving || selectedGroup.characters.every((c) => c.prestavoltoStatus === 'approved')}
            className={styles.faceClaimsBulkBtn}
          >
            {isBulkApproving ? 'Approvazione in corso...' : '✓ Approva Tutti'}
          </button>
        </div>

        {/* Character List */}
        <div className={styles.faceClaimsDivider}>
          <h4 className={styles.faceClaimsSectionTitle}>
            Personaggi
          </h4>
          <div className={styles.faceClaimsCharList}>
            {selectedGroup.characters.map((character) => (
              <div
                key={character._id}
                className={styles.faceClaimsCharCard}
              >
                {/* Character Info */}
                <div className={styles.faceClaimsCharRow}>
                  {character.avatar && (
                    <img
                      src={character.avatar}
                      alt={character.name}
                      className={styles.faceClaimsAvatar}
                    />
                  )}
                  <div className={styles.faceClaimsCharMeta}>
                    <div className={styles.faceClaimsCharName}>
                      {character.name} {character.surname}
                    </div>
                    <div className={styles.faceClaimsCharSub}>
                      Status: {character.playerStatus} · Prestavolto: {character.prestavoltoStatus || 'null'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.faceClaimsActionRow}>
                  <button
                    type="button"
                    onClick={() => handleApproveCharacter(character)}
                    disabled={isApproving || character.prestavoltoStatus === 'approved'}
                    className={classNames(
                      styles.faceClaimApprove,
                      character.prestavoltoStatus === 'approved' && styles.faceClaimApproveApproved
                    )}
                  >
                    {character.prestavoltoStatus === 'approved' ? '✓ Approvato' : 'Approva'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectCharacter(character)}
                    disabled={isRejecting}
                    className={styles.faceClaimReject}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ManagementLayout>
      <Head>
        <title>Gestione Prestavolti | TenpennyNovels Management</title>
      </Head>

      <div className={styles.pageContainer}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Gestione Prestavolti (Face Claims)</h1>
          <p className={styles.pageDescription}>
            Elenco prestavolti duplicati. Approva o rifiuta i duplicati (es. gemelli).
          </p>
        </div>

        {error && (
          <div className={styles.faceClaimsErrorBanner}>
            Errore nel caricamento: {(error as Error).message}
          </div>
        )}

        <ConfigurableDataTable
          tableName="face-claims-list"
          data={tableData}
          loading={isLoading || tableConfig.loading}
          onAction={handleAction}
          externalConfig={tableConfig.config ? {
            config: tableConfig.config,
            visibleColumns,
            getNestedValue: tableConfig.getNestedValue,
            resolveConditionalValue: tableConfig.resolveConditionalValue,
          } : undefined}
        />

        {/* Modal - Face Claim Details */}
        <Modal
          isOpen={activeSidePanel === 'view'}
          onClose={() => {
            setActiveSidePanel(null);
            setSelectedGroup(null);
          }}
          title="Dettagli Prestavolto"
          size="large"
        >
          {renderSidePanelContent()}
        </Modal>

        {/* Confirm Dialog */}
        {ConfirmDialogComponent}
      </div>
    </ManagementLayout>
  );
}
