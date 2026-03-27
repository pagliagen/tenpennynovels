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

import { useState } from 'react';

import { CharacterSheetLeftPanel } from '@/components/character/CharacterSheetLeftPanel';
import { CharacterSheetRightPanel } from '@/components/character/CharacterSheetRightPanel';
import { EditBackgroundForm } from '@/components/character/forms/EditBackgroundForm';
import { EditInformazioniForm } from '@/components/character/forms/EditInformazioniForm';
import { CharacterEditModal } from '@/components/character/modals/CharacterEditModal';
import { Tabs } from '@/components/character/Tabs';
import type { CharacterSheetData } from '@/hooks/useCharacterSheetData';
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

  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showEditBackgroundModal, setShowEditBackgroundModal] = useState(false);

  const handleEdit = () => {
    switch (activeTab) {
      case 'informazioni':
        setShowEditInfoModal(true);
        break;
      case 'background':
        setShowEditBackgroundModal(true);
        break;
      default:
        break;
    }
  };

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
          onEdit={handleEdit}
        />
      </div>

      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      <CharacterEditModal
        title="✏️ Modifica Informazioni"
        isOpen={showEditInfoModal}
        onClose={() => setShowEditInfoModal(false)}
      >
        <EditInformazioniForm
          characterId={character._id}
          character={character}
          onSuccess={() => setShowEditInfoModal(false)}
          onCancel={() => setShowEditInfoModal(false)}
        />
      </CharacterEditModal>

      <CharacterEditModal
        title="🔒 Modifica Background Privato"
        isOpen={showEditBackgroundModal}
        onClose={() => setShowEditBackgroundModal(false)}
      >
        <EditBackgroundForm
          characterId={character._id}
          character={character}
          onSuccess={() => setShowEditBackgroundModal(false)}
          onCancel={() => setShowEditBackgroundModal(false)}
        />
      </CharacterEditModal>
    </>
  );
}
