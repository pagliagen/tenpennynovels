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

import { useState } from 'react';

import { CharacterSheetLeftPanel } from '@/components/character/CharacterSheetLeftPanel';
import { CharacterSheetRightPanel } from '@/components/character/CharacterSheetRightPanel';
import { EditBackgroundForm } from '@/components/character/forms/EditBackgroundForm';
import { EditInformazioniForm } from '@/components/character/forms/EditInformazioniForm';
import { CharacterEditModal } from '@/components/character/modals/CharacterEditModal';
import { Tabs } from '@/components/character/Tabs';
import type { CharacterSheetData } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';
import { logger } from '@/lib/logger';

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

  // Modal state
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [showEditBackgroundModal, setShowEditBackgroundModal] = useState(false);

  /**
   * Handle Edit Action (Contextual to Active Tab)
   *
   * Opens appropriate edit modal based on active tab.
   *
   * Implemented modals:
   * - informazioni: basic data (name, age, gender, descriptions)
   * - background: private fields (motivations, fears, traumas, secrets)
   *
   * Future implementations:
   * - statistiche: stats editor (requires complex validation with derived stats)
   * - abilita: skills editor (83 skills with breakdown tracking)
   * - diario: personality traits editor
   * - inventario: equipment manager (CRUD operations)
   *
   * Not editable:
   * - noteMaster: review history (read-only, master use only)
   */
  const handleEdit = () => {
    logger.debug('[CharacterSheet] Edit requested for tab:', { activeTab });

    switch (activeTab) {
      case 'informazioni':
        setShowEditInfoModal(true);
        break;
      case 'background':
        setShowEditBackgroundModal(true);
        break;
      case 'statistiche':
        logger.debug('[CharacterSheet] Stats editor - complex feature, planned for future release');
        break;
      case 'abilita':
        logger.debug('[CharacterSheet] Skills editor - complex feature, planned for future release');
        break;
      case 'diario':
        logger.debug('[CharacterSheet] Diary editor - feature planned for future release');
        break;
      case 'inventario':
        logger.debug('[CharacterSheet] Inventory manager - feature planned for future release');
        break;
      case 'noteMaster':
        logger.debug('[CharacterSheet] Note Master is read-only (master use only)');
        break;
      default:
        logger.debug('[CharacterSheet] No editor for tab:', { activeTab });
    }
  };

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
          onEdit={handleEdit}
        />
      </div>

      {/* Tabs Bar - Vertical Sidebar */}
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Edit Modals */}
      {/* Informazioni Modal */}
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

      {/* Background Modal */}
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
