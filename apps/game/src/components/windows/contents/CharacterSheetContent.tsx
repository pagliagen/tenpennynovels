/**
 * Character Sheet Content Router
 *
 * Bot characters get a dedicated sheet (CharacterSheetBot). Ogni altro tipo
 * (pg_principale, png, pg_master) usa la stessa scheda completa
 * (CharacterSheetPGPrincipale): le differenze tra i tipi sono nei dati e nei
 * permessi restituiti dal backend, non nella UI.
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
import { CharacterSheetPGPrincipale } from './CharacterSheetPGPrincipale';

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

  // pg_principale, png e pg_master condividono la stessa scheda completa (tutti i tab):
  // le differenze tra i tipi sono nei dati/permessi restituiti dal backend (es. un png
  // difficilmente avrà punti esperienza), non nella UI, quindi non serve un componente
  // dedicato per ciascuno — evita di mantenere 3 copie quasi identiche.
  return (
    <CharacterSheetPGPrincipale
      character={character}
      permissions={permissions}
      visibleSkills={visibleSkills}
      visibleEquipment={visibleEquipment}
    />
  );
}
