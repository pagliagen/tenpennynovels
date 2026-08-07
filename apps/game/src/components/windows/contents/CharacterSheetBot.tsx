/**
 * Character Sheet for Bot Characters
 *
 * Full character sheet for bot (AI) characters.
 * Currently identical to CharacterSheetPGPrincipale — kept separate
 * so bot-specific tabs/sections can be removed or customized independently.
 *
 * Dual-panel layout: portrait left + tabs right.
 *
 * @module components/windows/contents/CharacterSheetBot
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
 * All available tabs in bot character sheet.
 *
 * @enum {string}
 * @since 2.0.0
 */
export type CharacterSheetBotTab =
  | 'informazioni'
  | 'background'
  | 'statistiche'
  | 'abilita'
  | 'diario'
  | 'noteMaster'
  | 'inventario';

/**
 * Character Sheet Bot Props
 *
 * @interface CharacterSheetBotProps
 * @since 2.0.0
 */
interface CharacterSheetBotProps {
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
 * Character Sheet Bot Component
 *
 * Full character sheet for bot (AI) characters.
 *
 * @component
 * @param {CharacterSheetBotProps} props - Component props
 * @returns {JSX.Element} Full character sheet
 * @since 2.0.0
 */
export function CharacterSheetBot({
  character,
  permissions,
  visibleSkills,
  visibleEquipment
}: CharacterSheetBotProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<CharacterSheetBotTab>('informazioni');

  // Modal "Modifica Scheda" (header): per ora limitato ad avatar + link musica,
  // vedi lo stesso pattern in CharacterSheetPGPrincipale.
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
        <CharacterSheetLeftPanel
          character={character}
          permissions={permissions}
        />

        <CharacterSheetRightPanel
          character={character}
          permissions={permissions}
          visibleSkills={visibleSkills}
          visibleEquipment={visibleEquipment}
          activeTab={activeTab}
        />
      </div>

      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

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
