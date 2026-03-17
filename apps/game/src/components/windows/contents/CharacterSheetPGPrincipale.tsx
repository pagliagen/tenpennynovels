/**
 * Character Sheet for PG Principale
 *
 * Full character sheet with all tabs and functionality.
 * Dual-panel layout: portrait left + tabs right.
 * All 9 tabs: informazioni, background, statistiche, abilità, diario, noteMaster, inventario, corporations, alloggio
 *
 * @module components/windows/contents/CharacterSheetPGPrincipale
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';
import { CharacterSheetLeftPanel } from '@/components/character/CharacterSheetLeftPanel';
import { CharacterSheetRightPanel } from '@/components/character/CharacterSheetRightPanel';
import { Tabs } from '@/components/character/Tabs';
import type { CharacterSheetData } from '@/hooks/useCharacterSheetData';

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
  | 'inventario'
  | 'corporations'
  | 'alloggio';

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

  /**
   * Handle Edit Action (Contextual to Active Tab)
   *
   * TODO: Implement edit modals for each tab type
   * Different tabs will have different edit behaviors:
   * - informazioni: basic data (name, age, occupation, physical description)
   * - background: private fields (motivations, fears, traumas, secrets)
   * - statistiche: stats editor (charm, constitution, dexterity, etc.)
   * - abilita: skills editor (manual points, occupation/interest bonuses)
   * - diario: personality traits editor
   * - noteMaster: review history (game master only)
   * - inventario: equipment manager (add/remove/modify items)
   * - corporations: memberships manager
   * - alloggio: housing details editor
   */
  const handleEdit = () => {
    console.debug('[CharacterSheet] Edit requested for tab:', activeTab);
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
    </>
  );
}
