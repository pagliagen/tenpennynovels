import { Character, FilteredCharacter } from '../types/character';

/**
 * Utility per filtrare i dati del personaggio in base ai permessi dell'utente
 */
export class CharacterVisibilityFilter {
  
  /**
   * Filtra i dati del personaggio per la visualizzazione pubblica
   * (tutti possono vedere questi campi)
   */
  static filterForPublic(character: Character): FilteredCharacter {
    return {
      id: character.id,
      name: character.name,
      apparentAge: character.apparentAge,
      physicalDescription: character.physicalDescription,
      publicDescription: character.publicDescription,
      occupation: character.occupation,
      socialClass: character.socialClass,

      // Altri campi sempre pubblici
      currentLocation: character.currentLocation,
      isActive: character.isActive,
      isBot: character.isBot, // Indica se è un bot (campo pubblico)
      playerStatus: character.playerStatus,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt
    };
  }

  /**
   * Filtra i dati del personaggio per i master
   * (i master possono vedere tutto)
   */
  static filterForMaster(character: Character): FilteredCharacter {
    // I master possono vedere tutti i campi
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
   * Determina il livello di accesso e filtra di conseguenza
   */
  static filterCharacter(
    character: Character, 
    requestingUserId: string, 
    isMaster: boolean = false
  ): FilteredCharacter {
    
    // Il proprietario del personaggio può vedere tutto
    if (character.userId === requestingUserId) {
      return this.filterForOwner(character);
    }
    
    // I master possono vedere tutto
    if (isMaster) {
      return this.filterForMaster(character);
    }
    
    // Altri utenti vedono solo i campi pubblici
    return this.filterForPublic(character);
  }

  /**
   * Filtra un array di personaggi
   */
  static filterCharacters(
    characters: Character[], 
    requestingUserId: string, 
    isMaster: boolean = false
  ): FilteredCharacter[] {
    return characters.map(character => 
      this.filterCharacter(character, requestingUserId, isMaster)
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