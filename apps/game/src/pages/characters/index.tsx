import React from 'react';
import { CharacterListView } from '@/components/CharacterListView';
import { GameInitResponse } from '@/lib/gameApi';

interface CharactersPageProps {
  gameData: GameInitResponse;
}

export default function CharactersPage({ gameData }: CharactersPageProps) {
  return <CharacterListView />;
} 
