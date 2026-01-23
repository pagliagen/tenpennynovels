import React, { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { useGame } from '../contexts/GameContext';
import { GameLayout } from '../components/GameLayout';
import styles from '../styles/pages/Relationships.module.scss';

interface RelationshipType {
  id: string;
  name: string;
  description: string;
  requiresMutualApproval: boolean;
  isExclusive: boolean;
  allowsSelfProposal: boolean;
  socialImplications: string;
  isPublic: boolean;
  respectabilityModifier: number;
  maxInstances?: number;
  requiredGender?: string[];
  requiredSocialClass?: string[];
}

interface CharacterRelationship {
  id: string;
  relationshipType: {
    id: string;
    name: string;
    description: string;
    isPublic: boolean;
    respectabilityModifier: number;
  };
  otherCharacter: {
    id: string;
    name: string;
    surname: string;
  };
  status: string;
  isInitiator: boolean;
  establishedAt?: Date;
  description: string;
  isPublic: boolean;
}

interface Character {
  id: string;
  name: string;
  surname: string;
  status: string;
}

const RelationshipsPage: NextPage = () => {
  const { gameData, character } = useGame();
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [activeTab, setActiveTab] = useState<'my-relationships' | 'propose-new' | 'relationship-types'>('my-relationships');

  useEffect(() => {
    if (character && gameData) {
      loadRelationships();
      loadRelationshipTypes();
      loadAvailableCharacters();
    }
  }, [character, gameData]);

  const loadRelationships = async () => {
    try {
      const response = await fetch('/api/game/relationships', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.result) {
        setRelationships(data.data.relationships || data.list || []);
      }
    } catch (error) {
      console.error('Error loading relationships:', error);
    }
  };

  const loadRelationshipTypes = async () => {
    try {
      const response = await fetch('/api/game/relationships/types', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.result) {
        setRelationshipTypes(data.data.relationshipTypes);
      }
    } catch (error) {
      console.error('Error loading relationship types:', error);
    }
  };

  const loadAvailableCharacters = async () => {
    try {
      const response = await fetch('/api/game/characters', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.result) {
        // Filter out current character
        const characters = data.data?.characters || data.list || [];
        const others = characters.filter(
          (char: Character) => char.id !== character?.id
        );
        setAvailableCharacters(others);
      }
    } catch (error) {
      console.error('Error loading characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProposeRelationship = async () => {
    if (!selectedType || !selectedCharacter) return;

    try {
      const response = await fetch('/api/game/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          targetCharacterId: selectedCharacter,
          relationshipTypeId: selectedType,
          description,
          isPublic
        })
      });

      const data = await response.json();
      if (data.result) {
        setShowProposeModal(false);
        setSelectedType('');
        setSelectedCharacter('');
        setDescription('');
        loadRelationships();
        alert('Relationship proposal sent successfully!');
      } else {
        alert(data.error || 'Error proposing relationship');
      }
    } catch (error) {
      console.error('Error proposing relationship:', error);
      alert('Error proposing relationship');
    }
  };

  const handleRespondToProposal = async (relationshipId: string, action: 'accept' | 'reject') => {
    try {
      const response = await fetch(`/api/game/relationships/${relationshipId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      if (data.result) {
        loadRelationships();
        alert(`Relationship proposal ${action}ed successfully!`);
      } else {
        alert(data.error || 'Error responding to proposal');
      }
    } catch (error) {
      console.error('Error responding to proposal:', error);
      alert('Error responding to proposal');
    }
  };

  const handleEndRelationship = async (relationshipId: string) => {
    if (!confirm('Are you sure you want to end this relationship?')) return;

    try {
      const response = await fetch(`/api/game/relationships/${relationshipId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (data.result) {
        loadRelationships();
        alert('Relationship ended successfully');
      } else {
        alert(data.error || 'Error ending relationship');
      }
    } catch (error) {
      console.error('Error ending relationship:', error);
      alert('Error ending relationship');
    }
  };

  if (!gameData || loading) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.loading}>Loading relationships...</div>
      </GameLayout>
    );
  }

  if (!character || !gameData) {
    return (
      <GameLayout gameData={gameData}>
        <div className={styles.error}>Please select a character to view relationships</div>
      </GameLayout>
    );
  }

  return (
    <GameLayout gameData={gameData}>
      <div className={styles.relationshipsPage}>
        <div className={styles.header}>
          <h1>Character Relationships</h1>
          <p className={styles.subtitle}>
            Manage your character's social connections in Victorian London
          </p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'my-relationships' ? styles.active : ''}`}
            onClick={() => setActiveTab('my-relationships')}
          >
            My Relationships ({relationships.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'propose-new' ? styles.active : ''}`}
            onClick={() => setActiveTab('propose-new')}
          >
            Propose New
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'relationship-types' ? styles.active : ''}`}
            onClick={() => setActiveTab('relationship-types')}
          >
            Available Types
          </button>
        </div>

        {/* My Relationships Tab */}
        {activeTab === 'my-relationships' && (
          <div className={styles.relationshipsList}>
            {relationships.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>No relationships yet</h3>
                <p>Start building your character's social network by proposing relationships with other characters.</p>
              </div>
            ) : (
              relationships.map((relationship) => (
                <div key={relationship.id} className={styles.relationshipCard}>
                  <div className={styles.relationshipHeader}>
                    <h4>{relationship.relationshipType.name}</h4>
                    <span className={`${styles.status} ${styles[relationship.status.toLowerCase()]}`}>
                      {relationship.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className={styles.relationshipDetails}>
                    <p><strong>With:</strong> {relationship.otherCharacter.name} {relationship.otherCharacter.surname}</p>
                    <p><strong>Role:</strong> {relationship.isInitiator ? 'Initiator' : 'Recipient'}</p>
                    {relationship.description && (
                      <p><strong>Description:</strong> {relationship.description}</p>
                    )}
                    <p><strong>Visibility:</strong> {relationship.isPublic ? 'Public' : 'Private'}</p>
                    {relationship.relationshipType.respectabilityModifier !== 0 && (
                      <p><strong>Social Impact:</strong> {relationship.relationshipType.respectabilityModifier > 0 ? '+' : ''}{relationship.relationshipType.respectabilityModifier} respectability</p>
                    )}
                    {relationship.establishedAt && (
                      <p><strong>Established:</strong> {new Date(relationship.establishedAt).toLocaleDateString()}</p>
                    )}
                  </div>

                  <div className={styles.relationshipActions}>
                    {relationship.status === 'PENDING_MUTUAL' && !relationship.isInitiator && (
                      <div className={styles.proposalActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.accept}`}
                          onClick={() => handleRespondToProposal(relationship.id, 'accept')}
                        >
                          Accept
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.reject}`}
                          onClick={() => handleRespondToProposal(relationship.id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    
                    {relationship.status === 'ESTABLISHED' && (
                      <button
                        className={`${styles.actionBtn} ${styles.end}`}
                        onClick={() => handleEndRelationship(relationship.id)}
                      >
                        End Relationship
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Propose New Tab */}
        {activeTab === 'propose-new' && (
          <div className={styles.proposeSection}>
            <div className={styles.proposeForm}>
              <h3>Propose New Relationship</h3>
              
              <div className={styles.formGroup}>
                <label>Relationship Type:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Select a relationship type...</option>
                  {relationshipTypes.filter(type => type.allowsSelfProposal).map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Target Character:</label>
                <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  className={styles.select}
                >
                  <option value="">Select a character...</option>
                  {availableCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name} {character.surname}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Description (Optional):</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={styles.textarea}
                  placeholder="Add a note about this relationship..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  Make this relationship publicly visible
                </label>
              </div>

              {selectedType && (
                <div className={styles.typeInfo}>
                  {relationshipTypes.find(t => t.id === selectedType) && (
                    <>
                      <h4>Relationship Details:</h4>
                      <p>{relationshipTypes.find(t => t.id === selectedType)?.socialImplications}</p>
                      {relationshipTypes.find(t => t.id === selectedType)?.requiresMutualApproval && (
                        <p className={styles.info}>⚠️ This relationship requires mutual approval</p>
                      )}
                      {relationshipTypes.find(t => t.id === selectedType)?.isExclusive && (
                        <p className={styles.info}>⚠️ This is an exclusive relationship type</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                className={styles.proposeBtn}
                onClick={handleProposeRelationship}
                disabled={!selectedType || !selectedCharacter}
              >
                Propose Relationship
              </button>
            </div>
          </div>
        )}

        {/* Relationship Types Tab */}
        {activeTab === 'relationship-types' && (
          <div className={styles.typesSection}>
            <h3>Available Relationship Types</h3>
            <div className={styles.typesList}>
              {relationshipTypes.map((type) => (
                <div key={type.id} className={styles.typeCard}>
                  <div className={styles.typeHeader}>
                    <h4>{type.name}</h4>
                    {type.respectabilityModifier !== 0 && (
                      <span className={`${styles.modifier} ${type.respectabilityModifier > 0 ? styles.positive : styles.negative}`}>
                        {type.respectabilityModifier > 0 ? '+' : ''}{type.respectabilityModifier}
                      </span>
                    )}
                  </div>
                  
                  <p>{type.description}</p>
                  <p className={styles.implications}>{type.socialImplications}</p>
                  
                  <div className={styles.typeProperties}>
                    {type.requiresMutualApproval && (
                      <span className={styles.property}>Requires Approval</span>
                    )}
                    {type.isExclusive && (
                      <span className={styles.property}>Exclusive</span>
                    )}
                    {!type.allowsSelfProposal && (
                      <span className={styles.property}>Master-Only</span>
                    )}
                    {!type.isPublic && (
                      <span className={styles.property}>Private</span>
                    )}
                    {type.maxInstances && (
                      <span className={styles.property}>Max: {type.maxInstances}</span>
                    )}
                  </div>
                  
                  {type.requiredGender && type.requiredGender.length > 0 && (
                    <p className={styles.requirements}>
                      <strong>Gender:</strong> {type.requiredGender.join(', ')}
                    </p>
                  )}
                  
                  {type.requiredSocialClass && type.requiredSocialClass.length > 0 && (
                    <p className={styles.requirements}>
                      <strong>Social Class:</strong> {type.requiredSocialClass.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
};

export default RelationshipsPage; 
