import React, { useState, useMemo, useEffect } from 'react';
import styles from './DiceCommandsModal.module.scss';
import { getDefensiveSkill, SOCIAL_SKILL_PAIRS } from '@/utils/socialConflicts';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface DiceCommandsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
  characterId: string;
  characterName: string;
  availableCharacters: Array<{ id: string; name: string }>;
}

// Social skills that trigger social conflict panel
const SOCIAL_SKILLS = ['Ammaliare', 'Persuadere', 'Intimidire', 'Oratoria', 'Raggirare', 'Empatia'];

export default function DiceCommandsModal({
  isOpen,
  onClose,
  locationId,
  characterId,
  characterName,
  availableCharacters
}: DiceCommandsModalProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [characterSkills, setCharacterSkills] = useState<Record<string, number>>({});
  const [skillTemplates, setSkillTemplates] = useState<Array<{
    name: string;
    baseValue: number;
    category: string;
    canRollWithoutPoints: boolean;
    isPlaceholder: boolean;
  }>>([]);
  const [skillsWithCategory, setSkillsWithCategory] = useState<Record<string, string | undefined>>({});
  
  // Selected skill state
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  
  // Social conflict state (shown when social skill is selected)
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [messageContent, setMessageContent] = useState<string>('');
  const [lieText, setLieText] = useState(''); // Only for Raggirare
  const [intentDescription, setIntentDescription] = useState(''); // For other social skills

  // Load skills from database when modal opens
  useEffect(() => {
    if (isOpen && characterId) {
      loadSkillsFromDatabase();
    }
  }, [isOpen, characterId]);

  const loadSkillsFromDatabase = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/game/characters/${characterId}/skills`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.data) {
          // Extract skill values and categories from API response
          // API returns: { skillName: { value: number, category: string } }
          const skillsMap: Record<string, number> = {};
          const categoryMap: Record<string, string | undefined> = {};
          
          Object.entries(data.data.skills || {}).forEach(([skillName, skillData]: [string, any]) => {
            // Extract value from skillData object
            if (skillData && typeof skillData === 'object' && 'value' in skillData) {
              skillsMap[skillName] = skillData.value;
              categoryMap[skillName] = skillData.category;
            } else if (typeof skillData === 'number') {
              // Fallback: if it's already a number, use it directly
              skillsMap[skillName] = skillData;
            }
          });
          
          // Set character skills (only values)
          setCharacterSkills(skillsMap);
          
          // Set skill templates
          setSkillTemplates(data.data.skillTemplates || []);
          
          // Set skillsWithCategory map
          setSkillsWithCategory(categoryMap);
        }
      } else {
        console.error('Failed to load skills:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading skills from database:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if selected skill is a social skill
  const isSocialSkill = selectedSkill && SOCIAL_SKILLS.includes(selectedSkill);
  const isRaggirare = selectedSkill === 'Raggirare';

  // Infer category from skill name when template is not available
  const inferCategoryFromName = (skillName: string): string => {
    const nameLower = skillName.toLowerCase();
    
    // Combat/Physical skills - check these first as they're more specific
    const combatPatterns = [
      'arma', 'combattimento', 'lancio', 'schivare', 'schiva',
      'atletica', 'furtività', 'furtiv', 'furtivo',
      'nuotare', 'nuoto', 'arrampicarsi', 'arrampicata',
      'saltare', 'salto', 'lotta', 'pugilato', 'boxe',
      'percezione', 'cercare', 'cerca', 'osservare', 'osservazione',
      'sopravvivenza', 'cavalcare', 'guidare', 'guidare veicolo'
    ];
    if (combatPatterns.some(pattern => nameLower.includes(pattern))) {
      return 'combat';
    }
    
    // Social skills
    const socialPatterns = [
      'persuadere', 'persuasione', 'intimidire', 'intimidazione',
      'oratoria', 'raggirare', 'raggiro', 'empatia',
      'ammaliare', 'charme', 'negoziazione', 'negoziare',
      'fast talk', 'psicologia', 'psicologia applicata'
    ];
    if (socialPatterns.some(pattern => nameLower.includes(pattern))) {
      return 'social';
    }
    
    // Knowledge/Academic skills
    const knowledgePatterns = [
      'biblioteca', 'biblioteconomia', 'contabilità', 'contabilita',
      'finanza', 'storia', 'scienza', 'medicina', 'medico',
      'anatomia', 'botanica', 'zoologia', 'geologia',
      'archeologia', 'antropologia', 'lingua', 'lingue',
      'lingua straniera', 'matematica', 'fisica', 'chimica',
      'biologia', 'astronomia', 'astrologia', 'mitologia',
      'diritto', 'legge', 'giurisprudenza', 'filosofia',
      'letteratura', 'poesia', 'religione', 'teologia'
    ];
    if (knowledgePatterns.some(pattern => nameLower.includes(pattern))) {
      return 'knowledge';
    }
    
    // Artistic/Technical skills
    const artisticPatterns = [
      'arte', 'disegno', 'pittura', 'scultura',
      'musica', 'canto', 'danza', 'recitazione',
      'fotografia', 'meccanica', 'elettronica', 'informatica',
      'elettricità', 'elettrico', 'idraulica', 'falegnameria',
      'sartoria', 'cucina', 'giardinaggio', 'allevamento'
    ];
    if (artisticPatterns.some(pattern => nameLower.includes(pattern))) {
      return 'artistic';
    }
    
    // Default to general (mental)
    return 'general';
  };

  // Group skills by category
  const groupSkillsByCategory = () => {
    const groups = {
      mentali: [] as Array<{ name: string; value: number; category: string }>,
      arti: [] as Array<{ name: string; value: number; category: string }>,
      accademiche: [] as Array<{ name: string; value: number; category: string }>,
      sociali: [] as Array<{ name: string; value: number; category: string }>,
      fisiche: [] as Array<{ name: string; value: number; category: string }>
    };

    // Get category for each skill from skillsWithCategory, templates, or infer from name
    Object.entries(characterSkills).forEach(([skillName, skillValue]) => {
      // Skip if doesn't match search
      if (skillSearch && !skillName.toLowerCase().includes(skillSearch.toLowerCase())) {
        return;
      }

      // Priority: 1) skillsWithCategory, 2) template category, 3) infer from name
      let category: string;
      if (skillsWithCategory[skillName]) {
        category = skillsWithCategory[skillName] || 'general';
      } else {
        const template = skillTemplates.find(t => t.name === skillName);
        category = template?.category || inferCategoryFromName(skillName);
      }

      const skillEntry = { name: skillName, value: skillValue, category };

      if (category === 'general') {
        groups.mentali.push(skillEntry);
      } else if (category === 'artistic' || category === 'technical') {
        groups.arti.push(skillEntry);
      } else if (category === 'knowledge') {
        groups.accademiche.push(skillEntry);
      } else if (category === 'social') {
        groups.sociali.push(skillEntry);
      } else if (category === 'physical' || category === 'combat') {
        groups.fisiche.push(skillEntry);
      } else {
        // Default to mentali if category unknown
        groups.mentali.push(skillEntry);
      }
    });

    // Sort each group alphabetically
    Object.keys(groups).forEach(key => {
      groups[key as keyof typeof groups].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  };

  const skillGroups = useMemo(() => groupSkillsByCategory(), [characterSkills, skillSearch, skillTemplates]);

  // Reset social conflict state when skill changes
  const handleSkillSelect = (skillName: string) => {
    setSelectedSkill(skillName);
    // Reset social conflict fields
    setSelectedTarget('');
    setMessageContent('');
    setLieText('');
    setIntentDescription('');
  };

  // Handle social conflict submission
  const handleSocialConflict = async () => {
    if (!selectedSkill || !selectedTarget || !messageContent.trim()) return;
    if (isRaggirare && !lieText.trim()) return;

    const attackerSkill = selectedSkill;
    const attackerValue = characterSkills[attackerSkill] || 0;

    try {
      const response = await fetch(`${API_BASE}/game/locations/actions/social-conflict`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationId,
          attackerSkill,
          attackerValue,
          defenderCharacterId: selectedTarget,
          content: messageContent.trim(),
          isHidden: isRaggirare, // Only Raggirare is hidden
          lieText: isRaggirare ? lieText.trim() : undefined,
          intentDescription: !isRaggirare ? intentDescription.trim() : undefined
        })
      });

      if (response.ok) {
        // Reset all state
        setSelectedSkill('');
        setSelectedTarget('');
        setMessageContent('');
        setLieText('');
        setIntentDescription('');
        setSkillSearch('');
        onClose();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Errore durante l\'invio dello scontro sociale');
      }
    } catch (error) {
      console.error('Error creating social conflict:', error);
      alert('Errore di connessione');
    }
  };

  // Handle normal skill check
  const handleSkillCheck = async () => {
    if (!selectedSkill) return;
    
    const skillValue = characterSkills[selectedSkill] || 0;
    
    try {
      const response = await fetch(`${API_BASE}/game/locations/actions`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          actionType: 'skill_check',
          content: `Tira ${selectedSkill}`,
          locationId,
          skillName: selectedSkill,
          targetValue: skillValue
        })
      });

      if (response.ok) {
        setSelectedSkill('');
        setSkillSearch('');
        onClose();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Errore durante il tiro di abilità');
      }
    } catch (error) {
      console.error('Error creating skill check:', error);
      alert('Errore di connessione');
    }
  };

  // Render skill group
  const renderSkillGroup = (
    title: string,
    skills: Array<{ name: string; value: number; category: string }>,
    description?: string
  ) => {
    if (skills.length === 0) return null;

    return (
      <div className={styles.skillGroupSection}>
        <h4 className={styles.groupTitle}>{title}</h4>
        {description && <p className={styles.groupDescription}>{description}</p>}
        <div className={styles.skillsGrid}>
          {skills.map((skill) => {
            const isSelected = selectedSkill === skill.name;
            const isSocial = SOCIAL_SKILLS.includes(skill.name);
            
            return (
              <button
                key={skill.name}
                type="button"
                onClick={() => handleSkillSelect(skill.name)}
                className={`${styles.skillButton} ${isSelected ? styles.selected : ''} ${isSocial ? styles.socialSkill : ''}`}
                title={isSocial ? 'Skill sociale - richiede configurazione scontro' : ''}
              >
                <span className={styles.skillName}>{skill.name}</span>
                <span className={styles.skillValue}>{skill.value}%</span>
                {isSocial && <span className={styles.socialBadge}>⚔️</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Check if social conflict form is valid
  const isSocialConflictValid = () => {
    if (!selectedSkill || !selectedTarget || !messageContent.trim()) return false;
    if (isRaggirare && !lieText.trim()) return false;
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        className={`${styles.modal} ${isMinimized ? styles.minimized : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.title}>🎲 Comandi Dadi</h3>
          <div className={styles.headerActions}>
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className={styles.minimizeButton}
              aria-label={isMinimized ? 'Espandi' : 'Riduci'}
            >
              {isMinimized ? '□' : '−'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className={styles.modalContent}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>Caricamento skill...</p>
              </div>
            ) : (
              <>
                {/* Search bar */}
                <div className={styles.formGroup}>
                  <label>Cerca skill:</label>
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    className={styles.searchInput}
                    placeholder="Cerca per nome..."
                  />
                </div>

            {/* Skills grouped by category */}
            <div className={`${styles.skillsContainer} ${isSocialSkill ? styles.withSocialPanel : ''}`}>
              <div className={styles.skillsList}>
                {renderSkillGroup(
                  'Abilità Mentali',
                  skillGroups.mentali,
                  'Abilità che richiedono concentrazione, intuito e capacità cognitive.'
                )}
                {renderSkillGroup(
                  'Arti e Mestieri',
                  skillGroups.arti,
                  'Abilità creative, tecniche e artigianali.'
                )}
                {renderSkillGroup(
                  'Abilità Accademiche',
                  skillGroups.accademiche,
                  'Conoscenze specialistiche e scientifiche.'
                )}
                {renderSkillGroup(
                  'Abilità Sociali',
                  skillGroups.sociali,
                  'Abilità di interazione, persuasione e comprensione del comportamento umano.'
                )}
                {renderSkillGroup(
                  'Abilità Fisiche',
                  skillGroups.fisiche,
                  'Abilità di combattimento, movimento e coordinazione fisica.'
                )}
              </div>

              {/* Social conflict panel (shown when social skill is selected) */}
              {isSocialSkill && (
                <div className={styles.socialConflictPanel}>
                  <h4 className={styles.panelTitle}>
                    Scontro Sociale: {selectedSkill}
                    {getDefensiveSkill(selectedSkill) && (
                      <span className={styles.defensiveSkill}>
                        vs {getDefensiveSkill(selectedSkill)}
                      </span>
                    )}
                  </h4>

                  <div className={styles.formGroup}>
                    <label>Bersaglio:</label>
                    <select
                      value={selectedTarget}
                      onChange={(e) => setSelectedTarget(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">Seleziona bersaglio</option>
                      {availableCharacters
                        .filter(char => char.id !== characterId)
                        .map(char => (
                          <option key={char.id} value={char.id}>
                            {char.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label>Messaggio (obbligatorio):</label>
                    <textarea
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      className={styles.textarea}
                      placeholder="Scrivi il messaggio da mostrare in chat..."
                      rows={3}
                    />
                  </div>

                  {isRaggirare ? (
                    <div className={styles.formGroup}>
                      <label>Testo della menzogna (obbligatorio):</label>
                      <textarea
                        value={lieText}
                        onChange={(e) => setLieText(e.target.value)}
                        className={styles.textarea}
                        placeholder="Descrivi la menzogna che stai dicendo..."
                        rows={3}
                      />
                      <small className={styles.hint}>
                        ⚠️ Questo è un tiro nascosto. Vedrai solo "Hai effettuato un tiro di Raggirare" senza sapere se ha avuto successo.
                      </small>
                    </div>
                  ) : (
                    <div className={styles.formGroup}>
                      <label>Descrizione intento (opzionale):</label>
                      <textarea
                        value={intentDescription}
                        onChange={(e) => setIntentDescription(e.target.value)}
                        className={styles.textarea}
                        placeholder="Descrivi cosa stai cercando di ottenere..."
                        rows={2}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSocialConflict}
                    disabled={!isSocialConflictValid()}
                    className={styles.submitButton}
                  >
                    Invia Scontro Sociale
                  </button>
                </div>
              )}

              {/* Normal skill roll panel (shown when non-social skill is selected) */}
              {selectedSkill && !isSocialSkill && (
                <div className={styles.normalSkillPanel}>
                  <div className={styles.selectedSkillInfo}>
                    <p>
                      Skill selezionata: <strong>{selectedSkill}</strong> ({characterSkills[selectedSkill]}%)
                    </p>
                    <button
                      type="button"
                      onClick={handleSkillCheck}
                      className={styles.submitButton}
                    >
                      Tira {selectedSkill}
                    </button>
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
