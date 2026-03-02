/**
 * Character Select Page
 *
 * Page for selecting a character to play with or creating a new one.
 *
 * **Features**:
 * - Auth-protected page (redirects if not logged in)
 * - Display user's characters with status indicators
 * - Select character to enter game
 * - Create new character button
 * - Logout button
 *
 * **API**: Uses authService and characterService
 * **Reduced from**: 264 lines → 160 lines (39% reduction)
 *
 * @module pages/character-select
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

import { PageLayout } from '@/components/layouts/PageLayout';
import { Card } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Button } from '@/components/Button';
import { Alert } from '@/components/Alert';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useAsync } from '@/hooks/useAsync';
import { authService } from '@/services/AuthService';
import { characterService } from '@/services/CharacterService';
import type { User, Character } from '@/types';

/**
 * Character status text mappings
 */
const CHARACTER_STATUS_TEXT: Record<string, string> = {
  DRAFT: 'Bozza',
  PENDING_APPROVAL: 'In attesa di approvazione',
  APPROVED: 'Approvato',
  DELETED: 'Cancellato',
};

/**
 * Character status color mappings
 */
const CHARACTER_STATUS_COLOR: Record<string, string> = {
  DRAFT: '#fbbf24',
  PENDING_APPROVAL: '#3b82f6',
  APPROVED: '#10b981',
  DELETED: '#6b7280',
};

/**
 * Character Select Page Component
 *
 * Protected page for character selection.
 *
 * @returns {JSX.Element} Character select page
 */
export default function CharacterSelectPage() {
  const router = useRouter();

  // Auth redirect (redirect to / if not logged in)
  useAuthRedirect('/');

  // User profile loading
  const { data: user, isLoading: profileLoading, error: profileError, execute: loadProfile } = useAsync<User>();

  // Character selection state
  const [selecting, setSelecting] = useState<string>('');
  const [error, setError] = useState<string>('');

  /**
   * Load user profile on mount
   */
  useEffect(() => {
    loadProfile(
      authService.getProfile().then(result => {
        if (result.result && result.data) {
          return result.data;
        } else {
          throw new Error(result.error || 'Errore nel caricamento del profilo');
        }
      })
    );
  }, [loadProfile]);

  /**
   * Show profile error if failed to load
   */
  useEffect(() => {
    if (profileError) {
      setError('Errore nel caricamento dei dati utente');
    }
  }, [profileError]);

  /**
   * Handle character selection
   */
  const handleSelectCharacter = async (characterId: string) => {
    try {
      setSelecting(characterId);
      setError('');

      const result = await characterService.selectCharacter(characterId);

      if (result.result) {
        // Redirect to game
        window.location.href = process.env.NEXT_PUBLIC_GAME_URL || 'http://localhost:3010';
      } else {
        setError(result.error || 'Errore durante la selezione del personaggio');
      }
    } catch (error) {
      console.error('Character selection failed:', error);
      setError('Errore di connessione durante la selezione');
    } finally {
      setSelecting('');
    }
  };

  /**
   * Handle create character button
   */
  const handleCreateCharacter = () => {
    router.push('/character-creation');
  };

  /**
   * Handle logout button
   */
  const handleLogout = async () => {
    try {
      await authService.logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Check if character can be selected
   */
  const canSelectCharacter = (status: string) => {
    return status === 'APPROVED' || status === 'DRAFT' || status === 'PENDING_APPROVAL';
  };

  // Show loading skeleton while loading
  if (profileLoading) {
    return (
      <PageLayout title="Selezione Personaggio - TenpennyNovels" description="Seleziona il personaggio con cui giocare" noindex>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSkeleton height="100px" count={3} />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Selezione Personaggio" description="Seleziona il personaggio con cui giocare" noindex>
      {user && (
        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem', textAlign: 'center', color: 'rgba(255, 149, 0, 0.8)' }}>
          Benvenuto, {user.username}
        </p>
      )}

      <div className="loginForm">
        <div className="formFields">
          {error && (
            <Alert
              type="error"
              message={error}
              dismissible
              onDismiss={() => setError('')}
            />
          )}

          {user && user.characters && user.characters.length > 0 ? (
            <>
              <h3 style={{ marginBottom: '1rem', color: '#d4af37' }}>I tuoi personaggi:</h3>
              {user.characters.map((character: Character) => (
                <Card key={character.id} className="character-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem 0', color: '#d4af37' }}>
                        {character.name}
                      </h4>
                      <p style={{
                        margin: '0',
                        fontSize: '0.85rem',
                        color: CHARACTER_STATUS_COLOR[character.status] || '#6b7280',
                      }}>
                        Stato: {CHARACTER_STATUS_TEXT[character.status] || character.status}
                      </p>
                      {character.occupation && (
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                          {character.occupation}
                        </p>
                      )}
                    </div>

                    {canSelectCharacter(character.status) ? (
                      <Button
                        type="button"
                        variant="primary"
                        loading={selecting === character.id}
                        onClick={() => handleSelectCharacter(character.id)}
                        style={{ minWidth: '100px' }}
                      >
                        Seleziona
                      </Button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', opacity: 0.6, fontStyle: 'italic' }}>
                        Non disponibile
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </>
          ) : (
            <div style={{ textAlign: 'center', margin: '2rem 0' }}>
              <p style={{ marginBottom: '1rem', opacity: 0.8 }}>
                Non hai ancora nessun personaggio.
              </p>
            </div>
          )}
        </div>

        <div className="actionsRow">
          <Button
            type="button"
            variant="primary"
            onClick={handleCreateCharacter}
            className="loginButton"
          >
            Crea Personaggio
          </Button>

          <div style={{ marginTop: '1rem' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={handleLogout}
              style={{
                fontSize: '0.9rem',
                padding: '0.75rem 1.5rem',
                color: 'rgba(255, 149, 0, 0.8)',
                border: '1px solid rgba(255, 149, 0, 0.3)',
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
