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

import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { characterApi } from '@/lib/api/character';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '@/styles/components/windows/CharacterFaceClaim.module.scss';

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
  }>({
    checking: false,
    exactMatch: null
  });

  // Wikipedia results state
  const [wikiResults, setWikiResults] = React.useState<{
    loading: boolean;
    results: Array<{
      title: string;
      extract: string;
      birth?: string;
      death?: string;
      thumbnail?: string;
      isHuman?: boolean;
      occupation?: string;
    }>;
  }>({
    loading: false,
    results: []
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
        console.log('⚠️ Cambio prestavolto richiede approvazione staff');
      } else if (data.hasDuplicate) {
        console.log('⚠️ Prestavolto duplicato rilevato');
      }
    }
  });

  /**
   * Check face claim with backend
   */
  const checkFaceClaim = React.useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) {
        setFaceClaimCheck({ checking: false, exactMatch: null });
        return;
      }

      setFaceClaimCheck({ checking: true, exactMatch: null });

      try {
        const result = await characterApi.searchFaceClaims(value);
        setFaceClaimCheck({
          checking: false,
          exactMatch: result.exactMatch
        });
      } catch (error) {
        console.error('Face claim check error:', error);
        setFaceClaimCheck({ checking: false, exactMatch: null });
      }
    }, 500),
    []
  );

  /**
   * Search Wikipedia + Wikidata validation
   * Filters results to show only real people (Wikidata P31 = Q5)
   */
  const searchWikipedia = React.useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) {
        setWikiResults({ loading: false, results: [] });
        return;
      }

      setWikiResults({ loading: true, results: [] });

      try {
        // Step 1: Fuzzy Wikipedia search
        const strategies = [
          fetch(
            `https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              value
            )}&format=json&origin=*&srlimit=5`
          ),
          fetch(
            `https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              value.split(' ').map(word => `${word}~2`).join(' ')
            )}&format=json&origin=*&srlimit=5`
          )
        ];

        const responses = await Promise.all(strategies);
        const data = await Promise.all(responses.map(r => r.json()));

        const allResults = new Map();
        for (const result of data) {
          if (result.query && result.query.search) {
            for (const page of result.query.search) {
              if (!allResults.has(page.title)) {
                allResults.set(page.title, page);
              }
            }
          }
        }

        const titles = Array.from(allResults.keys()).slice(0, 10);
        if (titles.length === 0) {
          setWikiResults({ loading: false, results: [] });
          return;
        }

        // Step 2: Get page details + Wikidata QIDs
        const propsResponse = await fetch(
          `https://it.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            titles.join('|')
          )}&prop=extracts|pageimages|pageprops&ppprop=wikibase_item&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=100&format=json&origin=*`
        );
        const propsData = await propsResponse.json();

        const pages = propsData.query?.pages || {};
        const pageInfo: Record<string, { qid?: string; thumbnail?: string; extract?: string }> = {};

        for (const pageId in pages) {
          const page = pages[pageId];
          if (page.title) {
            pageInfo[page.title] = {
              qid: page.pageprops?.wikibase_item || undefined,
              thumbnail: page.thumbnail?.source || undefined,
              extract: page.extract || undefined
            };
          }
        }

        // Step 3: Get Wikidata entity details (P31 = instance of, P106 = occupation)
        const qids = Object.values(pageInfo).map(p => p.qid).filter(Boolean) as string[];
        const entityDetails: Record<string, { isHuman: boolean; occupation?: string }> = {};

        if (qids.length > 0) {
          const wikidataResponse = await fetch(
            `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
              qids.join('|')
            )}&props=claims|labels&languages=it|en&format=json&origin=*`
          );
          const wikidataData = await wikidataResponse.json();

          // Collect occupation QIDs for label resolution
          const occQids = new Set<string>();
          for (const entity of Object.values(wikidataData.entities || {}) as any[]) {
            const claims = entity.claims || {};
            for (const claim of (claims.P106 || [])) {
              const occQid = claim.mainsnak?.datavalue?.value?.id;
              if (occQid) occQids.add(occQid);
            }
          }

          // Resolve occupation labels
          let occLabels: Record<string, string> = {};
          if (occQids.size > 0) {
            const labelsResponse = await fetch(
              `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(
                Array.from(occQids).join('|')
              )}&props=labels&languages=it|en&format=json&origin=*`
            );
            const labelsData = await labelsResponse.json();
            for (const [id, entity] of Object.entries(labelsData.entities || {}) as [string, any][]) {
              occLabels[id] = entity.labels?.it?.value || entity.labels?.en?.value || id;
            }
          }

          // Process entities
          for (const [qid, entity] of Object.entries(wikidataData.entities || {}) as [string, any][]) {
            const claims = entity.claims || {};

            // Check P31 (instance of) for Q5 (human)
            const instanceOf = (claims.P31 || [])
              .map((c: any) => c.mainsnak?.datavalue?.value?.id)
              .filter(Boolean);
            const isHuman = instanceOf.includes('Q5');

            // Get first occupation
            const occupations = (claims.P106 || [])
              .map((c: any) => c.mainsnak?.datavalue?.value?.id)
              .filter(Boolean)
              .map((occQid: string) => occLabels[occQid] || occQid);

            entityDetails[qid] = {
              isHuman,
              occupation: occupations[0] || undefined
            };
          }
        }

        // Step 4: Build results (filter only humans)
        const results: Array<{
          title: string;
          extract: string;
          birth?: string;
          death?: string;
          thumbnail?: string;
          isHuman?: boolean;
          occupation?: string;
        }> = [];

        for (const title of titles) {
          const info = pageInfo[title];
          if (!info) continue;

          const details = info.qid ? entityDetails[info.qid] : undefined;

          // Filter: only show humans (or pages without Wikidata)
          if (details && !details.isHuman) continue;

          const extract = info.extract || '';
          const birthMatch = extract.match(/\(([0-9]{4})\s*[-–]\s*/);
          const deathMatch = extract.match(/[-–]\s*([0-9]{4})\)/);

          results.push({
            title,
            extract: extract.substring(0, 200) + (extract.length > 200 ? '...' : ''),
            birth: birthMatch ? birthMatch[1] : undefined,
            death: deathMatch ? deathMatch[1] : undefined,
            thumbnail: info.thumbnail,
            isHuman: details?.isHuman,
            occupation: details?.occupation
          });
        }

        setWikiResults({ loading: false, results: results.slice(0, 5) });
      } catch (error) {
        console.error('Wikipedia search error:', error);
        setWikiResults({ loading: false, results: [] });
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
    searchWikipedia(value);
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

      {/* Wikipedia Results */}
      {wikiResults.loading && (
        <div className={styles.wikiSection}>
          <small>🔍 Ricerca Wikipedia in corso...</small>
        </div>
      )}

      {!wikiResults.loading && wikiResults.results.length > 0 && (
        <div className={styles.wikiSection}>
          <label className={styles.label}>Risultati Wikipedia:</label>
          <div className={styles.wikiResults}>
            {wikiResults.results.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChange(result.title)}
                className={styles.wikiCard}
              >
                <div className={styles.wikiCardContent}>
                  <div className={styles.wikiTitle}>
                    {result.title}
                    {result.birth && (
                      <span className={styles.wikiDates}>
                        ({result.birth}{result.death ? ` - ${result.death}` : ''})
                      </span>
                    )}
                  </div>
                  {result.isHuman && result.occupation && (
                    <div className={styles.wikiOccupation}>
                      {result.occupation}
                    </div>
                  )}
                  <div className={styles.wikiExtract}>{result.extract}</div>
                </div>
                {result.thumbnail && (
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className={styles.wikiThumbnail}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
