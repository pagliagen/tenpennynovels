/**
 * Wizard Container Component
 *
 * Main container for character creation wizard.
 * Manages step navigation, progress indication, and step content rendering.
 *
 * **Responsibilities**:
 * - Initialize wizard store
 * - Route to correct step component
 * - Handle step transitions (with validation)
 * - Display progress indicator
 *
 * @module components/character/wizard/WizardContainer
 * @since 2.0.0
 */

'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useWizardStore } from '@/store/wizardStore';
import { useCharacter, useCreateCharacter, useUpdateCharacter, useSubmitForApproval } from '@/hooks/useCharacter';
import { characterApi } from '@/lib/api/character';
import { WizardHeader } from './WizardHeader';
import { WizardFooter } from './WizardFooter';
import { Step1BasicInfo } from './steps/Step1BasicInfo';
import { Step2Occupation } from './steps/Step2Occupation';
import { Step3Stats } from './steps/Step3Stats';
import { Step4Skills } from './steps/Step4Skills';
import { Step5Background } from './steps/Step5Background';
import { Step6Review } from './steps/Step6Review';
import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Wizard Container Props
 */
interface WizardContainerProps {
  /** Character ID (if editing existing DRAFT) */
  characterId?: string;
}

/**
 * Wizard Container Component
 *
 * Full wizard layout with header, step content, and footer.
 *
 * @param {WizardContainerProps} props - Component props
 * @returns {JSX.Element} Wizard container
 */
export function WizardContainer({ characterId }: WizardContainerProps): JSX.Element {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    validateAll,
    transformForBackend,
    reset,
    loadFromDraft,
  } = useWizardStore();
 
  // Fetch existing character if editing DRAFT
  const { data: existingCharacter, isLoading: isLoadingCharacter } = useCharacter(
    characterId || '',
    { enabled: !!characterId }
  );

  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter(characterId || '');
  const submitForApproval = useSubmitForApproval(characterId || '');

  // Track if data has been loaded to prevent re-loading on every render
  const hasLoadedData = useRef(false);

  /**
   * Initialize wizard on mount
   */
  useEffect(() => {
    if (characterId && existingCharacter && !hasLoadedData.current) {
      // Editing existing DRAFT - load character data into wizard store
      console.log('[WizardContainer] Loading existing DRAFT character into wizard:', characterId);
      loadFromDraft(existingCharacter);
      hasLoadedData.current = true;
    } else if (!characterId && !hasLoadedData.current) {
      // New character - start fresh
      console.log('[WizardContainer] Starting new character wizard');
      reset();
      hasLoadedData.current = true;
    }
  }, [characterId, existingCharacter, loadFromDraft, reset]);

  /**
   * Restore step from URL hash on mount
   */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const stepMatch = hash.match(/^#step-(\d+)$/);
      if (stepMatch && stepMatch[1]) {
        const step = parseInt(stepMatch[1], 10);
        if (step >= 1 && step <= 6) {
          setCurrentStep(step);
          console.log('[WizardContainer] Restored step from URL hash:', step);
        }
      }
    }
  }, []); // Run only once on mount

  /**
   * Update URL hash when currentStep changes
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.hash = `#step-${currentStep}`;
    }
  }, [currentStep]);

  /**
   * Listen to browser back/forward (hashchange event)
   */
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const stepMatch = hash.match(/^#step-(\d+)$/);
      if (stepMatch && stepMatch[1]) {
        const step = parseInt(stepMatch[1], 10);
        if (step >= 1 && step <= 6 && step !== currentStep) {
          setCurrentStep(step);
          console.log('[WizardContainer] Step changed via browser navigation:', step);
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentStep, setCurrentStep]);

  /**
   * Handle Next Step
   *
   * Validates current step before allowing navigation.
   */
  const handleNext = () => {
    const canProceed = nextStep();
    if (!canProceed) {
      console.warn('[WizardContainer] Validation failed, cannot proceed to next step');
    }
  };

  /**
   * Handle Previous Step
   */
  const handlePrev = () => {
    prevStep();
  };

  /**
   * Handle Submit (Step 6)
   *
   * Two-step submission process:
   * 1. Save draft (CREATE new character OR UPDATE existing draft)
   * 2. Submit for approval (DRAFT → PENDING_APPROVAL)
   *
   * @see Archive: _archive/apps/game/src/pages/character/wizard.tsx lines 1585-1615
   */
  const handleSubmit = async () => {
    console.log('[WizardContainer] Starting submission...');

    // Cross-step validation
    const validation = validateAll();
    if (!validation.valid) {
      console.error('[WizardContainer] Cross-step validation failed:', validation.errors);
      alert('Errori di validazione: ' + Object.values(validation.errors).join(', '));
      return;
    }

    try {
      // Transform wizard data to backend format
      const payload = transformForBackend();
      console.log('[WizardContainer] Payload:', payload);

      let finalCharacterId: string;

      // STEP 1: Save draft (CREATE or UPDATE)
      if (characterId) {
        // Editing existing draft → UPDATE
        console.log('[WizardContainer] Updating existing draft:', characterId);
        const character = await updateCharacter.mutateAsync(payload);
        finalCharacterId = character._id;
        console.log('[WizardContainer] Character draft updated:', finalCharacterId);
      } else {
        // New character → CREATE
        console.log('[WizardContainer] Creating new character draft');
        const character = await createCharacter.mutateAsync(payload);
        finalCharacterId = character._id;
        console.log('[WizardContainer] Character draft created:', finalCharacterId);
      }

      // STEP 2: Submit for approval (DRAFT → PENDING_APPROVAL)
      // Use API directly with dynamic finalCharacterId (hook has static characterId from initial render)
      await characterApi.submitForApproval(finalCharacterId);
      console.log('[WizardContainer] Character submitted for approval:', finalCharacterId);

      // Show success message
      alert(
        'Personaggio inviato per approvazione! Lo staff lo revisionerà a breve. Riceverai una notifica quando sarà approvato.'
      );

      // Reset wizard and redirect to homepage
      reset();
      router.push('/');
    } catch (error: any) {
      console.error('[WizardContainer] Submission failed:', error);
      alert('Errore durante l\'invio: ' + (error.message || 'Errore sconosciuto'));
    }
  };

  /**
   * Render Current Step Content
   */
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1BasicInfo />;
      case 2:
        return <Step2Occupation />;
      case 3:
        return <Step3Stats />;
      case 4:
        return <Step4Skills />;
      case 5:
        return <Step5Background />;
      case 6:
        return <Step6Review />;
      default:
        return <div>Invalid step</div>;
    }
  };

  // Show loading while fetching existing character
  if (characterId && isLoadingCharacter) {
    return (
      <div className={styles.wizardContainer}>
        <div className={styles.loading}>
          <p>Caricamento dati personaggio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizardContainer}>
      {/* Header: Progress Indicator */}
      <WizardHeader currentStep={currentStep} totalSteps={6} />

      {/* Main Content: Current Step */}
      <div className={styles.wizardContent}>{renderStepContent()}</div>

      {/* Footer: Navigation Buttons */}
      <WizardFooter
        currentStep={currentStep}
        totalSteps={6}
        onPrev={handlePrev}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isSubmitting={createCharacter.isPending || updateCharacter.isPending || submitForApproval.isPending}
      />
    </div>
  );
}
