import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useGame } from '../contexts/GameContext';
import { GameLayout } from '../components/GameLayout';
import styles from '../styles/pages/Skills.module.scss';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  baseChance: number;
  isOccupational: boolean;
  canBeSpecialized: boolean;
  specializations?: string[];
  relatedSkills?: string[];
  difficulty: string;
  timeRequired?: string;
  equipmentRequired?: string[];
  examples?: string[];
  historicalNotes?: string;
  improvementNotes?: string;
  opposingSkills?: string[];
  complementarySkills?: string[];
}

interface SkillCheck {
  skillName: string;
  currentValue: number;
  targetNumber: number;
  difficulty: string;
  modifiers: Array<{
    name: string;
    value: number;
    reason: string;
  }>;
  successChance: number;
  criticalSuccess: number;
  criticalFailure: number;
  fumble: number;
}

const SkillsPage: NextPage = () => {
  const { gameData, character } = useGame();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [activeTab, setActiveTab] = useState<'browse' | 'calculator' | 'categories'>('browse');
  const [filters, setFilters] = useState({
    category: '',
    difficulty: '',
    occupational: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'baseChance' | 'difficulty'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Calculator state
  const [calculatorData, setCalculatorData] = useState({
    skillName: '',
    currentValue: 50,
    targetNumber: 50,
    difficulty: 'Regular',
    modifiers: [] as Array<{name: string; value: number; reason: string}>
  });
  const [skillCheckResult, setSkillCheckResult] = useState<SkillCheck | null>(null);

  useEffect(() => {
    if (character && gameData) {
      loadSkills();
    }
  }, [character, gameData]);

  useEffect(() => {
    if (character && gameData) {
      loadSkills();
    }
  }, [filters, searchQuery, sortBy, sortOrder]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder
      });
      
      if (filters.category) params.append('category', filters.category);
      if (filters.difficulty) params.append('difficulty', filters.difficulty);
      if (filters.occupational) params.append('occupational', filters.occupational);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/game/skills?${params.toString()}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.result) {
        setSkills(data.data.skills);
      }
    } catch (error) {
      console.error('Error loading skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSkillCheck = async () => {
    try {
      const response = await fetch('/api/game/skills/calculate-probability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(calculatorData)
      });

      const data = await response.json();
      if (data.result) {
        setSkillCheckResult(data.data.calculation);
      }
    } catch (error) {
      console.error('Error calculating skill check:', error);
    }
  };

  const addModifier = () => {
    setCalculatorData({
      ...calculatorData,
      modifiers: [...calculatorData.modifiers, { name: '', value: 0, reason: '' }]
    });
  };

  const updateModifier = (index: number, field: string, value: any) => {
    const updatedModifiers = [...calculatorData.modifiers];
    updatedModifiers[index] = { ...updatedModifiers[index], [field]: value };
    setCalculatorData({ ...calculatorData, modifiers: updatedModifiers });
  };

  const removeModifier = (index: number) => {
    setCalculatorData({
      ...calculatorData,
      modifiers: calculatorData.modifiers.filter((_, i) => i !== index)
    });
  };

  const openSkillDetails = (skill: Skill) => {
    setSelectedSkill(skill);
  };

  const closeSkillDetails = () => {
    setSelectedSkill(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'very easy': return '#10b981';
      case 'easy': return '#84cc16';
      case 'regular': return '#f59e0b';
      case 'hard': return '#ef4444';
      case 'extreme': return '#dc2626';
      case 'critical': return '#7c2d12';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'combat': return '⚔️';
      case 'social': return '🗣️';
      case 'investigation': return '🔍';
      case 'academic': return '📚';
      case 'artistic': return '🎨';
      case 'crafts': return '🔨';
      case 'physical': return '💪';
      case 'survival': return '🏕️';
      case 'occult': return '🔮';
      case 'professional': return '💼';
      default: return '📋';
    }
  };

  if (!gameData || loading) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.loading}>Loading skills database...</div>
      </GameLayout>
    );
  }

  if (!character || !gameData) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.error}>Please select a character to browse skills</div>
      </GameLayout>
    );
  }

  const categories = [...new Set(skills.map(s => s.category))].sort();

  return (
    <GameLayout gameData={gameData}>
      <div className={styles.skillsPage}>
        <div className={styles.header}>
          <h1>Skills & Abilities</h1>
          <p className={styles.subtitle}>
            Master the arts and sciences of Victorian England
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'browse' ? styles.active : ''}`}
            onClick={() => setActiveTab('browse')}
          >
            Browse Skills ({skills.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'calculator' ? styles.active : ''}`}
            onClick={() => setActiveTab('calculator')}
          >
            Probability Calculator
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'categories' ? styles.active : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories ({categories.length})
          </button>
        </div>

        {/* Browse Skills Tab */}
        {activeTab === 'browse' && (
          <>
            {/* Filters */}
            <div className={styles.filters}>
              <div className={styles.filterGroup}>
                <label>Category:</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className={styles.select}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label>Difficulty:</label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => setFilters({...filters, difficulty: e.target.value})}
                  className={styles.select}
                >
                  <option value="">All Difficulties</option>
                  <option value="Very Easy">Very Easy</option>
                  <option value="Easy">Easy</option>
                  <option value="Regular">Regular</option>
                  <option value="Hard">Hard</option>
                  <option value="Extreme">Extreme</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label>Type:</label>
                <select
                  value={filters.occupational}
                  onChange={(e) => setFilters({...filters, occupational: e.target.value})}
                  className={styles.select}
                >
                  <option value="">All Skills</option>
                  <option value="true">Occupational Only</option>
                  <option value="false">Personal Only</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label>Sort by:</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className={styles.select}
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="category-asc">Category (A-Z)</option>
                  <option value="category-desc">Category (Z-A)</option>
                  <option value="baseChance-asc">Base Chance (Low to High)</option>
                  <option value="baseChance-desc">Base Chance (High to Low)</option>
                  <option value="difficulty-asc">Difficulty (Easy to Hard)</option>
                  <option value="difficulty-desc">Difficulty (Hard to Easy)</option>
                </select>
              </div>
            </div>

            {/* Search Bar */}
            <div className={styles.searchBar}>
              <input
                type="text"
                placeholder="Search skills by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            {/* Skills Grid */}
            <div className={styles.skillsGrid}>
              {skills.length === 0 ? (
                <div className={styles.emptyState}>
                  <h3>No skills found</h3>
                  <p>Try adjusting your filters or search query.</p>
                </div>
              ) : (
                skills.map((skill) => (
                  <div
                    key={skill.id}
                    className={styles.skillCard}
                    onClick={() => openSkillDetails(skill)}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.skillTitle}>
                        <span className={styles.categoryIcon}>
                          {getCategoryIcon(skill.category)}
                        </span>
                        <h3>{skill.name}</h3>
                      </div>
                      <span
                        className={styles.difficulty}
                        style={{ color: getDifficultyColor(skill.difficulty) }}
                      >
                        {skill.difficulty}
                      </span>
                    </div>

                    <div className={styles.skillMeta}>
                      <span className={styles.category}>{skill.category}</span>
                      <span className={styles.baseChance}>{skill.baseChance}% base</span>
                    </div>

                    <p className={styles.description}>
                      {skill.description.substring(0, 120)}
                      {skill.description.length > 120 && '...'}
                    </p>

                    <div className={styles.skillProperties}>
                      {skill.isOccupational && (
                        <span className={styles.property}>Occupational</span>
                      )}
                      {skill.canBeSpecialized && (
                        <span className={styles.property}>Specializable</span>
                      )}
                      {skill.timeRequired && (
                        <span className={styles.property}>Time: {skill.timeRequired}</span>
                      )}
                    </div>

                    {skill.specializations && skill.specializations.length > 0 && (
                      <div className={styles.specializations}>
                        <strong>Specializations:</strong> {skill.specializations.slice(0, 3).join(', ')}
                        {skill.specializations.length > 3 && ` +${skill.specializations.length - 3} more`}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Probability Calculator Tab */}
        {activeTab === 'calculator' && (
          <div className={styles.calculatorSection}>
            <div className={styles.calculatorForm}>
              <h3>Skill Check Probability Calculator</h3>
              
              <div className={styles.formGroup}>
                <label>Skill Name:</label>
                <input
                  type="text"
                  value={calculatorData.skillName}
                  onChange={(e) => setCalculatorData({...calculatorData, skillName: e.target.value})}
                  className={styles.input}
                  placeholder="Enter skill name..."
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Current Skill Value:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={calculatorData.currentValue}
                    onChange={(e) => setCalculatorData({...calculatorData, currentValue: parseInt(e.target.value) || 0})}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Target Number:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={calculatorData.targetNumber}
                    onChange={(e) => setCalculatorData({...calculatorData, targetNumber: parseInt(e.target.value) || 0})}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Difficulty Level:</label>
                  <select
                    value={calculatorData.difficulty}
                    onChange={(e) => setCalculatorData({...calculatorData, difficulty: e.target.value})}
                    className={styles.select}
                  >
                    <option value="Very Easy">Very Easy (+40)</option>
                    <option value="Easy">Easy (+20)</option>
                    <option value="Regular">Regular (+0)</option>
                    <option value="Hard">Hard (-20)</option>
                    <option value="Extreme">Extreme (-40)</option>
                    <option value="Critical">Critical (-50)</option>
                  </select>
                </div>
              </div>

              <div className={styles.modifiersSection}>
                <div className={styles.modifiersHeader}>
                  <h4>Modifiers</h4>
                  <button onClick={addModifier} className={styles.addBtn}>
                    Add Modifier
                  </button>
                </div>

                {calculatorData.modifiers.map((modifier, index) => (
                  <div key={index} className={styles.modifierRow}>
                    <input
                      type="text"
                      placeholder="Modifier name"
                      value={modifier.name}
                      onChange={(e) => updateModifier(index, 'name', e.target.value)}
                      className={styles.input}
                    />
                    <input
                      type="number"
                      placeholder="Value"
                      value={modifier.value}
                      onChange={(e) => updateModifier(index, 'value', parseInt(e.target.value) || 0)}
                      className={styles.input}
                    />
                    <input
                      type="text"
                      placeholder="Reason"
                      value={modifier.reason}
                      onChange={(e) => updateModifier(index, 'reason', e.target.value)}
                      className={styles.input}
                    />
                    <button
                      onClick={() => removeModifier(index)}
                      className={styles.removeBtn}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={calculateSkillCheck}
                className={styles.calculateBtn}
                disabled={!calculatorData.skillName}
              >
                Calculate Probabilities
              </button>

              {skillCheckResult && (
                <div className={styles.calculationResults}>
                  <h4>Results for {skillCheckResult.skillName}</h4>
                  
                  <div className={styles.resultsGrid}>
                    <div className={styles.resultCard}>
                      <span className={styles.resultLabel}>Success Chance</span>
                      <span className={styles.resultValue}>{skillCheckResult.successChance}%</span>
                    </div>
                    <div className={styles.resultCard}>
                      <span className={styles.resultLabel}>Critical Success</span>
                      <span className={styles.resultValue}>{skillCheckResult.criticalSuccess}%</span>
                    </div>
                    <div className={styles.resultCard}>
                      <span className={styles.resultLabel}>Critical Failure</span>
                      <span className={styles.resultValue}>{skillCheckResult.criticalFailure}%</span>
                    </div>
                    <div className={styles.resultCard}>
                      <span className={styles.resultLabel}>Fumble</span>
                      <span className={styles.resultValue}>{skillCheckResult.fumble}%</span>
                    </div>
                  </div>

                  {skillCheckResult.modifiers.length > 0 && (
                    <div className={styles.appliedModifiers}>
                      <h5>Applied Modifiers:</h5>
                      {skillCheckResult.modifiers.map((mod, index) => (
                        <div key={index} className={styles.appliedModifier}>
                          {mod.name}: {mod.value > 0 ? '+' : ''}{mod.value} ({mod.reason})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className={styles.categoriesSection}>
            <h3>Skill Categories</h3>
            <div className={styles.categoriesGrid}>
              {categories.map((category) => {
                const categorySkills = skills.filter(s => s.category === category);
                const avgBaseChance = Math.round(
                  categorySkills.reduce((sum, skill) => sum + skill.baseChance, 0) / categorySkills.length
                );
                const occupationalCount = categorySkills.filter(s => s.isOccupational).length;
                
                return (
                  <div
                    key={category}
                    className={styles.categoryCard}
                    onClick={() => setFilters({...filters, category})}
                  >
                    <div className={styles.categoryHeader}>
                      <span className={styles.categoryIcon}>
                        {getCategoryIcon(category)}
                      </span>
                      <h4>{category}</h4>
                    </div>

                    <div className={styles.categoryStats}>
                      <div className={styles.stat}>
                        <span className={styles.label}>Skills</span>
                        <span className={styles.value}>{categorySkills.length}</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.label}>Avg Base</span>
                        <span className={styles.value}>{avgBaseChance}%</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.label}>Occupational</span>
                        <span className={styles.value}>{occupationalCount}</span>
                      </div>
                    </div>

                    <div className={styles.categorySkills}>
                      <strong>Sample Skills:</strong>
                      <span>{categorySkills.slice(0, 4).map(s => s.name).join(', ')}</span>
                      {categorySkills.length > 4 && <span> +{categorySkills.length - 4} more</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Skill Details Modal */}
        {selectedSkill && (
          <div className={styles.modal} onClick={closeSkillDetails}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>
                  <span className={styles.categoryIcon}>
                    {getCategoryIcon(selectedSkill.category)}
                  </span>
                  <h2>{selectedSkill.name}</h2>
                </div>
                <button onClick={closeSkillDetails} className={styles.closeBtn}>×</button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.skillDetails}>
                  <div className={styles.detailSection}>
                    <div className={styles.basicInfo}>
                      <div className={styles.infoCard}>
                        <h3>Basic Information</h3>
                        <p><strong>Category:</strong> {selectedSkill.category}</p>
                        <p><strong>Base Chance:</strong> {selectedSkill.baseChance}%</p>
                        <p>
                          <strong>Difficulty:</strong> 
                          <span style={{ color: getDifficultyColor(selectedSkill.difficulty) }}>
                            {selectedSkill.difficulty}
                          </span>
                        </p>
                        <p><strong>Type:</strong> {selectedSkill.isOccupational ? 'Occupational' : 'Personal Interest'}</p>
                        <p><strong>Can Be Specialized:</strong> {selectedSkill.canBeSpecialized ? 'Yes' : 'No'}</p>
                        {selectedSkill.timeRequired && (
                          <p><strong>Time Required:</strong> {selectedSkill.timeRequired}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h3>Description</h3>
                    <p className={styles.fullDescription}>{selectedSkill.description}</p>
                  </div>

                  {selectedSkill.historicalNotes && (
                    <div className={styles.detailSection}>
                      <h3>Historical Context</h3>
                      <p className={styles.historicalNotes}>{selectedSkill.historicalNotes}</p>
                    </div>
                  )}

                  {selectedSkill.specializations && selectedSkill.specializations.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Specializations</h3>
                      <div className={styles.specializationsList}>
                        {selectedSkill.specializations.map((spec, index) => (
                          <span key={index} className={styles.specializationBadge}>{spec}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSkill.equipmentRequired && selectedSkill.equipmentRequired.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Equipment Required</h3>
                      <ul className={styles.equipmentList}>
                        {selectedSkill.equipmentRequired.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedSkill.examples && selectedSkill.examples.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Examples of Use</h3>
                      <ul className={styles.examplesList}>
                        {selectedSkill.examples.map((example, index) => (
                          <li key={index}>{example}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedSkill.relatedSkills && selectedSkill.relatedSkills.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Related Skills</h3>
                      <div className={styles.relatedSkills}>
                        {selectedSkill.relatedSkills.map((skill, index) => (
                          <span key={index} className={styles.relatedSkillBadge}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSkill.improvementNotes && (
                    <div className={styles.detailSection}>
                      <h3>Improvement Notes</h3>
                      <p className={styles.improvementNotes}>{selectedSkill.improvementNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
};

export default SkillsPage; 
