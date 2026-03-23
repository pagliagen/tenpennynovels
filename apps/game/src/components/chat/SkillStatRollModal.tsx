/**
 * Skill/Stat Roll Modal Component
 *
 * Modal for selecting and rolling a skill or stat check.
 * Allows free rolls on any skill/stat owned by the character.
 *
 * @module components/chat/SkillStatRollModal
 * @since 2.0.0
 */

'use client';

import { useState } from 'react';

import styles from './SkillStatRollModal.module.scss';

/**
 * Skill data structure (matches CharacterData.skills from MessageInput)
 */
interface Skill {
  id: string;
  name: string;
  value: number;
  category?: string;
}

/**
 * Modal Props
 */
interface SkillStatRollModalProps {
  /** Available skills */
  skills?: Array<Skill>;

  /** Available stats (name → value) */
  stats?: Record<string, number>;

  /** Callback when roll is confirmed (id for skills, statName for stats) */
  onRoll: (type: 'skill' | 'stat', id: string, displayName: string) => void;

  /** Callback to close modal */
  onClose: () => void;
}

/**
 * Skill/Stat Roll Modal
 *
 * Two-tab modal: Skills | Stats
 * User selects one and confirms to roll.
 *
 * @param {SkillStatRollModalProps} props - Component props
 * @returns {JSX.Element} Modal
 */
export function SkillStatRollModal({
  skills = [],
  stats = {},
  onRoll,
  onClose,
}: SkillStatRollModalProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<'skills' | 'stats'>('skills');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedStat, setSelectedStat] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  /**
   * Handle roll confirmation
   */
  const handleRoll = () => {
    if (activeTab === 'skills' && selectedSkill) {
      // Find selected skill to get ID (selectedSkill is actually the skill ID now)
      const skill = skills.find(s => s.id === selectedSkill);
      if (skill) {
        onRoll('skill', skill.id, skill.name);
      }
      onClose();
    } else if (activeTab === 'stats' && selectedStat) {
      // For stats, name is the ID (no separate stat IDs)
      onRoll('stat', selectedStat, selectedStat);
      onClose();
    }
  };

  // Filter skills by search term
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statsArray = Object.entries(stats);
  const canRoll = (activeTab === 'skills' && selectedSkill) || (activeTab === 'stats' && selectedStat);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Usa Abilità o Caratteristica</h3>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'skills' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('skills');
              setSelectedStat('');
            }}
          >
            Abilità ({searchTerm ? `${filteredSkills.length}/${skills.length}` : skills.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'stats' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('stats');
              setSelectedSkill('');
            }}
          >
            Caratteristiche ({statsArray.length})
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalBody}>
          {activeTab === 'skills' && (
            <>
              {/* Search Box */}
              <div className={styles.searchBox}>
                <input
                  type="text"
                  placeholder="Cerca abilità..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={styles.clearSearch}
                    aria-label="Cancella ricerca"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Skills List */}
              <div className={styles.skillsList}>
                {skills.length === 0 ? (
                  <p className={styles.emptyMessage}>Nessuna abilità disponibile</p>
                ) : filteredSkills.length === 0 ? (
                  <p className={styles.emptyMessage}>Nessuna abilità trovata per "{searchTerm}"</p>
                ) : (
                  filteredSkills.map((skill) => (
                    <label
                      key={skill.id}
                      className={`${styles.skillItem} ${selectedSkill === skill.id ? styles.selected : ''}`}
                    >
                      <input
                        type="radio"
                        name="skill"
                        value={skill.id}
                        checked={selectedSkill === skill.id}
                        onChange={(e) => setSelectedSkill(e.target.value)}
                      />
                      <span className={styles.skillName}>{skill.name}</span>
                      <span className={styles.skillValue}>{skill.value}%</span>
                      {skill.category && (
                        <span className={styles.skillCategory}>({skill.category})</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === 'stats' && (
            <div className={styles.statsList}>
              {statsArray.length === 0 ? (
                <p className={styles.emptyMessage}>Nessuna caratteristica disponibile</p>
              ) : (
                statsArray.map(([name, value]) => (
                  <label
                    key={name}
                    className={`${styles.statItem} ${selectedStat === name ? styles.selected : ''}`}
                  >
                    <input
                      type="radio"
                      name="stat"
                      value={name}
                      checked={selectedStat === name}
                      onChange={(e) => setSelectedStat(e.target.value)}
                    />
                    <span className={styles.statName}>{name}</span>
                    <span className={styles.statValue}>{value}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className={styles.modalFooter}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
          >
            Annulla
          </button>
          <button
            className={styles.rollButton}
            onClick={handleRoll}
            disabled={!canRoll}
          >
            🎲 Tira
          </button>
        </div>
      </div>
    </div>
  );
}
