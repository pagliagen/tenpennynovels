/**
 * Confrontation Modal Component
 *
 * 4-step wizard for creating confrontations (social + combat):
 * 1. Type Selection (social, unarmed, melee, ranged)
 * 2. Skill Selection
 * 3. Target Selection
 * 4. Details (message + Raggirare lie text if needed)
 *
 * @module components/chat/ConfrontationModal
 */

'use client';

import { useState, useMemo } from 'react';
import { locationChatsApi } from '@/lib/api/locationChats';
import styles from '@/styles/components/chat/ConfrontationModal.module.scss';

interface ConfrontationModalProps {
  locationId: string;
  characterSkills?: Array<{ id: string; name: string; value: number; category?: string }>;
  occupants: Array<{ characterId: string; characterName: string }>;
  currentCharacterId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type ConfrontationType = 'social' | 'combat_unarmed' | 'combat_melee' | 'combat_ranged';
type WizardStep = 1 | 2 | 3 | 4;

const CONFRONTATION_TYPES: Array<{ value: ConfrontationType; label: string; icon: string }> = [
  { value: 'social', label: 'Scontro Sociale', icon: '🎭' },
  { value: 'combat_unarmed', label: 'Mani Nude', icon: '👊' },
  { value: 'combat_melee', label: 'Armi Ravvicinate', icon: '⚔️' },
  { value: 'combat_ranged', label: 'Armi Distanza', icon: '🔫' },
];

// Mapping between confrontation types and skill categories
const SKILL_CATEGORY_MAP: Record<ConfrontationType, string[]> = {
  social: ['social'],
  combat_unarmed: ['combat'],
  combat_melee: ['combat'],
  combat_ranged: ['combat'],
};

export function ConfrontationModal({
  locationId,
  characterSkills = [],
  occupants,
  currentCharacterId,
  onClose,
  onSuccess,
}: ConfrontationModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedType, setSelectedType] = useState<ConfrontationType | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [lieText, setLieText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter skills by selected type
  const availableSkills = useMemo(() => {
    if (!selectedType) return [];
    const categories = SKILL_CATEGORY_MAP[selectedType];
    return characterSkills.filter(skill =>
      categories.includes(skill.category || '')
    );
  }, [selectedType, characterSkills]);

  // Filter occupants (exclude self)
  const availableTargets = useMemo(() => {
    return occupants.filter(occ => occ.characterId !== currentCharacterId);
  }, [occupants, currentCharacterId]);

  const handleNext = () => {
    if (step === 1 && !selectedType) {
      setError('Seleziona un tipo di scontro');
      return;
    }
    if (step === 2 && !selectedSkill) {
      setError('Seleziona una skill');
      return;
    }
    if (step === 3 && !selectedTarget) {
      setError('Seleziona un bersaglio');
      return;
    }
    setError(null);
    setStep((step + 1) as WizardStep);
  };

  const handleBack = () => {
    setError(null);
    setStep((step - 1) as WizardStep);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Inserisci un messaggio');
      return;
    }

    if (selectedSkill === 'Raggirare' && !lieText.trim()) {
      setError('Inserisci il testo della bugia');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await locationChatsApi.createConfrontationAttack({
        locationId,
        attackSkill: selectedSkill!,
        defenderId: selectedTarget!,
        content: message.trim(),
        additionalMessage: selectedSkill === 'Raggirare' ? lieText.trim() : undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la creazione dello scontro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTypeSelect = (type: ConfrontationType) => {
    setSelectedType(type);
    setSelectedSkill(null); // Reset skill when type changes
    setError(null);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Crea Scontro</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Chiudi">
            ×
          </button>
        </div>

        {/* Progress indicator */}
        <div className={styles.progressBar}>
          <div className={`${styles.step} ${step >= 1 ? styles.active : ''}`}>1. Tipo</div>
          <div className={`${styles.step} ${step >= 2 ? styles.active : ''}`}>2. Skill</div>
          <div className={`${styles.step} ${step >= 3 ? styles.active : ''}`}>3. Bersaglio</div>
          <div className={`${styles.step} ${step >= 4 ? styles.active : ''}`}>4. Dettagli</div>
        </div>

        <div className={styles.modalBody}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Step 1: Type Selection */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <h3>Seleziona il tipo di scontro</h3>
              <div className={styles.typeGrid}>
                {CONFRONTATION_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleTypeSelect(type.value)}
                    className={`${styles.typeCard} ${selectedType === type.value ? styles.selected : ''}`}
                  >
                    <div className={styles.typeIcon}>{type.icon}</div>
                    <div className={styles.typeLabel}>{type.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Skill Selection */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <h3>Seleziona la skill</h3>
              {availableSkills.length === 0 ? (
                <p className={styles.noSkills}>Non hai skill disponibili per questo tipo di scontro</p>
              ) : (
                <div className={styles.skillList}>
                  {availableSkills.map((skill) => (
                    <button
                      key={skill.id}
                      onClick={() => setSelectedSkill(skill.name)}
                      className={`${styles.skillItem} ${selectedSkill === skill.name ? styles.selected : ''}`}
                    >
                      <span className={styles.skillName}>{skill.name}</span>
                      <span className={styles.skillValue}>{skill.value}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Target Selection */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <h3>Seleziona il bersaglio</h3>
              {availableTargets.length === 0 ? (
                <p className={styles.noTargets}>Nessun personaggio disponibile in questa location</p>
              ) : (
                <div className={styles.targetList}>
                  {availableTargets.map((target) => (
                    <button
                      key={target.characterId}
                      onClick={() => setSelectedTarget(target.characterId)}
                      className={`${styles.targetItem} ${selectedTarget === target.characterId ? styles.selected : ''}`}
                    >
                      {target.characterName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details */}
          {step === 4 && (
            <div className={styles.stepContent}>
              <h3>Dettagli dello scontro</h3>

              <div className={styles.formGroup}>
                <label htmlFor="message">Messaggio (RP)</label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descrivi la tua azione..."
                  maxLength={2000}
                  rows={4}
                  className={styles.textarea}
                />
                <div className={styles.charCount}>{message.length}/2000</div>
              </div>

              {selectedSkill === 'Raggirare' && (
                <div className={styles.formGroup}>
                  <label htmlFor="lieText">Testo della bugia (visibile solo al master)</label>
                  <textarea
                    id="lieText"
                    value={lieText}
                    onChange={(e) => setLieText(e.target.value)}
                    placeholder="Cosa stai dicendo di falso?"
                    maxLength={1000}
                    rows={3}
                    className={styles.textarea}
                  />
                  <div className={styles.charCount}>{lieText.length}/1000</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          {step > 1 && (
            <button onClick={handleBack} className={styles.backButton} disabled={isSubmitting}>
              ← Indietro
            </button>
          )}
          <div className={styles.spacer} />
          {step < 4 ? (
            <button onClick={handleNext} className={styles.nextButton}>
              Avanti →
            </button>
          ) : (
            <button onClick={handleSubmit} className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Invio...' : 'Conferma'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
