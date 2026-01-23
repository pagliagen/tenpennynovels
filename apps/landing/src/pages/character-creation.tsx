import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Button } from '@/components/Button';
import { AuthService } from '@/lib/auth';
import { VictorianLayout } from '@/components/VictorianLayout';


const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface CharacterData {
  name: string;
  occupation?: string;
  currentOccupation?: string;
  age?: number;
  description?: string;
  background?: string;
}

interface Occupation {
  id: string;
  name: string;
  description: string;
  allowedGenders: string[];
  socialClass: string[];
  category: string;
  rarity: string;
}

export default function CharacterCreationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [occupationsLoading, setOccupationsLoading] = useState(false);
  const [formData, setFormData] = useState<CharacterData>({
    name: '',
    occupation: '',
    currentOccupation: '',
    age: undefined,
    description: '',
    background: ''
  });

  useEffect(() => {
    // Check if user is authenticated
    checkAuthentication();
    // Load occupations from API
    loadOccupations();
  }, []);

  const checkAuthentication = async () => {
    try {
      const result = await AuthService.getProfile();
      if (!result.result || !result.user) {
        // User not authenticated, redirect to login
        router.push('/');
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      router.push('/');
    }
  };

  const loadOccupations = async () => {
    try {
      setOccupationsLoading(true);
      // console.log('🏢 Loading occupations from API...');
      
      // Fetch occupations from auth backend via API Gateway
      const response = await fetch(`${API_BASE_URL}/auth/occupations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.list) {
          // console.log(`🏢 Loaded ${data.list.length} occupations`);
          setOccupations(data.list);
        } else {
          console.error('🏢 Invalid occupations response:', data);
        }
      } else {
        console.error('🏢 Failed to load occupations:', response.status);
      }
    } catch (error) {
      console.error('🏢 Error loading occupations:', error);
    } finally {
      setOccupationsLoading(false);
    }
  };

  const handleInputChange = (field: keyof CharacterData, value: string | number | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Basic validation
      if (!formData.name.trim()) {
        setError('Il nome del personaggio è obbligatorio');
        return;
      }

      if (formData.name.trim().length < 2) {
        setError('Il nome deve avere almeno 2 caratteri');
        return;
      }

      // Prepare character data for creation
      const characterPayload = {
        name: formData.name.trim(),
        occupation: formData.occupation?.trim() || undefined,
        currentOccupation: formData.currentOccupation?.trim() || undefined,
        age: formData.age || undefined,
        description: formData.description?.trim() || undefined,
        background: formData.background?.trim() || undefined
      };

      // Create character via API
      const result = await AuthService.createCharacter(characterPayload);
      
      // console.log('🎭 Character creation result:', result); // Debug logging
      
      if (result.result) {
        setSuccess('Personaggio creato con successo! Verrai reindirizzato alla selezione personaggi...');
        
        // Redirect back to character select after success
        setTimeout(() => {
          router.push('/character-select');
        }, 2000);
      } else {
        // Handle validation errors with detailed feedback
        if (result.code === 'CHARACTER_VALIDATION_ERROR' && result.details) {
          const validationErrors = Object.entries(result.details)
            .map(([field, message]) => `• ${message}`)
            .join('\n');
          setError(`Errori di validazione:\n${validationErrors}`);
        } else if (result.error) {
          setError(result.error);
        } else {
          setError('Errore durante la creazione del personaggio');
        }
      }

    } catch (error) {
      console.error('Character creation failed:', error);
      setError('Errore durante la creazione del personaggio. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/character-select');
  };

  return (
    <>
      <Head>
        <title>TenpennyNovels Londra vittoriana - Creazione Personaggio</title>
        <meta name="description" content="Crea il tuo personaggio per TenpennyNovels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon/favicon.ico" />
      </Head>

      <VictorianLayout subtitle="Creazione Personaggio">
        <form onSubmit={handleSubmit} className="loginForm">
              <div className="formFields">
                {error && (
                  <div className="errorMessage">
                    {error.split('\n').map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </div>
                )}

                {success && (
                  <div className="successMessage">
                    {success}
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Nome Personaggio *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="loginInput"
                  required
                  maxLength={50}
                  disabled={loading}
                />

                <select
                  value={formData.occupation || ''}
                  onChange={(e) => handleInputChange('occupation', e.target.value || undefined)}
                  className="loginInput"
                  disabled={loading || occupationsLoading}
                >
                  <option value="">
                    {occupationsLoading ? 'Caricamento occupazioni...' : 'Seleziona occupazione (opzionale)'}
                  </option>
                  {occupations.map((occupation) => (
                    <option key={occupation.id} value={occupation.id}>
                      {occupation.name} - {occupation.category}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Occupazione attuale (campo libero, opzionale)"
                  value={formData.currentOccupation || ''}
                  onChange={(e) => handleInputChange('currentOccupation', e.target.value)}
                  className="loginInput"
                  maxLength={100}
                  disabled={loading}
                />

                <input
                  type="number"
                  placeholder="Età (opzionale)"
                  value={formData.age || ''}
                  onChange={(e) => handleInputChange('age', parseInt(e.target.value) || undefined)}
                  className="loginInput"
                  min={16}
                  max={80}
                  disabled={loading}
                />

                <textarea
                  placeholder="Descrizione del personaggio (minimo 50 caratteri se compilato)"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="loginInput textArea"
                  rows={3}
                  maxLength={500}
                  disabled={loading}
                  style={{ 
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit'
                  }}
                />
                {formData.description && formData.description.trim().length > 0 && formData.description.trim().length < 50 && (
                  <div style={{ fontSize: '0.8rem', color: '#dc3545', marginTop: '0.25rem' }}>
                    Caratteri: {formData.description.trim().length}/50 (minimo richiesto)
                  </div>
                )}

                <textarea
                  placeholder="Background/Storia del personaggio (opzionale)"
                  value={formData.background}
                  onChange={(e) => handleInputChange('background', e.target.value)}
                  className="loginInput textArea"
                  rows={4}
                  maxLength={1000}
                  disabled={loading}
                  style={{ 
                    resize: 'vertical',
                    minHeight: '100px',
                    fontFamily: 'inherit'
                  }}
                />

                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
                  * Campo obbligatorio
                </div>
              </div>

              <div className="actionsRow">
                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  className="loginButton"
                  disabled={!formData.name.trim() || loading}
                >
                  Crea Personaggio
                </Button>

                <div style={{ marginTop: '1rem' }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancel}
                    style={{ 
                      fontSize: '0.9rem', 
                      padding: '0.75rem 1.5rem',
                      color: 'rgba(255, 149, 0, 0.8)',
                      border: '1px solid rgba(255, 149, 0, 0.3)'
                    }}
                    disabled={loading}
                  >
                    Annulla
                  </Button>
                </div>
            </div>
          </form>
      </VictorianLayout>
    </>
  );
}