import { Character, FilteredCharacter } from '../types/character';

/**
 * Campi sempre pubblici indipendentemente dalla configurazione fieldVisibility.
 * Sono metadati di sistema o info di presenza che non contengono dati sensibili.
 */
const SYSTEM_PUBLIC_FIELDS: (keyof Character)[] = [
  'id',
  'physicalDescription',
  'publicDescription',
  'socialClass',
  'visibleMarks',
  'currentLocation',
  'isActive',
  'isBot',
  'playerStatus',
  'createdAt',
  'updatedAt',
];

/**
 * Campi background (sotto character.background) la cui visibilità
 * è configurabile tramite fieldVisibility.
 */
const BACKGROUND_SUBFIELDS = [
  'briefHistory',
  'significantEvents',
  'importantRelationships',
  'personality',
  'ideology',
] as const;

/**
 * Utility per filtrare i dati del personaggio in base ai permessi dell'utente
 */
export class CharacterVisibilityFilter {

  /**
   * Filtra i dati del personaggio per la visualizzazione pubblica.
   * Quando fieldVisibility è fornita (dalla config DB), il filtro è dinamico.
   * In assenza, usa la lista hardcoded di fallback per retrocompatibilità.
   */
  static filterForPublic(
    character: Character,
    fieldVisibility?: Record<string, boolean>
  ): FilteredCharacter {
    const result: Partial<Character> = {};

    // System fields: sempre pubblici
    for (const field of SYSTEM_PUBLIC_FIELDS) {
      if ((character as any)[field] !== undefined) {
        (result as any)[field] = (character as any)[field];
      }
    }

    if (fieldVisibility) {
      // Campi top-level configurabili
      for (const [field, isPublic] of Object.entries(fieldVisibility)) {
        if (!isPublic) continue;
        if (BACKGROUND_SUBFIELDS.includes(field as any)) continue;

        if ((character as any)[field] !== undefined) {
          (result as any)[field] = (character as any)[field];
        }
      }

      // Background: includi i sotto-campi pubblici
      const publicBackgroundFields = BACKGROUND_SUBFIELDS.filter(
        (f) => fieldVisibility[f] === true
      );
      if (publicBackgroundFields.length > 0 && character.background) {
        const partialBackground: Record<string, any> = {};
        for (const f of publicBackgroundFields) {
          if ((character.background as any)[f] !== undefined) {
            partialBackground[f] = (character.background as any)[f];
          }
        }
        if (Object.keys(partialBackground).length > 0) {
          (result as any).background = partialBackground;
        }
      }
    } else {
      // Fallback: lista hardcoded (retrocompatibilità)
      result.name = character.name;
      result.apparentAge = character.apparentAge;
      result.occupation = character.occupation;
    }

    return result as FilteredCharacter;
  }

  /**
   * Filtra i dati del personaggio per i master
   * (i master possono vedere tutto)
   */
  static filterForMaster(character: Character): FilteredCharacter {
    return { ...character };
  }

  /**
   * Filtra i dati del personaggio per il proprietario
   * (il proprietario del personaggio può vedere tutto)
   */
  static filterForOwner(character: Character): FilteredCharacter {
    return { ...character };
  }

  /**
   * Determina il livello di accesso e filtra di conseguenza.
   * Se fieldVisibility è fornita, il filtro pubblico è dinamico (da DB config).
   */
  static filterCharacter(
    character: Character,
    requestingUserId: string,
    isMaster: boolean = false,
    fieldVisibility?: Record<string, boolean>
  ): FilteredCharacter {

    if (character.userId === requestingUserId) {
      return this.filterForOwner(character);
    }

    if (isMaster) {
      return this.filterForMaster(character);
    }

    return this.filterForPublic(character, fieldVisibility);
  }

  /**
   * Filtra un array di personaggi
   */
  static filterCharacters(
    characters: Character[],
    requestingUserId: string,
    isMaster: boolean = false,
    fieldVisibility?: Record<string, boolean>
  ): FilteredCharacter[] {
    return characters.map(character =>
      this.filterCharacter(character, requestingUserId, isMaster, fieldVisibility)
    );
  }

  /**
   * Controlla se un utente può vedere i segreti di un personaggio
   */
  static canViewSecrets(
    character: Character,
    requestingUserId: string,
    isMaster: boolean = false
  ): boolean {
    return character.userId === requestingUserId || isMaster;
  }

  /**
   * Controlla se un utente può vedere la nazionalità di un personaggio
   */
  static canViewNationality(
    character: Character,
    requestingUserId: string,
    isMaster: boolean = false
  ): boolean {
    return character.userId === requestingUserId || isMaster;
  }
}
