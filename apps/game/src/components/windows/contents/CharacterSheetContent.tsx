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

import { useEffect } from 'react';

import { useCharacterSheetData } from '@/hooks/useCharacterSheetData';
import { useAudioManagerStore } from '@/store/audioManagerStore';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';

import { CharacterSheetBot } from './CharacterSheetBot';
import { CharacterSheetMaster } from './CharacterSheetMaster';
import { CharacterSheetPGPrincipale } from './CharacterSheetPGPrincipale';
import { CharacterSheetPNG } from './CharacterSheetPNG';
import { logger } from '@/lib/logger';

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

  // Registra il brano di questo personaggio: se questa scheda diventa quella in
  // primo piano, AudioManagerController lo riprodurrà (vedi audioManagerStore).
  // Va prima di ogni return anticipato (Rules of Hooks): usa i dati non appena disponibili.
  const character = data?.character;
  useEffect(() => {
    if (!character) return;
    const { register, unregister } = useAudioManagerStore.getState();
    register(character._id, character.audioTheme, character.name);
    return () => unregister(character._id);
  }, [character?._id, character?.audioTheme, character?.name]);

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

  // No data (il narrowing su `character`, già letto sopra da data?.character, serve perché
  // è usato dagli hook prima di questo guard: da qui in poi TS lo sa non-undefined)
  if (!data || !character) {
    return (
      <div className={styles.characterSheetContent}>
        <div className={styles.errorState}>
          <h2 className={styles.errorTitle}>❌ Dati Mancanti</h2>
          <p className={styles.errorMessage}>Nessun dato disponibile per questo personaggio.</p>
        </div>
      </div>
    );
  }

  const { permissions, visibleSkills, visibleEquipment } = data;

  // Bot characters get their own dedicated sheet (takes priority over characterType)
  if (character.isBot) {
    return (
      <CharacterSheetBot
        character={character}
        permissions={permissions}
        visibleSkills={visibleSkills}
        visibleEquipment={visibleEquipment}
      />
    );
  }

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
      logger.warn('[CharacterSheetContent] Unknown characterType:', { args: [character.characterType, '- defaulting to pg_principale'] });
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
