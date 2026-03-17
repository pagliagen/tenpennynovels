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
   * Each tab has different edit behavior:
   * - Informazioni: Edit basic data (name, age, occupation)
   * - Background: Edit background sections
   * - Statistiche: Edit stats (if in draft)
   * - Abilità: Edit skill values
   * - Diario: Edit personality traits
   * - Note Master: Add new review (game master only)
   * - Inventario: Add/remove equipment
   * - Corporations: Manage memberships
   * - Alloggio: Edit housing details
   */
  const handleEdit = () => {
    switch (activeTab) {
      case 'informazioni':
        console.log('[Edit] Informazioni - TODO: Open edit form for basic character data');
        alert('Edit Informazioni: Implementa form per modificare nome, età, occupazione, descrizione fisica/pubblica');
        break;

      case 'background':
        console.log('[Edit] Background - TODO: Open edit form for background sections');
        alert('Edit Background: Implementa form per modificare background privato, motivazioni, paure, traumi, segreti');
        break;

      case 'statistiche':
        console.log('[Edit] Statistiche - TODO: Open stats editor (if DRAFT status)');
        alert('Edit Statistiche: Implementa editor per statistiche base (Charm, Constitution, etc.)');
        break;

      case 'abilita':
        console.log('[Edit] Abilità - TODO: Open skills editor');
        alert('Edit Abilità: Implementa editor per modificare valori skills (manualPoints, occupationBonus)');
        break;

      case 'diario':
        console.log('[Edit] Diario - TODO: Open personality traits editor');
        alert('Edit Diario: Implementa editor per tratti personalità e note diario');
        break;

      case 'noteMaster':
        console.log('[Edit] Note Master - TODO: Add new review entry');
        alert('Edit Note Master: Implementa form per aggiungere nuova review (solo Game Master)');
        break;

      case 'inventario':
        console.log('[Edit] Inventario - TODO: Open equipment manager');
        alert('Edit Inventario: Implementa manager per aggiungere/rimuovere/modificare equipaggiamento');
        break;

      case 'corporations':
        console.log('[Edit] Corporations - TODO: Open memberships manager');
        alert('Edit Corporations: Implementa manager per gestire appartenenze corporations');
        break;

      case 'alloggio':
        console.log('[Edit] Alloggio - TODO: Open housing editor');
        alert('Edit Alloggio: Implementa editor per dettagli alloggio (ubicazione, affitto, servizi)');
        break;

      default:
        console.warn('[Edit] Unknown tab:', activeTab);
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
    </>
  );
}
