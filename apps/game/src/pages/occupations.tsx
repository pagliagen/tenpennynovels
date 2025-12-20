import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useGame } from '../contexts/GameContext';
import { GameLayout } from '../components/GameLayout';
import styles from '../styles/pages/Occupations.module.scss';

interface Occupation {
  id: string;
  name: string;
  description: string;
  era: string;
  category: string;
  socialClass: string;
  creditRating: {
    min: number;
    max: number;
  };
  skillPoints: number;
  suggestedContacts: string[];
  skillsAndSpecializations: Array<{
    skill: string;
    specialization?: string;
    points: number;
    isRequired: boolean;
  }>;
  occupationalSkills: string[];
  personalInterests: number;
  characteristics: {
    [key: string]: {
      min?: number;
      max?: number;
      modifier?: number;
    };
  };
  equipmentAndPossessions: string[];
  lifestyle: string;
  notes?: string;
  historicalContext?: string;
  genderRestriction?: string[];
  requiredAge?: {
    min: number;
    max: number;
  };
}

const OccupationsPage: NextPage = () => {
  const { gameData, character } = useGame();
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOccupation, setSelectedOccupation] = useState<Occupation | null>(null);
  const [filters, setFilters] = useState({
    era: '',
    category: '',
    socialClass: '',
    gender: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'socialClass' | 'skillPoints'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (character && gameData) {
      loadOccupations();
    }
  }, [character, gameData]);

  useEffect(() => {
    if (character && gameData) {
      loadOccupations();
    }
  }, [filters, searchQuery, sortBy, sortOrder]);

  const loadOccupations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        sortOrder
      });
      
      if (filters.era) params.append('era', filters.era);
      if (filters.category) params.append('category', filters.category);
      if (filters.socialClass) params.append('socialClass', filters.socialClass);
      if (filters.gender) params.append('gender', filters.gender);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/game/occupations?${params.toString()}`, {
        credentials: 'include'
      });
      
      const data = await response.json();
      if (data.success) {
        setOccupations(data.data.occupations);
      }
    } catch (error) {
      console.error('Error loading occupations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openOccupationDetails = (occupation: Occupation) => {
    setSelectedOccupation(occupation);
  };

  const closeOccupationDetails = () => {
    setSelectedOccupation(null);
  };

  const getSocialClassColor = (socialClass: string) => {
    switch (socialClass.toLowerCase()) {
      case 'lower': return '#ef4444';
      case 'middle': return '#f59e0b';
      case 'upper': return '#10b981';
      case 'aristocracy': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'academic': return '🎓';
      case 'artistic': return '🎨';
      case 'business': return '💼';
      case 'criminal': return '🕵️';
      case 'entertainment': return '🎭';
      case 'government': return '🏛️';
      case 'industrial': return '⚙️';
      case 'medical': return '⚕️';
      case 'military': return '⚔️';
      case 'religious': return '⛪';
      case 'service': return '🛎️';
      case 'technical': return '🔧';
      case 'transportation': return '🚂';
      default: return '📋';
    }
  };

  if (!gameData || loading) {
    return <div className={styles.loading}>Loading occupations...</div>;
  }

  if (!character || !gameData) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.error}>Please select a character to browse occupations</div>
      </GameLayout>
    );
  }

  return (
    <GameLayout gameData={gameData}>
      <div className={styles.occupationsPage}>
        <div className={styles.header}>
          <h1>Victorian Occupations</h1>
          <p className={styles.subtitle}>
            Explore the professions available in 19th century London
          </p>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>Era:</label>
            <select
              value={filters.era}
              onChange={(e) => setFilters({...filters, era: e.target.value})}
              className={styles.select}
            >
              <option value="">All Eras</option>
              <option value="Early Victorian">Early Victorian (1837-1850)</option>
              <option value="Mid Victorian">Mid Victorian (1850-1870)</option>
              <option value="Late Victorian">Late Victorian (1870-1901)</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Category:</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className={styles.select}
            >
              <option value="">All Categories</option>
              <option value="Academic">Academic</option>
              <option value="Artistic">Artistic</option>
              <option value="Business">Business</option>
              <option value="Criminal">Criminal</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Government">Government</option>
              <option value="Industrial">Industrial</option>
              <option value="Medical">Medical</option>
              <option value="Military">Military</option>
              <option value="Religious">Religious</option>
              <option value="Service">Service</option>
              <option value="Technical">Technical</option>
              <option value="Transportation">Transportation</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Social Class:</label>
            <select
              value={filters.socialClass}
              onChange={(e) => setFilters({...filters, socialClass: e.target.value})}
              className={styles.select}
            >
              <option value="">All Classes</option>
              <option value="Lower">Lower Class</option>
              <option value="Middle">Middle Class</option>
              <option value="Upper">Upper Class</option>
              <option value="Aristocracy">Aristocracy</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>Gender:</label>
            <select
              value={filters.gender}
              onChange={(e) => setFilters({...filters, gender: e.target.value})}
              className={styles.select}
            >
              <option value="">All Genders</option>
              <option value="male">Male Only</option>
              <option value="female">Female Only</option>
              <option value="both">Both Genders</option>
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
              <option value="socialClass-asc">Social Class (Low to High)</option>
              <option value="socialClass-desc">Social Class (High to Low)</option>
              <option value="skillPoints-asc">Skill Points (Low to High)</option>
              <option value="skillPoints-desc">Skill Points (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search occupations by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Occupations Grid */}
        <div className={styles.occupationsGrid}>
          {occupations.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No occupations found</h3>
              <p>Try adjusting your filters or search query.</p>
            </div>
          ) : (
            occupations.map((occupation) => (
              <div
                key={occupation.id}
                className={styles.occupationCard}
                onClick={() => openOccupationDetails(occupation)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.occupationTitle}>
                    <span className={styles.categoryIcon}>
                      {getCategoryIcon(occupation.category)}
                    </span>
                    <h3>{occupation.name}</h3>
                  </div>
                  <span
                    className={styles.socialClass}
                    style={{ backgroundColor: getSocialClassColor(occupation.socialClass) }}
                  >
                    {occupation.socialClass}
                  </span>
                </div>

                <div className={styles.occupationMeta}>
                  <span className={styles.era}>{occupation.era}</span>
                  <span className={styles.category}>{occupation.category}</span>
                </div>

                <p className={styles.description}>
                  {occupation.description.substring(0, 120)}
                  {occupation.description.length > 120 && '...'}
                </p>

                <div className={styles.cardStats}>
                  <div className={styles.stat}>
                    <span className={styles.label}>Credit Rating</span>
                    <span className={styles.value}>
                      {occupation.creditRating.min}-{occupation.creditRating.max}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>Skill Points</span>
                    <span className={styles.value}>{occupation.skillPoints}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>Interests</span>
                    <span className={styles.value}>{occupation.personalInterests}</span>
                  </div>
                </div>

                {occupation.genderRestriction && (
                  <div className={styles.genderRestriction}>
                    👥 {occupation.genderRestriction.join(', ')} only
                  </div>
                )}

                <div className={styles.skillPreview}>
                  <strong>Key Skills:</strong> {occupation.occupationalSkills.slice(0, 3).join(', ')}
                  {occupation.occupationalSkills.length > 3 && ` +${occupation.occupationalSkills.length - 3} more`}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Occupation Details Modal */}
        {selectedOccupation && (
          <div className={styles.modal} onClick={closeOccupationDetails}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div className={styles.modalTitle}>
                  <span className={styles.categoryIcon}>
                    {getCategoryIcon(selectedOccupation.category)}
                  </span>
                  <h2>{selectedOccupation.name}</h2>
                </div>
                <button onClick={closeOccupationDetails} className={styles.closeBtn}>×</button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.occupationDetails}>
                  <div className={styles.detailSection}>
                    <div className={styles.basicInfo}>
                      <div className={styles.infoCard}>
                        <h3>Basic Information</h3>
                        <p><strong>Era:</strong> {selectedOccupation.era}</p>
                        <p><strong>Category:</strong> {selectedOccupation.category}</p>
                        <p>
                          <strong>Social Class:</strong> 
                          <span 
                            className={styles.socialClassBadge}
                            style={{ backgroundColor: getSocialClassColor(selectedOccupation.socialClass) }}
                          >
                            {selectedOccupation.socialClass}
                          </span>
                        </p>
                        <p><strong>Credit Rating:</strong> {selectedOccupation.creditRating.min}-{selectedOccupation.creditRating.max}</p>
                        <p><strong>Skill Points:</strong> {selectedOccupation.skillPoints}</p>
                        <p><strong>Personal Interests:</strong> {selectedOccupation.personalInterests}</p>
                        <p><strong>Lifestyle:</strong> {selectedOccupation.lifestyle}</p>
                        
                        {selectedOccupation.genderRestriction && (
                          <p><strong>Gender Restriction:</strong> {selectedOccupation.genderRestriction.join(', ')}</p>
                        )}
                        
                        {selectedOccupation.requiredAge && (
                          <p><strong>Age Range:</strong> {selectedOccupation.requiredAge.min}-{selectedOccupation.requiredAge.max} years</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.detailSection}>
                    <h3>Description</h3>
                    <p className={styles.fullDescription}>{selectedOccupation.description}</p>
                  </div>

                  {selectedOccupation.historicalContext && (
                    <div className={styles.detailSection}>
                      <h3>Historical Context</h3>
                      <p className={styles.historicalContext}>{selectedOccupation.historicalContext}</p>
                    </div>
                  )}

                  <div className={styles.detailSection}>
                    <h3>Occupational Skills</h3>
                    <div className={styles.skillsList}>
                      {selectedOccupation.occupationalSkills.map((skill, index) => (
                        <span key={index} className={styles.skillBadge}>{skill}</span>
                      ))}
                    </div>
                  </div>

                  {selectedOccupation.skillsAndSpecializations.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Skills & Specializations</h3>
                      <div className={styles.specializationsList}>
                        {selectedOccupation.skillsAndSpecializations.map((item, index) => (
                          <div key={index} className={styles.specializationItem}>
                            <strong>{item.skill}</strong>
                            {item.specialization && <span className={styles.specialization}>({item.specialization})</span>}
                            <span className={styles.points}>{item.points} points</span>
                            {item.isRequired && <span className={styles.required}>Required</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(selectedOccupation.characteristics).length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Characteristic Requirements</h3>
                      <div className={styles.characteristicsList}>
                        {Object.entries(selectedOccupation.characteristics).map(([char, req]) => (
                          <div key={char} className={styles.characteristicItem}>
                            <strong>{char.toUpperCase()}:</strong>
                            {req.min && req.max && <span>{req.min}-{req.max}</span>}
                            {req.modifier && <span>{req.modifier > 0 ? '+' : ''}{req.modifier}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOccupation.suggestedContacts.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Suggested Contacts</h3>
                      <div className={styles.contactsList}>
                        {selectedOccupation.suggestedContacts.map((contact, index) => (
                          <span key={index} className={styles.contactBadge}>{contact}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOccupation.equipmentAndPossessions.length > 0 && (
                    <div className={styles.detailSection}>
                      <h3>Equipment & Possessions</h3>
                      <ul className={styles.equipmentList}>
                        {selectedOccupation.equipmentAndPossessions.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedOccupation.notes && (
                    <div className={styles.detailSection}>
                      <h3>Additional Notes</h3>
                      <p className={styles.notes}>{selectedOccupation.notes}</p>
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

export default OccupationsPage; 