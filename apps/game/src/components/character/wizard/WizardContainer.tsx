'use client';

import { useRouter } from 'next/router';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';

import { useCharacterForWizard, useCreateCharacter, useUpdateCharacter } from '@/hooks/useCharacter';
import { characterApi } from '@/lib/api/character';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';
import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/WizardContainer.module.scss';
import type { AuthSessionApiResponse } from '@/types/authSession';

import { Step1BasicInfo } from './steps/Step1BasicInfo';
import { Step2Occupation } from './steps/Step2Occupation';
import { Step3Stats } from './steps/Step3Stats';
import { Step4Skills } from './steps/Step4Skills';
import { Step5Background } from './steps/Step5Background';
import { Step6Review } from './steps/Step6Review';
import { validateAllSteps } from './validation/wizardValidation';
import { WizardFooter } from './WizardFooter';
import { WizardHeader } from './WizardHeader';
import { WizardSlotsProvider, useWizardSlots } from './WizardSlotsContext';
import { WizardStepToolbar } from './WizardStepToolbar';

type SubmitFeedback = {
  type: 'success' | 'error' | 'validation';
  message: string;
  details?: string[];
  warnings?: string[];
} | null;

interface WizardContainerProps {
  characterId?: string;
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

const STEP_HELP_TEXTS: Record<number, string> = {
  1: 'Inserisci le informazioni base del tuo personaggio.',
  2: "Scegli l'occupazione o esperienza pregressa del tuo personaggio fino ad ora. Questa scelta influenzerà il background e le sue abilità.",
  3: 'Distribuisci 400 punti tra le 8 statistiche base del personaggio.',
  4: 'Assegna i punti abilità in base alla tua occupazione e intelligenza.',
  5: 'Sviluppa la storia e la personalità del tuo personaggio.',
  6: 'Controlla tutti i dati e invia per approvazione.',
};

export function WizardContainer({ characterId, onSubmittingChange }: WizardContainerProps): JSX.Element {
  return (
    <WizardSlotsProvider>
      <WizardContainerInner characterId={characterId} onSubmittingChange={onSubmittingChange} />
    </WizardSlotsProvider>
  );
}

function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useWizardStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useWizardStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);
  return hydrated;
}

function WizardContainerInner({ characterId, onSubmittingChange }: WizardContainerProps): JSX.Element {
  const router = useRouter();
  const { toolbarContent, footerActionsContent } = useWizardSlots();
  const { setSelectedCharacter, setGamePermissions, setAdminPanelAccessFromSession, setCharacterBan } =
    useAuthStore();
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    validateAll,
    transformForBackend,
    reset,
    loadFromDraft,
    loadCreationConfig,
    creationConfig,
    basicInfo,
    occupation,
    stats,
    skills,
    dynamicSkills,
    background,
    _draftCharacterId,
    _serverUpdatedAt,
  } = useWizardStore();

  const hasHydrated = useStoreHydrated();

  const {
    data: existingCharacter,
    isLoading: isLoadingCharacter,
    isError: isCharacterError,
    error: characterError,
    refetch: refetchCharacter,
  } = useCharacterForWizard(
    characterId || '',
    { enabled: !!characterId }
  );

  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter(characterId || '');

  const [submitFeedback, setSubmitFeedback] = useState<SubmitFeedback>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const clearFeedback = useCallback(() => setSubmitFeedback(null), []);

  useEffect(() => {
    // CRITICAL FIX: Don't wait for hydration if we have API data
    // The API response takes priority over localStorage
    if (!characterId || !existingCharacter) {
      return;
    }

    // Only check localStorage state if hydration is complete
    if (hasHydrated) {
      // ✅ FIX: Read firstName from store at execution time (not from dependencies)
      // This prevents infinite loop when user types in firstName field
      const currentFirstName = useWizardStore.getState().basicInfo.firstName;
      const draftMatchesCharacter = _draftCharacterId === characterId
        && currentFirstName.trim() !== '';

      // Skip load if draft already matches this character and server data hasn't changed
      if (draftMatchesCharacter) {
        const serverDataChanged = existingCharacter.updatedAt
          && _serverUpdatedAt !== existingCharacter.updatedAt;
        if (!serverDataChanged) {
          return;
        }
      }
    }

    loadFromDraft(existingCharacter);
  }, [hasHydrated, characterId, existingCharacter, _draftCharacterId, _serverUpdatedAt, loadFromDraft]);

  // Load character creation config from backend on mount
  useEffect(() => {
    if (!creationConfig) {
      loadCreationConfig();
    }
  }, [creationConfig, loadCreationConfig]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const stepMatch = hash.match(/^#step-(\d+)$/);
      if (stepMatch && stepMatch[1]) {
        const step = parseInt(stepMatch[1], 10);
        if (step >= 1 && step <= 6) {
          setCurrentStep(step);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.hash = `#step-${currentStep}`;
    }
  }, [currentStep]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const stepMatch = hash.match(/^#step-(\d+)$/);
      if (stepMatch && stepMatch[1]) {
        const step = parseInt(stepMatch[1], 10);
        if (step >= 1 && step <= 6 && step !== currentStep) {
          setCurrentStep(step);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentStep, setCurrentStep]);

  const stepValidation = useMemo(() => {
    const results = validateAllSteps({
      basicInfo,
      occupation,
      stats,
      skills,
      dynamicSkills,
      background,
    });
    const validation: Record<number, boolean> = {};
    for (let i = 1; i <= 6; i++) {
      validation[i] = results[i]?.valid ?? true;
    }
    return validation;
  }, [basicInfo, occupation, stats, skills, dynamicSkills, background]);

  const handleNext = () => {
    nextStep();
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  const handleSubmit = async () => {
    clearFeedback();

    const validation = validateAll();
    if (!validation.valid) {
      setSubmitFeedback({
        type: 'validation',
        message: 'Correggi gli errori prima di inviare il personaggio',
        details: Object.values(validation.errors),
      });
      setTimeout(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return;
    }

    onSubmittingChange?.(true);

    try {
      const payload = transformForBackend();
      let finalCharacterId: string;

      if (characterId) {
        const character = await updateCharacter.mutateAsync(payload);
        finalCharacterId = character._id;
      } else {
        const character = await createCharacter.mutateAsync(payload);
        finalCharacterId = character._id;
      }

      await characterApi.submitForApproval(finalCharacterId);

      // Refresh session to update permissions (wizard access removed for pending characters)
      try {
        const session = await api.get<AuthSessionApiResponse>('/auth/session');
        if (session.success && session.data?.valid) {
          if (session.data.user) {
            setAdminPanelAccessFromSession(!!session.data.user.canAccessAdminPanel);
          }
          if (session.data.character) {
            setSelectedCharacter(session.data.character);
          }
          if (session.data.gamePermissions) {
            setGamePermissions(session.data.gamePermissions);
          }
          setCharacterBan(session.data.ban ?? null);
        }
      } catch {
        // Non-critical: permissions will refresh on next page load
      }

      setSubmitFeedback({
        type: 'success',
        message: 'Personaggio inviato per approvazione! Lo staff lo revisionerà a breve.',
      });

      setTimeout(() => {
        onSubmittingChange?.(false);
        reset();
        router.push('/');
      }, 2500);
    } catch (error: any) {
      onSubmittingChange?.(false);
      const backendErrors = error?.details?.errors || error?.details;
      const backendWarnings = error?.details?.warnings;
      setSubmitFeedback({
        type: 'error',
        message: error.message || 'Errore sconosciuto durante l\'invio',
        details: Array.isArray(backendErrors) ? backendErrors : undefined,
        warnings: Array.isArray(backendWarnings) ? backendWarnings : undefined,
      });
      setTimeout(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return <Step1BasicInfo />;
      case 2: return <Step2Occupation />;
      case 3: return <Step3Stats />;
      case 4: return <Step4Skills />;
      case 5: return <Step5Background />;
      case 6: return <Step6Review />;
      default: return null;
    }
  };

  if (characterId && isLoadingCharacter) {
    return (
      <div className={styles.wizardContainer}>
        <div className={styles.loading}>Caricamento dati personaggio...</div>
      </div>
    );
  }

  if (characterId && isCharacterError) {
    return (
      <div className={styles.wizardContainer}>
        <div className={styles.loading}>
          <p>Errore nel caricamento del personaggio: {characterError?.message || 'Errore sconosciuto'}</p>
          <button
            type="button"
            onClick={() => refetchCharacter()}
            className={styles.retryButton}
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  const isSubmitting = createCharacter.isPending || updateCharacter.isPending;
  const charName = basicInfo.firstName ? `${basicInfo.firstName} ${basicInfo.lastName}` : 'Nuovo Personaggio';

  return (
    <div className={styles.wizardContainer}>
      <WizardHeader
        characterName={charName}
        currentStep={currentStep}
        onStepClick={handleStepClick}
        stepValidation={stepValidation}
      />
      <div className={styles.wizardBody}>
        <div className={styles.wizardBodyBackground}></div>
        <WizardStepToolbar>{toolbarContent}</WizardStepToolbar>
        <div className={styles.wizardContent}>
          {submitFeedback && (
            <div
              ref={feedbackRef}
              className={`${styles.feedbackBanner} ${styles[`feedback--${submitFeedback.type}`]}`}
            >
              <div className={styles.feedbackHeader}>
                <span className={styles.feedbackIcon}>
                  {submitFeedback.type === 'success' && '\u2713'}
                  {submitFeedback.type === 'error' && '\u2717'}
                  {submitFeedback.type === 'validation' && '\u26A0'}
                </span>
                <span className={styles.feedbackMessage}>{submitFeedback.message}</span>
                <button
                  type="button"
                  className={styles.feedbackClose}
                  onClick={clearFeedback}
                  aria-label="Chiudi"
                >&times;</button>
              </div>
              {submitFeedback.details && submitFeedback.details.length > 0 && (
                <ul className={styles.feedbackDetails}>
                  {submitFeedback.details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
              {submitFeedback.warnings && submitFeedback.warnings.length > 0 && (
                <ul className={styles.feedbackWarnings}>
                  {submitFeedback.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {renderStepContent()}
        </div>
      </div>
      <WizardFooter
        currentStep={currentStep}
        totalSteps={6}
        helpText={STEP_HELP_TEXTS[currentStep] || ''}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        customActions={footerActionsContent}
      />
    </div>
  );
}
