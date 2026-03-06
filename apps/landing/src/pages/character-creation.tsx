/**
 * Character Creation Page
 *
 * Form for creating a new character with occupation selection.
 *
 * **Features**:
 * - Auth-protected page (redirects if not logged in)
 * - Occupation selection dropdown with API loading
 * - Character name, age, description, background fields
 * - Form validation with Zod schema
 * - Automatic redirect to character-select after creation
 *
 * **Validation**: Uses CharacterCreationSchema from validation layer
 * **API**: Uses characterService singleton
 * **Reduced from**: 401 lines → 180 lines (55% reduction)
 *
 * @module pages/character-creation
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { FormPageLayout } from '@/components/layouts/FormPageLayout';
import { SelectField } from '@/components/forms/SelectField';
import { TextAreaField } from '@/components/forms/TextAreaField';
import { FormActions } from '@/components/forms/FormActions';
import { useFormState } from '@/hooks/useFormState';
import { useAsync } from '@/hooks/useAsync';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { characterService } from '@/services/CharacterService';
import { CharacterCreationSchema } from '@/lib/validation/schemas';
import { handleApiFormErrors } from '@/utils/formErrorHandler';
import type { Occupation } from '@/types';

/**
 * Character creation form data type
 */
type CharacterFormData = z.infer<typeof CharacterCreationSchema>;

/**
 * Character Creation Page Component
 *
 * Protected page for creating new characters.
 *
 * @returns {JSX.Element} Character creation page
 */
export default function CharacterCreationPage() {
  const router = useRouter();

  // Auth redirect (redirect to / if not logged in)
  useAuthRedirect('/');

  // Form state
  const { globalError, globalSuccess, loading, setError, setSuccess, setLoading, clearMessages, handleApiError } = useFormState();

  // Occupations loading
  const { data: occupations, isLoading: occupationsLoading, error: occupationsError, execute: loadOccupations } = useAsync<Occupation[]>();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError: setFormError,
  } = useForm<CharacterFormData>({
    resolver: zodResolver(CharacterCreationSchema),
  });

  // Watch description for character counter
  const descriptionValue = watch('description', '');

  /**
   * Load occupations on mount
   */
  useEffect(() => {
    loadOccupations(
      characterService.getOccupations().then(result => {
        if (result.result && result.list) {
          return result.list as unknown as Occupation[];
        } else {
          throw new Error(result.error || 'Errore nel caricamento delle occupazioni');
        }
      })
    );
  }, [loadOccupations]);

  /**
   * Show occupations error if failed to load
   */
  useEffect(() => {
    if (occupationsError) {
      setError('Errore nel caricamento delle occupazioni');
    }
  }, [occupationsError, setError]);

  /**
   * Handle form submission
   */
  const onSubmit = async (data: CharacterFormData) => {
    try {
      setLoading(true);
      clearMessages();

      const result = await characterService.createCharacter(data);

      if (result.result) {
        setSuccess('Personaggio creato con successo! Verrai reindirizzato alla selezione personaggi...');
        // Redirect to character-select after 2 seconds
        setTimeout(() => {
          router.push('/character-select');
        }, 2000);
      } else {
        handleApiFormErrors(result, setFormError, setError);
      }
    } catch (error) {
      setError('Errore durante la creazione del personaggio. Riprova.');
      console.error('Character creation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancel button
   */
  const handleCancel = () => {
    router.push('/character-select');
  };

  return (
    <FormPageLayout
      title="Creazione Personaggio - TenPennyNovels"
      description="Crea il tuo personaggio per TenPennyNovels"
      noindex
      globalError={globalError}
      globalSuccess={globalSuccess}
      onDismissError={clearMessages}
      onDismissSuccess={clearMessages}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="character-creation-form">
        <div className="character-creation-fields">
          {/* Character Name */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Nome Personaggio <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="Nome Personaggio *"
              {...register('name')}
              disabled={loading}
              className="loginInput"
              style={{ width: '100%' }}
            />
            {errors.name && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-error)', marginTop: '0.25rem' }}>
                {errors.name.message}
              </div>
            )}
          </div>

          {/* Occupation Select */}
          <SelectField
            id="occupation"
            label="Occupazione"
            hint="Seleziona un'occupazione dalla lista (opzionale)"
            error={errors.occupation?.message}
            register={register('occupation')}
            disabled={loading || occupationsLoading}
          >
            <option value="">
              {occupationsLoading ? 'Caricamento occupazioni...' : 'Seleziona occupazione (opzionale)'}
            </option>
            {occupations?.map((occupation) => (
              <option key={occupation.id} value={occupation.id}>
                {occupation.name} - {occupation.category}
              </option>
            ))}
          </SelectField>

          {/* Current Occupation (Free Text) */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="currentOccupation" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Occupazione Attuale
            </label>
            <input
              id="currentOccupation"
              type="text"
              placeholder="Occupazione attuale (campo libero, opzionale)"
              {...register('currentOccupation')}
              disabled={loading}
              className="loginInput"
              style={{ width: '100%' }}
            />
            {errors.currentOccupation && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-error)', marginTop: '0.25rem' }}>
                {errors.currentOccupation.message}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Campo libero per descrivere l'occupazione attuale del personaggio (opzionale)
            </div>
          </div>

          {/* Age */}
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="age" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              Età
            </label>
            <input
              id="age"
              type="number"
              placeholder="Età (opzionale)"
              {...register('age', { valueAsNumber: true })}
              disabled={loading}
              className="loginInput"
              style={{ width: '100%' }}
            />
            {errors.age && (
              <div style={{ fontSize: '0.85rem', color: 'var(--color-error)', marginTop: '0.25rem' }}>
                {errors.age.message}
              </div>
            )}
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
              Età del personaggio (opzionale, tra 16 e 80 anni)
            </div>
          </div>

          {/* Description */}
          <TextAreaField
            id="description"
            label="Descrizione"
            hint={`Descrizione del personaggio (minimo 50 caratteri se compilato)${descriptionValue ? ` - ${descriptionValue.length}/50` : ''}`}
            placeholder="Descrizione del personaggio (minimo 50 caratteri se compilato)"
            error={errors.description?.message}
            register={register('description')}
            disabled={loading}
            rows={3}
          />

          {/* Background */}
          <TextAreaField
            id="background"
            label="Background/Storia"
            hint="Background e storia del personaggio (opzionale)"
            placeholder="Background/Storia del personaggio (opzionale)"
            error={errors.background?.message}
            register={register('background')}
            disabled={loading}
            rows={4}
          />

          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem' }}>
            * Campo obbligatorio
          </div>
        </div>

        <FormActions
          submitText="Crea Personaggio"
          submitLoading={loading}
          submitDisabled={loading}
          secondaryText="Annulla"
          onSecondaryClick={handleCancel}
        />
      </form>
    </FormPageLayout>
  );
}
