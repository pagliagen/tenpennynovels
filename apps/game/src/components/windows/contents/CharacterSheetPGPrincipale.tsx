/**
 * Character Sheet for PG Principale
 *
 * Full character sheet with all tabs and functionality.
 * Dual-panel layout: portrait left + tabs right.
 * All 7 tabs: informazioni, background, statistiche, abilità, diario, noteMaster, inventario
 *
 * @module components/windows/contents/CharacterSheetPGPrincipale
 * @since 2.0.0
 */

'use client';

import { useEffect, useState } from 'react';

import { CharacterSheetLeftPanel } from '@/components/character/CharacterSheetLeftPanel';
import { CharacterSheetRightPanel } from '@/components/character/CharacterSheetRightPanel';
import { EditAvatarAudioForm } from '@/components/character/forms/EditAvatarAudioForm';
import { CharacterEditModal } from '@/components/character/modals/CharacterEditModal';
import { Tabs } from '@/components/character/Tabs';
import type { CharacterSheetData } from '@/hooks/useCharacterSheetData';
import { useCharacterSheetHeaderStore } from '@/store/characterSheetHeaderStore';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';

/**
 * Tab Types
 *
 * All available tabs in character sheet.
 *
 * @enum {string}
 * @since 2.0.0
 */
export type CharacterSheetTab =
  | 'informazioni'
  | 'background'
  | 'statistiche'
  | 'abilita'
  | 'diario'
  | 'noteMaster'
  | 'inventario';

/**
 * Character Sheet PG Principale Props
 *
 * @interface CharacterSheetPGPrincipaleProps
 * @since 2.0.0
 */
interface CharacterSheetPGPrincipaleProps {
  /** Character data (from useCharacterSheetData) */
  character: CharacterSheetData['character'];
  /** Permissions (from useCharacterSheetData) */
  permissions: CharacterSheetData['permissions'];
  /** Visible skill IDs (from useCharacterSheetData) */
  visibleSkills: CharacterSheetData['visibleSkills'];
  /** Visible equipment IDs (from useCharacterSheetData) */
  visibleEquipment: CharacterSheetData['visibleEquipment'];
}

/**
 * Character Sheet PG Principale Component
 *
 * Full character sheet for pg_principale characters.
 * Displays dual-panel layout with all 9 tabs.
 *
 * @component
 * @param {CharacterSheetPGPrincipaleProps} props - Component props
 * @returns {JSX.Element} Full character sheet
 * @since 2.0.0
 */
export function CharacterSheetPGPrincipale({
  character,
  permissions,
  visibleSkills,
  visibleEquipment
}: CharacterSheetPGPrincipaleProps): JSX.Element {
  // Tab state management
  const [activeTab, setActiveTab] = useState<CharacterSheetTab>('informazioni');

  // Modal "Modifica Scheda" (header): per ora limitato ad avatar + link musica,
  // gli unici campi editabili anche a personaggio approvato (vedi
  // CharacterController.limitedEditableFields). Il resto dei campi non è
  // ancora editabile da qui: EditInformazioniForm/EditBackgroundForm restano
  // pronti per quando quell'ambito verrà riaperto.
  const [showHeaderEditModal, setShowHeaderEditModal] = useState(false);
  const canEditHeader = permissions.isOwner || permissions.masterOverride;

  useEffect(() => {
    const { register, unregister } = useCharacterSheetHeaderStore.getState();
    register(character._id, {
      canEdit: canEditHeader,
      openEdit: () => setShowHeaderEditModal(true)
    });
    return () => unregister(character._id);
  }, [character._id, canEditHeader]);

  return (
    <>
      <div className={styles.characterSheetContent}>
        {/* Left Panel - Portrait + Action Buttons */}
        <CharacterSheetLeftPanel
          character={character}
          permissions={permissions}
        />

        {/* Right Panel - Scrollable Content */}
        <CharacterSheetRightPanel
          character={character}
          permissions={permissions}
          visibleSkills={visibleSkills}
          visibleEquipment={visibleEquipment}
          activeTab={activeTab}
        />
      </div>

      {/* Tabs Bar - Vertical Sidebar */}
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Modifica Scheda (header): avatar + link musica */}
      <CharacterEditModal
        title="✏️ Modifica Scheda"
        isOpen={showHeaderEditModal}
        onClose={() => setShowHeaderEditModal(false)}
      >
        <EditAvatarAudioForm
          characterId={character._id}
          character={character}
          onSuccess={() => setShowHeaderEditModal(false)}
          onCancel={() => setShowHeaderEditModal(false)}
        />
      </CharacterEditModal>
    </>
  );
}
