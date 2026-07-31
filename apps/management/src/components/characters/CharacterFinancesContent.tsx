/**
 * CharacterFinancesContent
 *
 * Form per il pannello "Finanze" di character-list.tsx: liquidità (cash/bankDeposit, in penny),
 * Valore di Credito (financeSkillValue) e rendita settimanale (creditLine, in penny). Component
 * puramente presentazionale — stato del form e mutation restano nel genitore, stesso
 * pattern già usato da CharacterEditContent per l'avatar (editFormData sollevato al
 * parent, il SidePanel non gestisce questi campi tramite i suoi `config.fields`).
 */

import React from 'react';
import { FormField } from '@/components/shared/FormField';
import { SOCIAL_CLASS_LABELS } from '@/lib/socialClassLabels';
import type { SocialClass } from '@/types/api/CharacterFinances';
import styles from '@/styles/pages/CharacterList.module.scss';

export interface CharacterFinancesFormData {
  cash: number;
  bankDeposit: number;
  financeSkillValue: number;
  creditLineMaxWeekly: number;
  creditLineCurrentAvailable: number;
}

interface CharacterFinancesContentProps {
  isLoading: boolean;
  error: string | null;
  formData: CharacterFinancesFormData;
  onChange: (data: CharacterFinancesFormData) => void;
}

function socialClassFromFinanza(finanza: number): SocialClass {
  if (finanza <= 9) return 'destitute';
  if (finanza <= 19) return 'poor';
  if (finanza <= 39) return 'modest';
  if (finanza <= 49) return 'lower_middle';
  if (finanza <= 69) return 'middle_class';
  if (finanza <= 79) return 'wealthy';
  if (finanza <= 89) return 'affluent';
  return 'elite';
}

export function CharacterFinancesContent({ isLoading, error, formData, onChange }: CharacterFinancesContentProps) {
  if (isLoading) {
    return <p>Caricamento finanze…</p>;
  }

  if (error) {
    return <p className={styles.errorContainer}>{error}</p>;
  }

  const set = (patch: Partial<CharacterFinancesFormData>) => onChange({ ...formData, ...patch });
  const previewSocialClass = socialClassFromFinanza(formData.financeSkillValue);
  const creditLineInvalid = formData.creditLineCurrentAvailable > formData.creditLineMaxWeekly;

  return (
    <div className={styles.editFormStack}>
      <div className={styles.editFormSection}>
        <h3 className={styles.editFormSectionTitle}>Liquidità</h3>
        <FormField
          label="Contanti (cash), in penny"
          name="cash"
          type="number"
          min={0}
          value={formData.cash}
          onChange={(e) => set({ cash: Number(e.target.value) })}
        />
        <FormField
          label="Deposito bancario, in penny"
          name="bankDeposit"
          type="number"
          min={0}
          value={formData.bankDeposit}
          onChange={(e) => set({ bankDeposit: Number(e.target.value) })}
        />
      </div>

      <div className={styles.editFormSection}>
        <h3 className={styles.editFormSectionTitle}>Valore di Credito</h3>
        <FormField
          label="Valore di Credito (1-99)"
          name="financeSkillValue"
          type="number"
          min={1}
          max={99}
          value={formData.financeSkillValue}
          onChange={(e) => set({ financeSkillValue: Number(e.target.value) })}
          helpText={`Classe sociale risultante: ${SOCIAL_CLASS_LABELS[previewSocialClass]}`}
        />
      </div>

      <div className={styles.editFormSection}>
        <h3 className={styles.editFormSectionTitle}>Rendita settimanale</h3>
        <FormField
          label="Rendita massima settimanale, in penny"
          name="creditLineMaxWeekly"
          type="number"
          min={0}
          value={formData.creditLineMaxWeekly}
          onChange={(e) => set({ creditLineMaxWeekly: Number(e.target.value) })}
        />
        <FormField
          label="Credito attualmente disponibile, in penny"
          name="creditLineCurrentAvailable"
          type="number"
          min={0}
          value={formData.creditLineCurrentAvailable}
          onChange={(e) => set({ creditLineCurrentAvailable: Number(e.target.value) })}
          error={creditLineInvalid ? 'Non può superare la rendita massima settimanale' : undefined}
        />
      </div>
    </div>
  );
}
