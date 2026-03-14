/**
 * Step 1: Basic Info Component
 *
 * Character basic information form:
 * - Personal info (name, age, gender, birthplace)
 * - Appearance (height, weight, eye/hair color)
 * - Background (marital status, education, criminal record)
 * - Health (illnesses, visible/hidden marks)
 *
 * @module components/character/wizard/steps/Step1BasicInfo
 * @since 2.0.0
 */

'use client';

import React from 'react';
import { useWizardStore } from '@/store/wizardStore';
import { characterApi } from '@/lib/api/character';
import styles from '@/styles/components/character/wizard/Step1BasicInfo.module.scss';

/**
 * Calculate age from birthdate (relative to 1895 Victorian setting)
 */
const calculateAge = (birthDateStr: string): number | null => {
  if (!birthDateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(birthDateStr)) return null;

  const [day, month, year] = birthDateStr.split('/').map(Number);

  // Validation: ensure all parts are valid numbers and year must be < 1895
  if (!day || !month || !year || year >= 1895) return null;

  const birthDate = new Date(year, month - 1, day);
  const referenceDate = new Date(1895, 0, 1); // January 1, 1895
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

/**
 * Debounce utility function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Step 1: Basic Info Component
 *
 * Complete form for character basic information.
 * Fields are organized into logical sections.
 *
 * @returns {JSX.Element} Step 1 form
 */
export function Step1BasicInfo(): JSX.Element {
  const { basicInfo, updateBasicInfo, stepErrors } = useWizardStore();
  const errors = stepErrors[1] || {};

  // Name availability check state
  const [nameCheck, setNameCheck] = React.useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({
    checking: false,
    available: null,
    message: ''
  });

  // Face claim validation state
  const [faceClaimCheck, setFaceClaimCheck] = React.useState<{
    checking: boolean;
    exists: boolean;
    matches: Array<{ prestavolto: string; characterName: string; status: string }>;
    allFaceClaims: Array<{
      prestavolto: string;
      characterName: string;
      characterId: string;
      playerStatus: string;
    }>;
    exactMatch: { characterName: string; status: string } | null;
  }>({
    checking: false,
    exists: false,
    matches: [],
    allFaceClaims: [],
    exactMatch: null
  });

  // Wikipedia search results state
  const [wikiResults, setWikiResults] = React.useState<{
    loading: boolean;
    results: Array<{
      title: string;
      extract: string;
      occupation?: string;
      birth?: string;
      death?: string;
    }>;
  }>({
    loading: false,
    results: []
  });

  /**
   * Check name availability with debounce
   */
  const checkName = React.useCallback(
    debounce(async (firstName: string, lastName: string) => {
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

      // Reset if name too short
      if (fullName.length < 2) {
        setNameCheck({ checking: false, available: null, message: '' });
        return;
      }

      setNameCheck({ checking: true, available: null, message: 'Verifica disponibilità...' });

      try {
        const result = await characterApi.checkNameAvailability(fullName);

        if (result.available) {
          setNameCheck({
            checking: false,
            available: true,
            message: '✓ Nome disponibile'
          });
        } else {
          setNameCheck({
            checking: false,
            available: false,
            message: result.error || 'Nome già in uso. Scegli un altro nome.'
          });
        }
      } catch (error) {
        console.error('Name check error:', error);
        setNameCheck({
          checking: false,
          available: null,
          message: ''
        });
      }
    }, 500),
    []
  );

  /**
   * Check face claim availability with debounce
   */
  const checkFaceClaim = React.useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) {
        setFaceClaimCheck({
          checking: false,
          exists: false,
          matches: [],
          allFaceClaims: [],
          exactMatch: null
        });
        return;
      }

      setFaceClaimCheck((prev) => ({ ...prev, checking: true }));

      try {
        const result = await characterApi.searchFaceClaims(value);

        setFaceClaimCheck({
          checking: false,
          exists: result.exactMatch !== null,
          matches: result.matches,
          allFaceClaims: result.allFaceClaims,
          exactMatch: result.exactMatch
        });
      } catch (error) {
        console.error('Face claim check error:', error);
        setFaceClaimCheck({
          checking: false,
          exists: false,
          matches: [],
          allFaceClaims: [],
          exactMatch: null
        });
      }
    }, 500),
    []
  );

  /**
   * Search Wikipedia for face claim suggestions (multi-strategy)
   */
  const searchWikipedia = React.useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) {
        setWikiResults({ loading: false, results: [] });
        return;
      }

      setWikiResults({ loading: true, results: [] });

      try {
        // Multi-strategy Wikipedia search (from test-wikipedia-search.html)
        const strategies = [
          // Strategy 1: Normal search
          fetch(
            `https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              value
            )}&format=json&origin=*&srlimit=5`
          ),
          // Strategy 2: Fuzzy search with CirrusSearch
          fetch(
            `https://it.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
              value.split(' ').map(word => `${word}~2`).join(' ')
            )}&format=json&origin=*&srlimit=5`
          )
        ];

        const responses = await Promise.all(strategies);
        const data = await Promise.all(responses.map(r => r.json()));

        // Combine results (deduplicate by title)
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

        // Fetch extracts + Wikidata validation for top results
        const titles = Array.from(allResults.keys()).slice(0, 10);
        if (titles.length === 0) {
          setWikiResults({ loading: false, results: [] });
          return;
        }

        const extractsResponse = await fetch(
          `https://it.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
            titles.join('|')
          )}&prop=extracts|pageprops&exintro=1&explaintext=1&format=json&origin=*`
        );
        const extractsData = await extractsResponse.json();

        const pages = extractsData.query?.pages || {};
        const results: Array<{
          title: string;
          extract: string;
          occupation?: string;
          birth?: string;
          death?: string;
        }> = [];

        for (const pageId in pages) {
          const page = pages[pageId];
          if (page.title && page.extract) {
            // Extract birth/death from extract (simple regex)
            const birthMatch = page.extract.match(/\(([0-9]{4})\s*[-–]\s*/);
            const deathMatch = page.extract.match(/[-–]\s*([0-9]{4})\)/);

            results.push({
              title: page.title,
              extract: page.extract.substring(0, 200) + '...',
              birth: birthMatch ? birthMatch[1] : undefined,
              death: deathMatch ? deathMatch[1] : undefined
            });
          }
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
   * Handle Field Change
   */
  const handleChange = (field: keyof typeof basicInfo, value: any) => {
    updateBasicInfo(field, value);

    // Trigger name availability check
    if (field === 'firstName' || field === 'lastName') {
      const newFirstName = field === 'firstName' ? value : basicInfo.firstName;
      const newLastName = field === 'lastName' ? value : basicInfo.lastName;
      checkName(newFirstName, newLastName);
    }

    // Trigger face claim validation + Wikipedia search
    if (field === 'prestavolto') {
      checkFaceClaim(value);
      searchWikipedia(value);
    }
  };

  /**
   * Handle Birth Date Change with Age Calculation
   */
  const handleBirthDateChange = (value: string) => {
    const age = calculateAge(value);

    // Update birthDate
    updateBasicInfo('birthDate', value);

    // Auto-update age and apparentAge if valid
    if (age !== null && age >= 18 && age <= 80) {
      updateBasicInfo('age', age);
      updateBasicInfo('apparentAge', age);
    }
  };

  return (
    <div className={styles.stepContent} data-step="basic-info">
      {/* Section: Personal Info */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Informazioni Personali</h3>

        <div className={styles.formRow}>
          {/* First Name */}
          <div className={styles.formGroup}>
            <label htmlFor="firstName" className={styles.label}>
              Nome <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={basicInfo.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
              placeholder="es. Arthur"
            />
            {errors.firstName && <span className={styles.error}>{errors.firstName}</span>}
          </div>

          {/* Last Name */}
          <div className={styles.formGroup}>
            <label htmlFor="lastName" className={styles.label}>
              Cognome <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="lastName"
              value={basicInfo.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
              placeholder="es. Pemberton"
            />
            {errors.lastName && <span className={styles.error}>{errors.lastName}</span>}
          </div>
        </div>

        {/* Name Availability Feedback */}
        {(nameCheck.checking || nameCheck.available !== null) && (
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <div className={`${styles.nameAvailability} ${
                nameCheck.checking ? styles.checking :
                nameCheck.available ? styles.available :
                styles.unavailable
              }`}>
                {nameCheck.message}
              </div>
            </div>
          </div>
        )}

        <div className={styles.formRow}>
          {/* Gender */}
          <div className={styles.formGroup}>
            <label htmlFor="gender" className={styles.label}>
              Genere <span className={styles.required}>*</span>
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
              <option value="other">Altro</option>
            </select>
            {errors.gender && <span className={styles.error}>{errors.gender}</span>}
          </div>

          {/* Birthplace */}
          <div className={styles.formGroup}>
            <label htmlFor="birthplace" className={styles.label}>
              Luogo di Nascita <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="birthplace"
              value={basicInfo.birthplace}
              onChange={(e) => handleChange('birthplace', e.target.value)}
              className={`${styles.input} ${errors.birthplace ? styles.inputError : ''}`}
              placeholder="es. Londra, Inghilterra"
            />
            {errors.birthplace && <span className={styles.error}>{errors.birthplace}</span>}
          </div>
        </div>

        <div className={styles.formRow}>
          {/* Birth Date */}
          <div className={styles.formGroup}>
            <label htmlFor="birthDate" className={styles.label}>
              Data di Nascita <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="birthDate"
              value={basicInfo.birthDate}
              onChange={(e) => handleBirthDateChange(e.target.value)}
              className={`${styles.input} ${
                basicInfo.birthDate &&
                /^\d{2}\/\d{2}\/\d{4}$/.test(basicInfo.birthDate) &&
                parseInt(basicInfo.birthDate.split('/')[2] ?? '0', 10) >= 1895
                  ? styles.inputError
                  : ''
              }`}
              placeholder="es. 15/03/1870"
            />
            {basicInfo.birthDate &&
            /^\d{2}\/\d{2}\/\d{4}$/.test(basicInfo.birthDate) &&
            parseInt(basicInfo.birthDate.split('/')[2] ?? '0', 10) >= 1895 ? (
              <small className={styles.error}>
                ⛔ Anno di nascita deve essere inferiore al 1895 (ambientazione vittoriana del 1895)
              </small>
            ) : (
              <small className={styles.helpText}>
                Formato: gg/mm/aaaa. Anno &lt; 1895. Età al 1895:{' '}
                {basicInfo.age && basicInfo.age > 0 ? `${basicInfo.age} anni` : '-'}
              </small>
            )}
          </div>

          {/* Age (Read-only, calculated from birthDate) */}
          <div className={styles.formGroup}>
            <label htmlFor="age" className={styles.label}>
              Età <span className={styles.required}>*</span>
            </label>
            <input
              type="number"
              id="age"
              value={basicInfo.age || ''}
              readOnly
              className={`${styles.input} ${styles.inputReadonly} ${errors.age ? styles.inputError : ''}`}
            />
            <small className={styles.helpText}>Calcolata automaticamente dalla data di nascita (18-80 anni)</small>
            {errors.age && <span className={styles.error}>{errors.age}</span>}
          </div>

          {/* Apparent Age */}
          <div className={styles.formGroup}>
            <label htmlFor="apparentAge" className={styles.label}>
              Età Apparente
            </label>
            <input
              type="number"
              id="apparentAge"
              value={basicInfo.apparentAge}
              onChange={(e) => handleChange('apparentAge', parseInt(e.target.value) || 0)}
              min={16}
              max={80}
              className={styles.input}
            />
            <small className={styles.helpText}>
              L'età che il personaggio dimostra (può differire dall'età reale)
            </small>
          </div>
        </div>
      </div>

      {/* Section: Appearance */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Aspetto Fisico</h3>

        <div className={styles.formRow}>
          {/* Height */}
          <div className={styles.formGroup}>
            <label htmlFor="height" className={styles.label}>
              Altezza <span className={styles.required}>*</span>
            </label>
            <input
              type="number"
              id="height"
              value={basicInfo.height}
              onChange={(e) => handleChange('height', e.target.value)}
              className={`${styles.input} ${errors.height ? styles.inputError : ''}`}
              placeholder="es. 175"
              min={100}
              max={250}
            />
            <small className={styles.helpText}>Altezza in centimetri (100-250 cm)</small>
            {errors.height && <span className={styles.error}>{errors.height}</span>}
          </div>

          {/* Weight */}
          <div className={styles.formGroup}>
            <label htmlFor="weight" className={styles.label}>
              Peso <span className={styles.required}>*</span>
            </label>
            <input
              type="number"
              id="weight"
              value={basicInfo.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              className={`${styles.input} ${errors.weight ? styles.inputError : ''}`}
              placeholder="es. 70"
              min={30}
              max={200}
            />
            <small className={styles.helpText}>Peso in kilogrammi (30-200 kg)</small>
            {errors.weight && <span className={styles.error}>{errors.weight}</span>}
          </div>
        </div>

        <div className={styles.formRow}>
          {/* Eye Color */}
          <div className={styles.formGroup}>
            <label htmlFor="eyeColor" className={styles.label}>
              Colore Occhi
            </label>
            <input
              type="text"
              id="eyeColor"
              value={basicInfo.eyeColor}
              onChange={(e) => handleChange('eyeColor', e.target.value)}
              className={styles.input}
              placeholder="es. Azzurri"
            />
          </div>

          {/* Hair Color */}
          <div className={styles.formGroup}>
            <label htmlFor="hairColor" className={styles.label}>
              Colore Capelli
            </label>
            <input
              type="text"
              id="hairColor"
              value={basicInfo.hairColor}
              onChange={(e) => handleChange('hairColor', e.target.value)}
              className={styles.input}
              placeholder="es. Castani"
            />
          </div>
        </div>

        {/* Visible Marks */}
        <div className={styles.formGroup}>
          <label htmlFor="visibleMarks" className={styles.label}>
            Segni Particolari Visibili
          </label>
          <textarea
            id="visibleMarks"
            value={basicInfo.visibleMarks}
            onChange={(e) => handleChange('visibleMarks', e.target.value)}
            className={styles.textarea}
            rows={3}
            placeholder="es. Cicatrice sulla guancia sinistra, tatuaggio sul braccio..."
          />
          <small className={styles.helpText}>
            Cicatrici, tatuaggi, nei o altri segni visibili agli altri
          </small>
        </div>

        {/* Hidden Marks */}
        <div className={styles.formGroup}>
          <label htmlFor="hiddenMarks" className={styles.label}>
            Segni Particolari Nascosti
          </label>
          <textarea
            id="hiddenMarks"
            value={basicInfo.hiddenMarks}
            onChange={(e) => handleChange('hiddenMarks', e.target.value)}
            className={styles.textarea}
            rows={3}
            placeholder="es. Bruciature sul torso, voglia sulla schiena..."
          />
          <small className={styles.helpText}>
            Segni normalmente coperti dai vestiti, visibili solo in intimità
          </small>
        </div>
      </div>

      {/* Section: Prestavolto (Face Claim) */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Prestavolto</h3>

        {/* Prestavolto Input */}
        <div className={styles.formGroup}>
          <label htmlFor="prestavolto" className={styles.label}>
            Prestavolto (VIP/Attore/Scrittore)
          </label>
          <input
            type="text"
            id="prestavolto"
            value={basicInfo.prestavolto}
            onChange={(e) => handleChange('prestavolto', e.target.value)}
            className={styles.input}
            placeholder="es. Tom Hiddleston, Jane Austen..."
          />
          <small className={styles.helpText}>
            Nome del VIP, attore o scrittore che "presta il volto" al tuo personaggio
          </small>
        </div>

        {/* Face Claim Validation Feedback */}
        {faceClaimCheck.checking && (
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <div className={`${styles.nameAvailability} ${styles.checking}`}>
                Verifica prestavolto...
              </div>
            </div>
          </div>
        )}

        {!faceClaimCheck.checking && faceClaimCheck.exactMatch && (
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <div className={`${styles.nameAvailability} ${styles.unavailable}`}>
                ⚠️ Prestavolto già usato da <strong>{faceClaimCheck.exactMatch.characterName}</strong>. Richiederà
                approvazione staff.
              </div>
            </div>
          </div>
        )}

        {!faceClaimCheck.checking && !faceClaimCheck.exactMatch && basicInfo.prestavolto.length >= 3 && (
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
              <div className={`${styles.nameAvailability} ${styles.available}`}>
                ✓ Prestavolto disponibile
              </div>
            </div>
          </div>
        )}

        {/* Wikipedia Search Results */}
        {wikiResults.loading && (
          <div className={styles.formGroup}>
            <small className={styles.helpText}>🔍 Ricerca Wikipedia in corso...</small>
          </div>
        )}

        {!wikiResults.loading && wikiResults.results.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Risultati Wikipedia (clicca per selezionare):</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {wikiResults.results.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChange('prestavolto', result.title)}
                  style={{
                    padding: '0.75rem',
                    border: '1px solid #8b7355',
                    background: '#f5f1e8',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Playfair Display, serif'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {result.title}
                    {result.birth && (
                      <span style={{ fontWeight: 'normal', marginLeft: '0.5rem', fontSize: '0.9em' }}>
                        ({result.birth}{result.death ? ` - ${result.death}` : ''})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#5a4a3a' }}>{result.extract}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Face Claims List */}
        {faceClaimCheck.allFaceClaims.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Prestavolti già usati (clicca per selezionare):</label>
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #8b7355', borderRadius: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Playfair Display, serif' }}>
                <thead>
                  <tr style={{ background: '#d4c4a8', borderBottom: '2px solid #8b7355' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 'bold' }}>Prestavolto</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 'bold' }}>Personaggio</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 'bold' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {faceClaimCheck.allFaceClaims.slice(0, 50).map((claim, idx) => (
                    <tr
                      key={idx}
                      onClick={() => handleChange('prestavolto', claim.prestavolto)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid #e0d5c7',
                        background: idx % 2 === 0 ? '#f9f6f0' : '#ffffff'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f0e8d8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = idx % 2 === 0 ? '#f9f6f0' : '#ffffff';
                      }}
                    >
                      <td style={{ padding: '0.5rem' }}>{claim.prestavolto}</td>
                      <td style={{ padding: '0.5rem' }}>{claim.characterName}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.85em', color: '#5a4a3a' }}>
                        {claim.playerStatus === 'approved' ? '✓ Approvato' : '⏳ In attesa'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className={styles.helpText}>
              Clicca su una riga per auto-compilare il campo (puoi comunque modificarlo manualmente)
            </small>
          </div>
        )}
      </div>

      {/* Section: Background */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Background Sociale</h3>

        <div className={styles.formRow}>
          {/* Marital Status */}
          <div className={styles.formGroup}>
            <label htmlFor="maritalStatus" className={styles.label}>
              Stato Civile
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

          {/* Education Title */}
          <div className={styles.formGroup}>
            <label htmlFor="educationTitle" className={styles.label}>
              Titolo di Studio
            </label>
            <input
              type="text"
              id="educationTitle"
              value={basicInfo.educationTitle}
              onChange={(e) => handleChange('educationTitle', e.target.value)}
              className={styles.input}
              placeholder="es. Laurea in Legge, Diploma Classico..."
            />
          </div>
        </div>

        {/* Criminal Record */}
        <div className={styles.formGroup}>
          <label htmlFor="criminalRecord" className={styles.label}>
            Precedenti Penali
          </label>
          <textarea
            id="criminalRecord"
            value={basicInfo.criminalRecord}
            onChange={(e) => handleChange('criminalRecord', e.target.value)}
            className={styles.textarea}
            rows={2}
            placeholder="Nessuno, oppure descrivi eventuali reati commessi..."
          />
        </div>
      </div>

      {/* Section: Health */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Salute</h3>

        <div className={styles.formGroup}>
          <label htmlFor="illnesses" className={styles.label}>
            Malattie o Condizioni Mediche
          </label>
          <textarea
            id="illnesses"
            value={basicInfo.illnesses}
            onChange={(e) => handleChange('illnesses', e.target.value)}
            className={styles.textarea}
            rows={3}
            placeholder="es. Asma, ferite di guerra, dipendenza da laudano..."
          />
          <small className={styles.helpText}>
            Malattie croniche, disabilità, dipendenze o condizioni mediche rilevanti
          </small>
        </div>
      </div>

      {/* Validation Errors Summary */}
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
