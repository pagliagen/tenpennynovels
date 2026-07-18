/**
 * Character Face Claim Content Component
 *
 * Allows player to view and update their character's face claim (prestavolto).
 * Shows current status, validation, and Wikipedia search.
 *
 * @module components/windows/contents/CharacterFaceClaimContent
 * @since 2.0.0
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';

import { characterApi } from '@/lib/api/character';
import { useAuthStore } from '@/store/authStore';
import styles from '@/styles/components/windows/CharacterFaceClaim.module.scss';
import { logger } from '@/lib/logger';

/**
 * Debounce utility
 */
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Character Face Claim Content Component
 */
export function CharacterFaceClaimContent(): JSX.Element {
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const queryClient = useQueryClient();

  const [prestavolto, setPrestavolto] = React.useState('');
  const [hasChanges, setHasChanges] = React.useState(false);

  // Face claim validation state
  const [faceClaimCheck, setFaceClaimCheck] = React.useState<{
    checking: boolean;
    exactMatch: { characterName: string; status: string } | null;
    allFaceClaims: Array<{
      prestavolto: string;
      characterName: string;
      characterId: string;
      playerStatus: string;
      prestavoltoApprovedAt: Date | null;
    }>;
  }>({
    checking: false,
    exactMatch: null,
    allFaceClaims: []
  });

  // Fetch character data
  const { data: character, isLoading } = useQuery({
    queryKey: ['character', selectedCharacter?._id],
    queryFn: () => characterApi.getById(selectedCharacter!._id),
    enabled: !!selectedCharacter?._id
  });

  // Initialize prestavolto from character data
  React.useEffect(() => {
    if (character && !hasChanges) {
      setPrestavolto(character.prestavolto || '');
    }
  }, [character, hasChanges]);

  // Load all face claims on mount (empty query returns all)
  React.useEffect(() => {
    checkFaceClaim('');
  }, []);

  // Update mutation (uses dedicated prestavolto endpoint)
  const updateMutation = useMutation({
    mutationFn: async (newPrestavolto: string) => {
      if (!selectedCharacter?._id) throw new Error('No character selected');
      return characterApi.updatePrestavolto(selectedCharacter._id, newPrestavolto);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['character', selectedCharacter?._id] });
      setHasChanges(false);

      // Show feedback based on approval status
      if (data.requiresApproval) {
        logger.info('⚠️ Cambio prestavolto richiede approvazione staff');
      } else if (data.hasDuplicate) {
        logger.info('⚠️ Prestavolto duplicato rilevato');
      }
    }
  });

  /**
   * Check face claim with backend
   */
  const checkFaceClaim = React.useCallback(
    debounce(async (value: string) => {
      setFaceClaimCheck({ checking: true, exactMatch: null, allFaceClaims: [] });

      try {
        const result = await characterApi.searchFaceClaims(value);
        setFaceClaimCheck({
          checking: false,
          exactMatch: result.exactMatch,
          allFaceClaims: result.allFaceClaims
        });
      } catch (error) {
        logger.error('Face claim check error:', { error });
        setFaceClaimCheck({ checking: false, exactMatch: null, allFaceClaims: [] });
      }
    }, 500),
    []
  );

  /**
   * Handle prestavolto change
   */
  const handleChange = (value: string) => {
    setPrestavolto(value);
    setHasChanges(value !== (character?.prestavolto || ''));
    checkFaceClaim(value);
  };

  /**
   * Handle save
   */
  const handleSave = () => {
    updateMutation.mutate(prestavolto);
  };

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (!character) {
    return <div className={styles.error}>Personaggio non trovato</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Gestione Prestavolto</h2>
        <p>Modifica il prestavolto (VIP/attore) del tuo personaggio</p>
      </div>

      {/* Current Status */}
      {character.prestavoltoStatus && (
        <div className={styles.statusBanner}>
          {character.prestavoltoStatus === 'pending_duplicate' && (
            <div className={styles.warning}>
              ⚠️ Il tuo prestavolto è in attesa di approvazione staff (duplicato rilevato)
            </div>
          )}
          {character.prestavoltoStatus === 'approved' && (
            <div className={styles.success}>
              ✓ Il tuo prestavolto è stato approvato dallo staff
            </div>
          )}
        </div>
      )}

      {/* Prestavolto Input */}
      <div className={styles.formGroup}>
        <label htmlFor="prestavolto" className={styles.label}>
          Prestavolto
        </label>
        <input
          type="text"
          id="prestavolto"
          value={prestavolto}
          onChange={(e) => handleChange(e.target.value)}
          className={styles.input}
          placeholder="es. Tom Hiddleston, Jane Austen..."
        />
        <small className={styles.helpText}>
          Nome del VIP, attore o scrittore che "presta il volto" al tuo personaggio
        </small>
      </div>

      {/* Validation Feedback */}
      {faceClaimCheck.checking && (
        <div className={styles.feedback}>
          <div className={styles.checking}>Verifica prestavolto...</div>
        </div>
      )}

      {!faceClaimCheck.checking && faceClaimCheck.exactMatch && prestavolto !== character.prestavolto && (
        <div className={styles.feedback}>
          <div className={styles.warning}>
            ⚠️ Prestavolto già usato da <strong>{faceClaimCheck.exactMatch.characterName}</strong>. Richiederà
            approvazione staff.
          </div>
        </div>
      )}

      {!faceClaimCheck.checking && !faceClaimCheck.exactMatch && prestavolto.length >= 3 && prestavolto !== character.prestavolto && (
        <div className={styles.feedback}>
          <div className={styles.success}>✓ Prestavolto disponibile</div>
        </div>
      )}

      {/* Anagrafe Prestavolti - SEMPRE VISIBILE */}
      <div className={styles.registrySection}>
        <h3 className={styles.registryTitle}>Anagrafe Prestavolti</h3>
        <p className={styles.registrySubtitle}>
          Tutti i prestavolti assegnati. Clicca su una riga per selezionarlo.
        </p>

        {faceClaimCheck.checking ? (
          <div className={styles.registryLoading}>Caricamento...</div>
        ) : (
          <>
            {(faceClaimCheck.allFaceClaims || []).length === 0 ? (
              <div className={styles.registryEmpty}>Nessun prestavolto assegnato</div>
            ) : (
              <>
                <div className={styles.registryTableContainer}>
                  <table className={styles.registryTable}>
                    <thead>
                      <tr>
                        <th>Prestavolto</th>
                        <th>Personaggio</th>
                        <th>Data Assegnazione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(faceClaimCheck.allFaceClaims || []).slice(0, 100).map((claim, idx) => (
                        <tr
                          key={idx}
                          onClick={() => handleChange(claim.prestavolto)}
                          className={styles.registryRow}
                        >
                          <td className={styles.prestavoltoCell}>{claim.prestavolto}</td>
                          <td>{claim.characterName}</td>
                          <td className={styles.dateCell}>
                            {claim.prestavoltoApprovedAt
                              ? new Date(claim.prestavoltoApprovedAt).toLocaleDateString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })
                              : <span className={styles.pendingDate}>In attesa</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(faceClaimCheck.allFaceClaims || []).length > 100 && (
                    <div className={styles.registryFooter}>
                      Mostrati primi 100 risultati di {faceClaimCheck.allFaceClaims.length} totali
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Save Button */}
      <div className={styles.actions}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
          className={styles.saveButton}
        >
          {updateMutation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </div>

      {updateMutation.isSuccess && updateMutation.data && (
        <div className={updateMutation.data.requiresApproval ? styles.warningMessage : styles.successMessage}>
          {updateMutation.data.requiresApproval
            ? '⚠️ Prestavolto aggiornato. Richiede approvazione staff per il cambio.'
            : updateMutation.data.hasDuplicate
            ? '✓ Prestavolto aggiornato. Duplicato rilevato - potrebbe richiedere approvazione staff.'
            : '✓ Prestavolto aggiornato con successo!'
          }
        </div>
      )}

      {updateMutation.isError && (
        <div className={styles.errorMessage}>
          ✗ Errore durante il salvataggio: {(updateMutation.error as Error).message}
        </div>
      )}
    </div>
  );
}
