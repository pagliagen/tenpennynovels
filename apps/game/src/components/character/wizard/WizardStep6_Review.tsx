import React from 'react';
import {
  CharacterWizardData,
  getSkillTotal
} from '@/pages/character/wizard';
import { useGame } from '@/contexts/GameContext';
import styles from './WizardSteps.module.scss';

interface WizardStep6Props {
  characterData: CharacterWizardData;
  updateCharacterData: (updates: Partial<CharacterWizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
  goToStep: (step: number) => void;
  onSubmit: () => void;
  onManualSave: () => void;
  isLastStep: boolean;
}

export const WizardStep6_Review: React.FC<WizardStep6Props> = ({
  characterData,
  onPrev,
  goToStep,
  onSubmit,
  onManualSave
}) => {
  const { gameData } = useGame();
  
  // Social class ranges (consistent with WizardStep3_Skills.tsx)
  const socialClassRanges = [
    { min: 1, max: 9, name: 'destitute', label: 'Indigente' },
    { min: 10, max: 19, name: 'poor', label: 'Povero' },
    { min: 20, max: 39, name: 'modest', label: 'Modesto' },
    { min: 40, max: 49, name: 'lower_middle', label: 'Piccola borghesia' },
    { min: 50, max: 69, name: 'middle_class', label: 'Media borghesia' },
    { min: 70, max: 79, name: 'wealthy', label: 'Ricco' },
    { min: 80, max: 89, name: 'affluent', label: 'Facoltoso' },
    { min: 90, max: 99, name: 'elite', label: 'Élite' }
  ];

  // Calculate social class from FINANZA skill
  const calculateSocialClass = (finanzaValue: number) => {
    return socialClassRanges.find(range => finanzaValue >= range.min && finanzaValue <= range.max) || socialClassRanges[0];
  };
  
  // Helper to get occupation object
  const getSelectedOccupation = () => {
    return characterData.occupation;
  };

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'male': return 'Maschio';
      case 'female': return 'Femmina';
      default: return 'Non specificato';
    }
  };

  const isReadyForSubmission = () => {
    // Check if FINANZA skill has a value (it's in normal skills, not dynamic skills)
    const finanzaValue = getSkillTotal(characterData.skills['Finanza']) || 0;
    const hasFinanzaSkill = finanzaValue > 0;

    // NEW SYSTEM: Check structured background required fields
    const background = characterData.background || {};
    const hasBriefHistory = background.briefHistory && background.briefHistory.trim().length >= 100;
    const hasPersonality = background.personality && background.personality.trim().length >= 50;
    const hasGoalsAndMotivations = background.goalsAndMotivations && background.goalsAndMotivations.trim().length >= 50;

    return (
      characterData.firstName.trim() !== '' &&
      characterData.lastName.trim() !== '' &&
      characterData.age !== null &&
      characterData.apparentAge !== null &&
      characterData.gender !== null &&
      hasFinanzaSkill &&
      characterData.occupation !== null &&
      characterData.publicDescription.trim() !== '' &&
      characterData.publicDescription.length >= 50 &&
      characterData.privateDescription.trim() !== '' &&
      characterData.privateDescription.length >= 50 &&
      hasBriefHistory &&
      hasPersonality &&
      hasGoalsAndMotivations
    );
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Revisione Finale</h2>
        <p className={styles.stepDescription}>
          Controlla tutti i dettagli del tuo personaggio prima di inviarlo per l'approvazione.
          Puoi cliccare su qualsiasi sezione per tornare indietro e modificare i dati.
        </p>
      </div>

      <div className={styles.reviewContainer}>
        {/* Basic Information */}
        <div className={styles.reviewSection} onClick={() => goToStep(1)}>
          <h3 className={styles.reviewSectionTitle}>Informazioni Base</h3>
          <div className={styles.reviewGrid}>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Nome Completo</div>
              <div className={styles.reviewValue}>{characterData.firstName} {characterData.lastName}</div>
            </div>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Età</div>
              <div className={styles.reviewValue}>{characterData.age} anni</div>
            </div>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Genere</div>
              <div className={styles.reviewValue}>{getGenderLabel(characterData.gender)}</div>
            </div>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Luogo di Nascita</div>
              <div className={styles.reviewValue}>{characterData.birthPlace}</div>
            </div>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Classe Sociale</div>
              <div className={styles.reviewValue}>{calculateSocialClass(getSkillTotal(characterData.skills['Finanza']) || 0).label}</div>
            </div>

            {/* Optional Anagrafica Completa */}
            {(characterData.height || characterData.weight || characterData.eyeColor || characterData.hairColor ||
              characterData.visibleMarks || characterData.hiddenMarks || characterData.maritalStatus ||
              characterData.illnesses || characterData.educationTitle || characterData.criminalRecord ||
              characterData.currentOccupation) && (
              <>
                <div className={styles.reviewItem} style={{ gridColumn: '1 / -1', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #eee' }}>
                  <div className={styles.reviewLabel} style={{ fontSize: '14px', fontWeight: 'bold' }}>Anagrafica Dettagliata:</div>
                </div>
                {characterData.height && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Altezza</div>
                    <div className={styles.reviewValue}>{characterData.height}</div>
                  </div>
                )}
                {characterData.weight && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Peso</div>
                    <div className={styles.reviewValue}>{characterData.weight}</div>
                  </div>
                )}
                {characterData.eyeColor && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Colore Occhi</div>
                    <div className={styles.reviewValue}>{characterData.eyeColor}</div>
                  </div>
                )}
                {characterData.hairColor && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Colore Capelli</div>
                    <div className={styles.reviewValue}>{characterData.hairColor}</div>
                  </div>
                )}
                {characterData.maritalStatus && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Stato Civile</div>
                    <div className={styles.reviewValue}>
                      {characterData.maritalStatus === 'single' ? 'Celibe/Nubile' :
                       characterData.maritalStatus === 'married' ? 'Coniugato/a' :
                       characterData.maritalStatus === 'widowed' ? 'Vedovo/a' :
                       characterData.maritalStatus === 'separated' ? 'Separato/a' :
                       characterData.maritalStatus === 'divorced' ? 'Divorziato/a' :
                       characterData.maritalStatus}
                    </div>
                  </div>
                )}
                {characterData.visibleMarks && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Segni Distintivi Visibili</div>
                    <div className={styles.reviewValue}>{characterData.visibleMarks}</div>
                  </div>
                )}
                {characterData.hiddenMarks && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Segni Distintivi Nascosti</div>
                    <div className={styles.reviewValue}>{characterData.hiddenMarks}</div>
                  </div>
                )}
                {characterData.illnesses && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Malattie o Condizioni</div>
                    <div className={styles.reviewValue}>{characterData.illnesses}</div>
                  </div>
                )}
                {characterData.educationTitle && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Titolo di Studio</div>
                    <div className={styles.reviewValue}>{characterData.educationTitle}</div>
                  </div>
                )}
                {characterData.criminalRecord && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Casellario Giudiziario</div>
                    <div className={styles.reviewValue}>{characterData.criminalRecord}</div>
                  </div>
                )}
                {characterData.currentOccupation && (
                  <div className={styles.reviewItem}>
                    <div className={styles.reviewLabel}>Occupazione Attuale</div>
                    <div className={styles.reviewValue}>{characterData.currentOccupation}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className={styles.reviewSection} onClick={() => goToStep(3)}>
          <h3 className={styles.reviewSectionTitle}>Caratteristiche</h3>
          <div className={styles.reviewGrid}>
            {Object.entries(characterData.stats).map(([stat, value]) => (
              <div key={stat} className={styles.reviewItem}>
                <div className={styles.reviewLabel}>{stat.toUpperCase()}</div>
                <div className={styles.reviewValue}>{value}</div>
              </div>
            ))}
          </div>
          <div className={styles.reviewGrid} style={{ marginTop: '15px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Punti Vita</div>
              <div className={styles.reviewValue}>{characterData.derived.hitPoints}</div>
            </div>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Sanità Mentale</div>
              <div className={styles.reviewValue}>{characterData.derived.sanityPoints}</div>
            </div>
            <div className={styles.reviewItem}>
              <div className={styles.reviewLabel}>Fortuna</div>
              <div className={styles.reviewValue}>{characterData.derived.luckRoll}</div>
            </div>
          </div>
        </div>

        {/* Occupation */}
        <div className={styles.reviewSection} onClick={() => goToStep(2)}>
          <h3 className={styles.reviewSectionTitle}>Esperienze Pregresse</h3>
          {(() => {
            const selectedOccupation = getSelectedOccupation();
            return selectedOccupation ? (
              <>
                <div className={styles.reviewValue} style={{ fontSize: '18px', marginBottom: '10px' }}>
                  {selectedOccupation.name}
                </div>
                {/* NEW SYSTEM: Show Required Skills (6) */}
                {selectedOccupation.requiredSkills && selectedOccupation.requiredSkills.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div className={styles.reviewLabel}>Abilità Richieste ({selectedOccupation.requiredSkills.length}):</div>
                    <ul className={styles.reviewList}>
                      {selectedOccupation.requiredSkills.map((req, idx) => (
                        <li key={idx}>
                          {req.skillName}
                          {req.alternatives && req.alternatives.length > 0 && (
                            <span style={{ fontSize: '12px', color: '#666' }}>
                              {' '}(alternative: {req.alternatives.map(alt => alt.skillName).join(', ')})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* NEW SYSTEM: Show Bonus Skills (1-2) */}
                {selectedOccupation.bonusSkills && selectedOccupation.bonusSkills.length > 0 && (
                  <div>
                    <div className={styles.reviewLabel}>Bonus Automatici ({selectedOccupation.bonusSkills.length}):</div>
                    <ul className={styles.reviewList}>
                      {selectedOccupation.bonusSkills.map((bonus, idx) => (
                        <li key={idx}>{bonus.skillName}: +{bonus.bonusValue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.reviewValue} style={{ fontSize: '18px', marginBottom: '10px' }}>
                Nessuna occupazione selezionata
              </div>
            );
          })()}
        </div>

        {/* Skills */}
        <div className={styles.reviewSection} onClick={() => goToStep(4)}>
          <h3 className={styles.reviewSectionTitle}>Abilità Principali</h3>
          <div className={styles.reviewGrid}>
            {Object.entries(characterData.skills)
              .filter(([, value]) => getSkillTotal(value) > 30)
              .slice(0, 8) // Show only top 8 skills
              .map(([skill, value]) => (
                <div key={skill} className={styles.reviewItem}>
                  <div className={styles.reviewLabel}>{skill}</div>
                  <div className={styles.reviewValue}>{getSkillTotal(value)}%</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Background */}
        <div className={styles.reviewSection} onClick={() => goToStep(5)}>
          <h3 className={styles.reviewSectionTitle}>Background e Storia</h3>

          {/* Base Descriptions */}
          <div style={{ marginBottom: '15px' }}>
            <div className={styles.reviewLabel}>Descrizione Pubblica:</div>
            <div className={styles.reviewText}>{characterData.publicDescription}</div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div className={styles.reviewLabel}>Descrizione Privata:</div>
            <div className={styles.reviewText}>{characterData.privateDescription}</div>
          </div>
          {characterData.physicalDescription && (
            <div style={{ marginBottom: '15px' }}>
              <div className={styles.reviewLabel}>Descrizione Fisica:</div>
              <div className={styles.reviewText}>{characterData.physicalDescription}</div>
            </div>
          )}

          {/* NEW SYSTEM: Structured Background */}
          {characterData.background && (
            <>
              {characterData.background.briefHistory && (
                <div style={{ marginBottom: '15px' }}>
                  <div className={styles.reviewLabel}>Storia del Personaggio:</div>
                  <div className={styles.reviewText}>{characterData.background.briefHistory}</div>
                </div>
              )}
              {characterData.background.personality && (
                <div style={{ marginBottom: '15px' }}>
                  <div className={styles.reviewLabel}>Personalità:</div>
                  <div className={styles.reviewText}>{characterData.background.personality}</div>
                </div>
              )}
              {characterData.background.goalsAndMotivations && (
                <div style={{ marginBottom: '15px' }}>
                  <div className={styles.reviewLabel}>Obiettivi e Motivazioni:</div>
                  <div className={styles.reviewText}>{characterData.background.goalsAndMotivations}</div>
                </div>
              )}
              {characterData.background.fearsAndPhobias && (
                <div style={{ marginBottom: '15px' }}>
                  <div className={styles.reviewLabel}>Paure e Fobie:</div>
                  <div className={styles.reviewText}>{characterData.background.fearsAndPhobias}</div>
                </div>
              )}
              {characterData.background.secrets && (
                <div style={{ marginBottom: '15px' }}>
                  <div className={styles.reviewLabel}>Segreti:</div>
                  <div className={styles.reviewText}>{characterData.background.secrets}</div>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Final Submission */}
      <div className={styles.finalSubmission}>
        <h3 className={styles.submissionTitle}>Pronto per l'Invio</h3>
        <p className={styles.submissionText}>
          Una volta inviato, il tuo personaggio sarà esaminato dallo staff per l'approvazione.
          Riceverai una notifica quando il processo sarà completato.
        </p>
        
        {!isReadyForSubmission() && (
          <div className={styles.warningPanel}>
            <div className={styles.warningTitle}>Dati Mancanti</div>
            <p className={styles.warningText}>
              Completa tutti i campi obbligatori prima di procedere con l'invio:
            </p>
            <ul className={styles.missingFieldsList}>
              {/* Step 1: Basic Info */}
              {!characterData.firstName.trim() && <li>Nome</li>}
              {!characterData.lastName.trim() && <li>Cognome</li>}
              {characterData.age === null && <li>Età</li>}
              {characterData.apparentAge === null && <li>Età apparente</li>}
              {characterData.gender === null && <li>Genere</li>}

              {/* Step 4: Skills */}
              {!(getSkillTotal(characterData.skills['Finanza']) > 0) && <li>Skill FINANZA (deve essere maggiore di 0)</li>}

              {/* Step 2: Occupation */}
              {!characterData.occupation && <li>Esperienze Pregresse</li>}

              {/* Step 5: Background */}
              {(!characterData.publicDescription || characterData.publicDescription.length < 50) && <li>Descrizione Pubblica (minimo 50 caratteri)</li>}
              {(!characterData.privateDescription || characterData.privateDescription.length < 50) && <li>Descrizione Privata (minimo 50 caratteri)</li>}
              {(() => {
                const background = characterData.background || {};
                return (
                  <>
                    {(!background.briefHistory || background.briefHistory.length < 100) && <li>Storia del Personaggio (minimo 100 caratteri)</li>}
                    {(!background.personality || background.personality.length < 50) && <li>Personalità (minimo 50 caratteri)</li>}
                    {(!background.goalsAndMotivations || background.goalsAndMotivations.length < 50) && <li>Obiettivi e Motivazioni (minimo 50 caratteri)</li>}
                  </>
                );
              })()}
            </ul>
          </div>
        )}
        
        <div className={styles.stepNavigation}>
          <button onClick={onPrev} className={styles.prevButton}>
            ← Torna al Background
          </button>
          
          <button 
            onClick={onManualSave} 
            className={`${styles.saveButton} manual-save-button`}
            style={{ fontSize: '14px', padding: '8px 16px' }}
          >
            💾 SALVA
          </button>
          
          <button
            onClick={onSubmit}
            disabled={!isReadyForSubmission()}
            className={styles.submitButton}
            style={{ fontSize: '18px', padding: '15px 30px' }}
          >
            Invia per Approvazione
          </button>
        </div>
      </div>
    </div>
  );
};