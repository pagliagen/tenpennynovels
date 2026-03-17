/**
 * Character Sheet Content Router
 *
 * Routes to appropriate sheet component based on characterType:
 * - pg_principale: Full sheet with all tabs (CharacterSheetPGPrincipale)
 * - png: Simplified sheet with name + avatar (CharacterSheetPNG)
 * - pg_master: Simplified sheet with name + avatar (CharacterSheetMaster)
 *
 * @module components/windows/contents/CharacterSheetContent
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/character/CharacterSheetContent.module.scss';
import { useCharacterSheetData } from '@/hooks/useCharacterSheetData';
import { CharacterSheetPGPrincipale, type CharacterSheetTab } from './CharacterSheetPGPrincipale';
import { CharacterSheetPNG } from './CharacterSheetPNG';
import { CharacterSheetMaster } from './CharacterSheetMaster';

// Re-export CharacterSheetTab for backward compatibility
export type { CharacterSheetTab };

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
 * Character Sheet Content Router Component
 *
 * Fetches character data and routes to type-specific sheet component.
 *
 * @component
 * @param {CharacterSheetContentProps} props - Component props
 * @returns {JSX.Element} Type-specific character sheet
 * @since 2.0.0
 */
export function CharacterSheetContent({ characterId }: CharacterSheetContentProps): JSX.Element {
  // Fetch character data (includes characterType for routing)
  const { data, isLoading, isError, error, refetch } = useCharacterSheetData(characterId);

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

  // No data
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

  // Route to appropriate sheet component based on characterType
  switch (character.characterType) {
    case 'pg_principale':
      return (
        <CharacterSheetPGPrincipale
          character={character}
          permissions={permissions}
          visibleSkills={visibleSkills}
          visibleEquipment={visibleEquipment}
        />
      );

    case 'png':
      return <CharacterSheetPNG character={character} />;

    case 'pg_master':
      return <CharacterSheetMaster character={character} />;

    default:
      // Fallback to pg_principale for unknown types (backward compatibility)
      console.warn(
        '[CharacterSheetContent] Unknown characterType:',
        character.characterType,
        '- defaulting to pg_principale'
      );
      return (
        <CharacterSheetPGPrincipale
          character={character}
          permissions={permissions}
          visibleSkills={visibleSkills}
          visibleEquipment={visibleEquipment}
        />
      );
  }
}
