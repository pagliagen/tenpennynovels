import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CharacterSheetState {
  id: string;
  characterId: string;
  characterName: string;
  avatar?: string;
  audioTheme?: string;
  isMinimized: boolean;
  character?: any; // Full character data
}

interface CharacterSheetsContextType {
  openSheets: CharacterSheetState[];
  openCharacterSheet: (characterId: string, characterName: string, avatar?: string, audioTheme?: string, character?: any) => void;
  closeCharacterSheet: (id: string) => void;
  minimizeCharacterSheet: (id: string) => void;
  restoreCharacterSheet: (id: string) => void;
}

const CharacterSheetsContext = createContext<CharacterSheetsContextType | undefined>(undefined);

export const useCharacterSheets = () => {
  const context = useContext(CharacterSheetsContext);
  if (!context) {
    throw new Error('useCharacterSheets must be used within a CharacterSheetsProvider');
  }
  return context;
};

interface CharacterSheetsProviderProps {
  children: ReactNode;
}

export const CharacterSheetsProvider: React.FC<CharacterSheetsProviderProps> = ({ children }) => {
  const [openSheets, setOpenSheets] = useState<CharacterSheetState[]>([]);

  const openCharacterSheet = (
    characterId: string, 
    characterName: string, 
    avatar?: string, 
    audioTheme?: string,
    character?: any
  ) => {
    // Check if sheet is already open
    const existingSheetIndex = openSheets.findIndex(sheet => sheet.characterId === characterId);
    
    if (existingSheetIndex >= 0) {
      // If minimized, restore it
      setOpenSheets(prev => prev.map((sheet, index) => 
        index === existingSheetIndex 
          ? { ...sheet, isMinimized: false, character }
          : sheet
      ));
    } else {
      // Create new sheet
      const newSheet: CharacterSheetState = {
        id: `sheet-${characterId}-${Date.now()}`,
        characterId,
        characterName,
        avatar,
        audioTheme,
        isMinimized: false,
        character
      };
      setOpenSheets(prev => [...prev, newSheet]);
    }
  };

  const closeCharacterSheet = (id: string) => {
    setOpenSheets(prev => prev.filter(sheet => sheet.id !== id));
  };

  const minimizeCharacterSheet = (id: string) => {
    setOpenSheets(prev => prev.map(sheet => 
      sheet.id === id ? { ...sheet, isMinimized: true } : sheet
    ));
  };

  const restoreCharacterSheet = (id: string) => {
    setOpenSheets(prev => prev.map(sheet => 
      sheet.id === id ? { ...sheet, isMinimized: false } : sheet
    ));
  };

  return (
    <CharacterSheetsContext.Provider value={{
      openSheets,
      openCharacterSheet,
      closeCharacterSheet,
      minimizeCharacterSheet,
      restoreCharacterSheet
    }}>
      {children}
    </CharacterSheetsContext.Provider>
  );
};