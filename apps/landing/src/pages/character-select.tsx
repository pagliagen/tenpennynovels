import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { AuthService } from '@/lib/auth';
import { VictorianLayout } from '@/components/VictorianLayout';


interface Character {
  id: string;
  name: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELETED';
  occupation?: string;
  gameplayRoles?: string[];
  lastActive?: string;
  submittedAt?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  characters: Character[];
}

export default function CharacterSelectPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selecting, setSelecting] = useState<string>(''); // ID of character being selected

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const result = await AuthService.getProfile();
      
      if (result.result && result.user) {
        setUser(result.user as User);
      } else {
        // User not authenticated, redirect to login
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      setError('Errore nel caricamento dei dati utente');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCharacter = async (characterId: string) => {
    try {
      setSelecting(characterId);
      setError('');
      
      const result = await AuthService.selectCharacter(characterId);
      
      if (result.result) {
        // Redirect to game
        window.location.href = process.env.NEXT_PUBLIC_GAME_URL || 'https://game.tenpennynovels.com';
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

  const handleCreateCharacter = () => {
    router.push('/character-creation');
  };

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getCharacterStatusText = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Bozza';
      case 'PENDING_APPROVAL':
        return 'In attesa di approvazione';
      case 'APPROVED':
        return 'Approvato';
      case 'DELETED':
        return 'Cancellato';
      default:
        return status;
    }
  };

  const getCharacterStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return '#fbbf24'; // yellow
      case 'PENDING_APPROVAL':
        return '#3b82f6'; // blue
      case 'APPROVED':
        return '#10b981'; // green
      case 'DELETED':
        return '#6b7280'; // gray
      default:
        return '#6b7280'; // gray
    }
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Selezione Personaggio</title>
          <meta name="description" content="Seleziona il tuo personaggio per TenpennyNovels" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon/favicon.ico" />
        </Head>
        <VictorianLayout subtitle="Caricamento...">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'rgba(255, 149, 0, 0.8)' }}>Caricamento in corso...</p>
          </div>
        </VictorianLayout>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Selezione Personaggio</title>
        <meta name="description" content="Seleziona il tuo personaggio per TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="Selezione Personaggio">
        {user && (
          <p style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '1.5rem', textAlign: 'center', color: 'rgba(255, 149, 0, 0.8)' }}>
            Benvenuto, {user.username}
          </p>
        )}

        <div className="loginForm">
          <div className="formFields">
            {error && (
              <div className="errorMessage">
                {error}
              </div>
            )}

            {user && user.characters.length > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '1rem', color: '#d4af37' }}>I tuoi personaggi:</h3>
                {user.characters.map((character) => (
                  <div 
                    key={character.id}
                    style={{
                      border: '1px solid #8b7355',
                      borderRadius: '4px',
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      backgroundColor: 'rgba(212, 175, 55, 0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0', color: '#d4af37' }}>
                          {character.name}
                        </h4>
                        <p style={{ 
                          margin: '0', 
                          fontSize: '0.85rem',
                          color: getCharacterStatusColor(character.status)
                        }}>
                          Stato: {getCharacterStatusText(character.status)}
                        </p>
                        {character.occupation && (
                          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', opacity: 0.8 }}>
                            {character.occupation}
                          </p>
                        )}
                      </div>
                      
                      {character.status === 'APPROVED' || character.status === 'DRAFT' || character.status === 'PENDING_APPROVAL' ? (
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
                        <span style={{ 
                          fontSize: '0.8rem', 
                          opacity: 0.6,
                          fontStyle: 'italic'
                        }}>
                          Non disponibile
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                  border: '1px solid rgba(255, 149, 0, 0.3)'
                }}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </VictorianLayout>
    </>
  );
}