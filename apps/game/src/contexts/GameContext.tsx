import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { GameInitResponse } from '@/lib/gameApi';

interface Character {
  id: string;
  name: string;
  surname?: string;
  currentLocationId: string | null;
  status: string;
  gameplayRoles: string[];
  hitPoints?: number;
  magicPoints?: number;
  sanity?: number;
  occupation?: string;
  avatar?: string;
}

export interface GlobalPresenceCharacter {
  characterId: string;
  characterName: string;
  characterSurname: string | null;
  locationId: string | null;
  locationName: string;
  isCurrentCharacter: boolean;
  avatar: string | null;
}

interface GameContextType {
  // Static config data (dall'init, non cambia mai)
  gameData: GameInitResponse;
  
  // Dynamic states (si aggiornano durante il gioco)
  character: Character | null;
  globalPresence: GlobalPresenceCharacter[];
  
  // Actions
  updateCharacter: (updates: Partial<Character>) => void;
  updateGlobalPresence: (newGlobalPresence: GlobalPresenceCharacter[]) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
  gameData: GameInitResponse;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children, gameData }) => {
  // Initialize character from gameData (once)
  const [character, setCharacter] = useState<Character | null>(() => {
    if (!gameData.character) return null;
    
    return {
      id: gameData.character.id,
      name: gameData.character.name,
      currentLocationId: gameData.character.currentLocation || null,
      status: gameData.character.status || 'UNKNOWN',
      gameplayRoles: gameData.character.gameplayRoles || [],
      hitPoints: gameData.character.hitPoints,
      magicPoints: gameData.character.magicPoints,
      sanity: gameData.character.sanity,
      occupation: gameData.character.occupation,
      avatar: gameData.globalPresence?.find(char => char.isCurrentCharacter)?.avatar || undefined
    };
  });

  // Initialize globalPresence from gameData (once)  
  const [globalPresence, setGlobalPresence] = useState<GlobalPresenceCharacter[]>(
    gameData.globalPresence || []
  );

  // Update character (partial update)
  const updateCharacter = useCallback((updates: Partial<Character>) => {
    // console.log('🎮 GameContext: Updating character:', updates);
    
    setCharacter(prevCharacter => {
      if (!prevCharacter) return null;
      const updated = { ...prevCharacter, ...updates };
      
      // Se cambia currentLocationId, aggiorna anche globalPresence
      if (updates.currentLocationId !== undefined) {
        setGlobalPresence(prevGlobalPresence => 
          prevGlobalPresence.map(char => 
            char.isCurrentCharacter 
              ? { ...char, locationId: updates.currentLocationId || null }
              : char
          )
        );
      }
      
      return updated;
    });
  }, []);

  // Update globalPresence (full replace, usually from WebSocket)
  const updateGlobalPresence = useCallback((newGlobalPresence: GlobalPresenceCharacter[]) => {
    // console.log('🎮 GameContext: Updating globalPresence from WebSocket:', newGlobalPresence);
    setGlobalPresence(newGlobalPresence);
    
    // Aggiorna anche character se il nostro personaggio ha cambiato location
    const currentChar = newGlobalPresence.find(char => char.isCurrentCharacter);
    if (currentChar && character && currentChar.locationId !== character.currentLocationId) {
      setCharacter(prev => prev ? { ...prev, currentLocationId: currentChar.locationId } : null);
    }
  }, [character]);

  return (
    <GameContext.Provider value={{ 
      gameData,
      character,
      globalPresence,
      updateCharacter,
      updateGlobalPresence
    }}>
      {children}
    </GameContext.Provider>
  );
};