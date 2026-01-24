import React, { useState, useEffect } from 'react';
import styles from './CharacterTooltip.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface CharacterTooltipProps {
  characterId: string;
  characterName: string;
  isMaster: boolean;
  onClose?: () => void;
}

interface CharacterData {
  stats?: {
    size?: number; // TAG - Stazza
  };
  derived?: {
    hitPoints?: number;
    sanityPoints?: number;
    magicPoints?: number;
  };
  height?: string;
  weight?: string;
  eyeColor?: string;
  hairColor?: string;
  visibleMarks?: string;
}

export default function CharacterTooltip({ 
  characterId, 
  characterName, 
  isMaster,
  onClose 
}: CharacterTooltipProps) {
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCharacterData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/game/characters/public/${characterId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.result && data.data?.character) {
            setCharacterData(data.data.character);
          }
        }
      } catch (error) {
        console.error('Error loading character data for tooltip:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCharacterData();
  }, [characterId]);

  if (isLoading) {
    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipContent}>
          <div className={styles.loading}>Caricamento...</div>
        </div>
      </div>
    );
  }

  if (!characterData) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipHeader}>
          <h4 className={styles.characterName}>{characterName}</h4>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Chiudi"
            >
              ×
            </button>
          )}
        </div>
        
        <div className={styles.tooltipBody}>
          {/* Dati visibili a tutti */}
          <div className={styles.section}>
            <h5 className={styles.sectionTitle}>Informazioni Visibili</h5>
            <div className={styles.infoGrid}>
              {characterData.stats?.size !== undefined && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Stazza (TAG):</span>
                  <span className={styles.infoValue}>{characterData.stats.size}</span>
                </div>
              )}
              {characterData.height && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Altezza:</span>
                  <span className={styles.infoValue}>{characterData.height}</span>
                </div>
              )}
              {characterData.weight && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Peso:</span>
                  <span className={styles.infoValue}>{characterData.weight}</span>
                </div>
              )}
              {characterData.eyeColor && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Colore occhi:</span>
                  <span className={styles.infoValue}>{characterData.eyeColor}</span>
                </div>
              )}
              {characterData.hairColor && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Colore capelli:</span>
                  <span className={styles.infoValue}>{characterData.hairColor}</span>
                </div>
              )}
              {characterData.visibleMarks && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Segni particolari:</span>
                  <span className={styles.infoValue}>{characterData.visibleMarks}</span>
                </div>
              )}
            </div>
          </div>

          {/* Parametri salute (solo per master) */}
          {isMaster && characterData.derived && (
            <div className={styles.section}>
              <h5 className={styles.sectionTitle}>Parametri Salute</h5>
              <div className={styles.infoGrid}>
                {characterData.derived.hitPoints !== undefined && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Punti Ferita:</span>
                    <span className={styles.infoValue}>{characterData.derived.hitPoints}</span>
                  </div>
                )}
                {characterData.derived.sanityPoints !== undefined && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Punti Sanità:</span>
                    <span className={styles.infoValue}>{characterData.derived.sanityPoints}</span>
                  </div>
                )}
                {characterData.derived.magicPoints !== undefined && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Punti Magia:</span>
                    <span className={styles.infoValue}>{characterData.derived.magicPoints}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

