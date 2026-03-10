'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useWizardStore } from '@/store/wizardStore';
import { useCharacterForWizard, useCreateCharacter, useUpdateCharacter } from '@/hooks/useCharacter';
import { characterApi } from '@/lib/api/character';
import { validateAllSteps } from './validation/wizardValidation';
import { WizardHeader } from './WizardHeader';
import { WizardFooter } from './WizardFooter';
import { WizardStepToolbar } from './WizardStepToolbar';
import { WizardSlotsProvider, useWizardSlots } from './WizardSlotsContext';
import { Step1BasicInfo } from './steps/Step1BasicInfo';
import { Step2Occupation } from './steps/Step2Occupation';
import { Step3Stats } from './steps/Step3Stats';
import { Step4Skills } from './steps/Step4Skills';
import { Step5Background } from './steps/Step5Background';
import { Step6Review } from './steps/Step6Review';
import styles from '@/styles/components/character/wizard/WizardContainer.module.scss';

interface WizardContainerProps {
  characterId?: string;
}

const STEP_HELP_TEXTS: Record<number, string> = {
  1: 'Inserisci le informazioni base del tuo personaggio.',
  2: "Scegli l'occupazione o esperienza pregressa del tuo personaggio fino ad ora. Questa scelta influenzerà il background e le sue abilità.",
  3: 'Distribuisci 400 punti tra le 8 statistiche base del personaggio.',
  4: 'Assegna i punti abilità in base alla tua occupazione e intelligenza.',
  5: 'Sviluppa la storia e la personalità del tuo personaggio.',
  6: 'Controlla tutti i dati e invia per approvazione.',
};

export function WizardContainer({ characterId }: WizardContainerProps): JSX.Element {
  return (
    <WizardSlotsProvider>
      <WizardContainerInner characterId={characterId} />
    </WizardSlotsProvider>
  );
}

function WizardContainerInner({ characterId }: WizardContainerProps): JSX.Element {
  const router = useRouter();
  const { toolbarContent, footerActionsContent } = useWizardSlots();
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    validateAll,
    transformForBackend,
    reset,
    loadFromDraft,
    basicInfo,
    occupation,
    stats,
    skills,
    dynamicSkills,
    background,
  } = useWizardStore();

  const { data: existingCharacter, isLoading: isLoadingCharacter } = useCharacterForWizard(
    characterId || '',
    { enabled: !!characterId }
  );

  const createCharacter = useCreateCharacter();
  const updateCharacter = useUpdateCharacter(characterId || '');

  const hasLoadedData = useRef(false);

  useEffect(() => {
    if (characterId && existingCharacter && !hasLoadedData.current) {
      loadFromDraft(existingCharacter);
      hasLoadedData.current = true;
    } else if (!characterId && !hasLoadedData.current) {
      reset();
      hasLoadedData.current = true;
    }
  }, [characterId, existingCharacter, loadFromDraft, reset]);

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
    const validation = validateAll();
    if (!validation.valid) {
      alert('Errori di validazione: ' + Object.values(validation.errors).join(', '));
      return;
    }

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

      alert(
        'Personaggio inviato per approvazione! Lo staff lo revisionerà a breve. Riceverai una notifica quando sarà approvato.'
      );

      reset();
      router.push('/');
    } catch (error: any) {
      alert("Errore durante l'invio: " + (error.message || 'Errore sconosciuto'));
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

  const isSubmitting = createCharacter.isPending || updateCharacter.isPending;

  return (
    <div className={styles.wizardContainer}>
      <WizardHeader
        characterName={basicInfo.firstName || 'Nuovo Personaggio'}
        currentStep={currentStep}
        onStepClick={handleStepClick}
        stepValidation={stepValidation}
      />
      <div className={styles.wizardBody}>
        <div className={styles.wizardBodyBackground}></div>
        <WizardStepToolbar>{toolbarContent}</WizardStepToolbar>
        <div className={styles.wizardContent}>
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
