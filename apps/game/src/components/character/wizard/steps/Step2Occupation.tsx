/**
 * Step 2: Occupation Component
 *
 * Occupation selection with category filter and card grid.
 *
 * @module components/character/wizard/steps/Step2Occupation
 * @since 2.0.0
 */

'use client';

import { useState, useMemo } from 'react';
import { useWizardStore } from '@/store/wizardStore';
import { useOccupations } from '@/hooks/useCharacterCreation';
import { useWizardToolbar } from '../WizardSlotsContext';
import { OccupationCard } from '../shared/OccupationCard';
import { CategoryFilter } from '../shared/CategoryFilter';
import styles from '@/styles/components/character/wizard/Step2Occupation.module.scss';

/**
 * Step 2: Occupation Component
 *
 * @returns {JSX.Element} Step 2 form
 */
export function Step2Occupation(): JSX.Element {
  const { occupation, updateOccupation, stepErrors } = useWizardStore();
  const errors = stepErrors[2] || {};
  const { data: occupations, isLoading, error: apiError } = useOccupations();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!occupations) return [];
    return [...new Set(occupations.map((o) => o.category))];
  }, [occupations]);

  useWizardToolbar(() => (
    <CategoryFilter
      categories={categories}
      selectedCategory={selectedCategory}
      onSelect={setSelectedCategory}
    />
  ), [categories, selectedCategory]);

  // Filter occupations
  const filteredOccupations = useMemo(() => {
    if (!occupations) return [];
    if (!selectedCategory) return occupations;
    return occupations.filter((o) => o.category === selectedCategory);
  }, [occupations, selectedCategory]);

  const handleSelect = (occupationId: string) => {
    const occ = occupations?.find((o) => o.id === occupationId);
    if (occ) {
      updateOccupation({ occupationId: occ.id, currentOccupation: occ.name });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.stepContent} data-step="occupation">
        <div className={styles.loading}>
          <span className={styles.loadingIcon}>⏳</span>
          <p>Caricamento occupazioni...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (apiError || !occupations) {
    return (
      <div className={styles.stepContent} data-step="occupation">
        <div className={styles.errorState}>
          <h4>❌ Errore nel caricamento delle occupazioni</h4>
          <p>{apiError?.message || 'Impossibile caricare le occupazioni dal server'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stepContent} data-step="occupation">
      <div className={styles.grid}>
        {filteredOccupations.map((occ) => (
          <OccupationCard
            key={occ.id}
            occupation={occ}
            isSelected={occupation.occupationId === occ.id}
            onSelect={() => handleSelect(occ.id)}
          />
        ))}
      </div>

      {Object.keys(errors).length > 0 && (
        <div className={styles.errorSummary}>
          <h4>Errori di Validazione:</h4>
          <ul>
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
