/**
 * Character Sheet Right Panel Component
 *
 * Right side of character sheet window.
 * Displays horizontal tabs bar (sticky) + scrollable content area.
 *
 * @module components/character/CharacterSheetRightPanel
 * @since 2.0.0
 */

'use client';

import { CharacterSheetTab } from '../windows/contents/CharacterSheetContent';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';
import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';

// Tab components (placeholder for Phase 2)
import { InformazioniTab } from './tabs/InformazioniTab';
import { BackgroundTab } from './tabs/BackgroundTab';
import { StatisticheTab } from './tabs/StatisticheTab';
import { AbilitaTab } from './tabs/AbilitaTab';
import { DiarioTab } from './tabs/DiarioTab';
import { NoteMasterTab } from './tabs/NoteMasterTab';
import { InventarioTab } from './tabs/InventarioTab';
import { CorporationsTab } from './tabs/CorporationsTab';
import { AlloggioTab } from './tabs/AlloggioTab';

/**
 * Character Sheet Right Panel Props
 *
 * @interface CharacterSheetRightPanelProps
 * @since 2.0.0
 */
interface CharacterSheetRightPanelProps {
  /** Character data from React Query */
  character: CharacterSheetData['character'];

  /** Permissions for this viewer */
  permissions: CharacterSheetPermissions;

  /** Skill IDs visible to this viewer */
  visibleSkills: string[];

  /** Equipment IDs visible to this viewer */
  visibleEquipment: string[];

  /** Active tab */
  activeTab: CharacterSheetTab;

  /** Edit handler (contextual to active tab) */
  onEdit?: () => void;
}

/**
 * Character Sheet Right Panel Component
 *
 * Tabs bar + content area.
 *
 * @component
 * @param {CharacterSheetRightPanelProps} props - Component props
 * @returns {JSX.Element} Right panel
 * @since 2.0.0
 */
export function CharacterSheetRightPanel({
  character,
  permissions,
  visibleSkills,
  visibleEquipment,
  activeTab,
  onEdit,
}: CharacterSheetRightPanelProps): JSX.Element {
  // Shared props for all tabs
  const tabProps = {
    character,
    permissions,
    visibleSkills,
    visibleEquipment,
  };

  return (
    <div className={styles.rightPanel}>
      {/* Edit Button (Owner Only, Approved or Draft Characters, Informazioni Tab Only) */}
      {permissions.isOwner &&
        (character.playerStatus === 'approved' || character.playerStatus === 'draft') &&
        activeTab === 'informazioni' &&
        onEdit && (
          <div className={styles.editButtonContainer}>
            <button
              onClick={onEdit}
              className={styles.editButton}
              title="Modifica Informazioni (solo campi modificabili)"
            >
              ✏️ Modifica Informazioni
            </button>
          </div>
        )}

      {/* Content Area (Scrollable) - Tabs are now a separate sibling component */}
      <div className={styles.tabContent}>
        {activeTab === 'informazioni' && <InformazioniTab {...tabProps} />}
        {activeTab === 'background' && <BackgroundTab {...tabProps} />}
        {activeTab === 'statistiche' && <StatisticheTab {...tabProps} />}
        {activeTab === 'abilita' && <AbilitaTab {...tabProps} />}
        {activeTab === 'diario' && <DiarioTab {...tabProps} />}
        {activeTab === 'noteMaster' && <NoteMasterTab {...tabProps} />}
        {activeTab === 'inventario' && <InventarioTab {...tabProps} />}
        {activeTab === 'corporations' && <CorporationsTab {...tabProps} />}
        {activeTab === 'alloggio' && <AlloggioTab {...tabProps} />}
      </div>
    </div>
  );
}
