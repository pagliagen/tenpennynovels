/**
 * Character Sheet Content Component
 *
 * Type-specific content for character sheet windows.
 * Displays dual-panel layout: portrait left + tabs right.
 *
 * Phase 2: Dual-panel layout + tab state management + placeholder tabs
 * Phase 3: React Query data fetching + permissions
 * Phase 4: Real tab content with data
 *
 * @module components/windows/contents/CharacterSheetContent
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';
import { CharacterSheetLeftPanel } from '@/components/character/CharacterSheetLeftPanel';
import { CharacterSheetRightPanel } from '@/components/character/CharacterSheetRightPanel';
import { Tabs } from '@/components/character/Tabs';
import { useCharacterSheetData } from '@/hooks/useCharacterSheetData';

/**
 * Character Sheet Content Props
 *
 * @interface CharacterSheetContentProps
 * @since 2.0.0
 */
interface CharacterSheetContentProps {
  /** Character MongoDB _id */
  characterId: string;
}

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
 * Character Sheet Content Component
 *
 * Dual-panel layout with tab state management.
 *
 * @component
 * @param {CharacterSheetContentProps} props - Component props
 * @returns {JSX.Element} Character sheet content
 * @since 2.0.0
 */
export function CharacterSheetContent({ characterId }: CharacterSheetContentProps): JSX.Element {
  // Tab state management
  const [activeTab, setActiveTab] = useState<CharacterSheetTab>('informazioni');

  // Phase 3: React Query data fetching with permissions
  const { data, isLoading, isError, error, refetch } = useCharacterSheetData(characterId);

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

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.characterSheetContent}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Caricamento scheda personaggio...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className={styles.characterSheetContent}>
        <div className={styles.errorState}>
          <h2 className={styles.errorTitle}>❌ Errore Caricamento</h2>
          <p className={styles.errorMessage}>
            {error?.message || 'Impossibile caricare la scheda del personaggio.'}
          </p>
          <button onClick={() => refetch()} className={styles.retryButton}>
            🔄 Riprova
          </button>
        </div>
      </div>
    );
  }

  // Data loaded successfully
  if (!data) {
    return (
      <div className={styles.characterSheetContent}>
        <div className={styles.errorState}>
          <h2 className={styles.errorTitle}>❌ Dati Mancanti</h2>
          <p className={styles.errorMessage}>Nessun dato disponibile per questo personaggio.</p>
        </div>
      </div>
    );
  }

  const { character, permissions, visibleSkills, visibleEquipment } = data;

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
