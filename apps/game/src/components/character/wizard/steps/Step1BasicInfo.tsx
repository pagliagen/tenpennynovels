/**
 * Step 1: Basic Info Component
 *
 * Layout matching wizard1.png EXACTLY:
 * - Left: Nome+Cognome, DataNascita+EtàApparente, Genere+StatoCivile, Altezza+Peso, Titolo, Occupazione, Segni
 * - Right: Patologie, Fedina Penale
 *
 * @module components/character/wizard/steps/Step1BasicInfo
 * @since 2.0.0
 */

'use client';

import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/Step1BasicInfo.module.scss';
import { EyeIcon } from '../EyeIcon';

/**
 * Calculate age from birthdate (relative to 1895 Victorian setting)
 */
const calculateAge = (birthDateStr: string): number | null => {
  if (!birthDateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(birthDateStr)) return null;

  const [day, month, year] = birthDateStr.split('/').map(Number);

  if (!day || !month || !year || year >= 1895) return null;

  const birthDate = new Date(year, month - 1, day);
  const referenceDate = new Date(1895, 0, 1);
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

interface Step1BasicInfoProps {
  fieldVisibility?: Record<string, boolean>;
}

/**
 * Step 1: Basic Info Component
 */
export function Step1BasicInfo({ fieldVisibility }: Step1BasicInfoProps): JSX.Element {
  const { basicInfo, updateBasicInfo, occupation, updateOccupation, stepErrors, creationConfig } = useWizardStore();

  const ageMin = creationConfig?.limits.age.min ?? 16;
  const ageMax = creationConfig?.limits.age.max ?? 80;

  /**
   * Restituisce true (eye icon visibile) se il campo è privato.
   * Quando fieldVisibility non è ancora caricata, usa il default hardcoded.
   */
  const isPrivate = (configKey: string, defaultIsPublic = true): boolean =>
    fieldVisibility ? !fieldVisibility[configKey] : !defaultIsPublic;
  const errors = stepErrors[1] || {};

  const handleChange = (field: keyof typeof basicInfo, value: any) => {
    updateBasicInfo(field, value);
  };

  const handleBirthDateChange = (value: string) => {
    const age = calculateAge(value);
    updateBasicInfo('birthDate', value);

    if (age !== null && age >= ageMin && age <= ageMax) {
      updateBasicInfo('age', age);
      updateBasicInfo('apparentAge', age);
    }
  };

  return (
    <div className={styles.stepContent} data-step="basic-info">
      <div className={styles.panels}>
        {/* LEFT COLUMN */}
        <div className={styles.formColumn}>
          {/* NOME + COGNOME (stessa riga) */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="firstName" className={styles.label}>
                <EyeIcon visible={isPrivate('name')} /> NOME <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="firstName"
                value={basicInfo.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
                placeholder="Nome"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="lastName" className={styles.label}>
                <EyeIcon visible={isPrivate('surname')} /> COGNOME <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="lastName"
                value={basicInfo.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
                placeholder="Cognome"
              />
            </div>
          </div>

          {/* DATA DI NASCITA + ETÀ APPARENTE (stessa riga) */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="birthDate" className={styles.label}>
                <EyeIcon visible={isPrivate('birthDate', false)} /> DATA DI NASCITA <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="birthDate"
                value={basicInfo.birthDate}
                onChange={(e) => handleBirthDateChange(e.target.value)}
                className={`${styles.input} ${errors.birthDate ? styles.inputError : ''}`}
                placeholder="gg/mm/aaaa"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="apparentAge" className={styles.label}>
                <EyeIcon visible={isPrivate('apparentAge')} /> ETÀ APPARENTE
              </label>
              <input
                type="number"
                id="apparentAge"
                value={basicInfo.apparentAge}
                onChange={(e) => handleChange('apparentAge', parseInt(e.target.value) || 0)}
                className={styles.input}
                min={ageMin}
                max={ageMax}
              />
            </div>
          </div>

          {/* GENERE + STATO CIVILE (stessa riga) */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="gender" className={styles.label}>
                <EyeIcon visible={isPrivate('gender')} /> GENERE <span className={styles.required}>*</span>
              </label>
              <select
                id="gender"
                value={basicInfo.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className={`${styles.select} ${errors.gender ? styles.inputError : ''}`}
              >
                <option value="">Seleziona...</option>
                <option value="male">Maschile</option>
                <option value="female">Femminile</option> 
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="maritalStatus" className={styles.label}>
                <EyeIcon visible={isPrivate('maritalStatus', false)} /> STATO CIVILE
              </label>
              <select
                id="maritalStatus"
                value={basicInfo.maritalStatus}
                onChange={(e) => handleChange('maritalStatus', e.target.value)}
                className={styles.select}
              >
                <option value="">Seleziona...</option>
                <option value="single">Celibe/Nubile</option>
                <option value="married">Coniugato/a</option>
                <option value="widowed">Vedovo/a</option>
                <option value="divorced">Divorziato/a</option>
                <option value="engaged">Fidanzato/a</option>
              </select>
            </div>
          </div>

          {/* ALTEZZA + PESO (stessa riga) */}
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="height" className={styles.label}>
                <EyeIcon visible={isPrivate('height')} /> ALTEZZA <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="height"
                value={basicInfo.height}
                onChange={(e) => handleChange('height', e.target.value)}
                className={`${styles.input} ${errors.height ? styles.inputError : ''}`}
                placeholder={`es. 175 ${creationConfig?.limits.height.unit ?? 'cm'}`}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="weight" className={styles.label}>
                <EyeIcon visible={isPrivate('weight')} /> PESO <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="weight"
                value={basicInfo.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
                className={`${styles.input} ${errors.weight ? styles.inputError : ''}`}
                placeholder={`es. 70 ${creationConfig?.limits.weight.unit ?? 'kg'}`}
              />
            </div>
          </div>

          {/* SEGNI PARTICOLARI NON VISIBILI */}
          <div className={styles.formGroupFull}>
            <label htmlFor="hiddenMarks" className={styles.label}>
              <EyeIcon visible={isPrivate('hiddenMarks', false)} /> SEGNI PARTICOLARI NON VISIBILI
            </label>
            <textarea
              id="hiddenMarks"
              value={basicInfo.hiddenMarks}
              onChange={(e) => handleChange('hiddenMarks', e.target.value)}
              className={styles.textarea}
              rows={3}
            />
            <small className={styles.helpText}>
              Segni normalmente coperti dai vestiti
            </small>
          </div>

          {/* SEGNI PARTICOLARI VISIBILI */}
          <div className={styles.formGroupFull}>
            <label htmlFor="visibleMarks" className={styles.label}>
              SEGNI PARTICOLARI VISIBILI
            </label>
            <textarea
              id="visibleMarks"
              value={basicInfo.visibleMarks}
              onChange={(e) => handleChange('visibleMarks', e.target.value)}
              className={styles.textarea}
              rows={3}
            />
            <small className={styles.helpText}>
              Cicatrici, nei, tatuaggi visibili
            </small>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.infoColumn}>
          {/* PATOLOGIE */}
          <div className={styles.formGroupFull}>
            <label htmlFor="pathologies" className={styles.label}>
              <EyeIcon visible={isPrivate('pathologies', false)} /> PATOLOGIE
            </label>
            <textarea
              id="pathologies"
              value={basicInfo.pathologies}
              onChange={(e) => handleChange('pathologies', e.target.value)}
              className={styles.textarea}
              rows={12}
            />
            <small className={styles.helpText}>
              Condizioni mediche croniche o problemi di salute. Coerente con i valori di Costituzione. Lasciare il campo vuoto se il pg è in salute.
            </small>
          </div>

          {/* FEDINA PENALE */}
          <div className={styles.formGroupFull}>
            <label htmlFor="criminalRecord" className={styles.label}>
              <EyeIcon visible={isPrivate('criminalRecord', false)} /> FEDINA PENALE
            </label>
            <textarea
              id="criminalRecord"
              value={basicInfo.criminalRecord}
              onChange={(e) => handleChange('criminalRecord', e.target.value)}
              className={styles.textarea}
              rows={8}
              placeholder="Nessuna, oppure descrivi..."
            />
            <small className={styles.helpText}>
              Elencare anno, luogo e reato commesso. Es: 1870, Londra, Rapina a mano armata
            </small>
          </div>

          {/* TITOLO DI STUDIO */}
          <div className={styles.formGroupFull}>
          <div className={styles.formGroup}>
            <label htmlFor="educationTitle" className={styles.label}>
              <EyeIcon visible={isPrivate('educationTitle', false)} /> TITOLO DI STUDIO
            </label>
            <input
              type="text"
              id="educationTitle"
              value={basicInfo.educationTitle}
              onChange={(e) => handleChange('educationTitle', e.target.value)}
              className={styles.input}
              placeholder="es. Laurea in Legge, Diploma..."
            />
            </div>
            <small className={styles.helpText}>
              Indicare il titolo di studio ed eventuale specializzazione, in coerenza con il valore di Educazione. Nessun PG è analfabeta e tutti sono in grado di leggere e scrivere.
            </small>
          </div>

          {/* OCCUPAZIONE ATTUALE */}
          <div className={styles.formGroupFull}> 
          <div className={styles.formGroup}>
            <label htmlFor="currentOccupation" className={styles.label}>
              <EyeIcon visible={isPrivate('occupation')} /> OCCUPAZIONE ATTUALE
            </label>
            <input
              type="text"
              id="currentOccupation"
              value={occupation.currentOccupation || ''}
              onChange={(e) => updateOccupation({ currentOccupation: e.target.value })}
              className={styles.input}
              placeholder="es. Avvocato, Medico..."
            />
          </div>
          </div>
        </div>
      </div>

      {/* Stamp */}
      <div className={styles.stamp}>
        <img src="/images/tenpenny.png" alt="" className={styles.stampImage} />
      </div>

      {/* Error Summary */}
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
