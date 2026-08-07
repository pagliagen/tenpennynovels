/**
 * Informazioni Tab Component
 *
 * Mostra tutti i campi raccolti nel wizard Step1BasicInfo (informazioni
 * anagrafiche), divisi in pubblici (visibili a tutti) e privati (solo
 * proprietario/master) secondo i commenti di visibilità in Character.ts.
 *
 * @module components/character/tabs/InformazioniTab
 * @since 2.0.0
 */

'use client';

import type { CSSProperties } from 'react';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface InformazioniTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

const MARITAL_STATUS_LABELS: Record<string, string> = {
  single: 'Celibe/Nubile',
  married: 'Coniugato/a',
  widowed: 'Vedovo/a',
  divorced: 'Divorziato/a',
  engaged: 'Fidanzato/a'
};

export function InformazioniTab({ character, permissions }: InformazioniTabProps): JSX.Element {
  const canViewPrivate = permissions.canViewPrivateBackground;

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        📋 Informazioni Generali
      </h2>

      {/* Anagrafica pubblica */}
      <div className={styles.grid2}>
        <InfoField label="Nome" value={character.name} />
        <InfoField label="Cognome" value={character.surname || 'N/A'} />
        <InfoField label="Età apparente" value={character.apparentAge?.toString() || 'N/A'} />
        <InfoField label="Genere" value={character.gender === 'male' ? 'Maschile' : character.gender === 'female' ? 'Femminile' : character.gender || 'N/A'} />
        <InfoField label="Altezza" value={character.height || 'N/A'} />
        <InfoField label="Peso" value={character.weight || 'N/A'} />
        <InfoField
          label="Occupazione"
          value={character.occupation?.name || 'Nessuna'}
        />
        <InfoField label="Occupazione attuale" value={character.currentOccupation || 'N/A'} />
      </div>

      {/* Physical Description */}
      {character.physicalDescription && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            🎭 Descrizione Fisica
          </h3>
          <div className={styles.bodyBox}>
            <p className={styles.bodyPre}>{character.physicalDescription}</p>
          </div>
        </div>
      )}

      {character.visibleMarks && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            ✒️ Segni Particolari Visibili
          </h3>
          <div className={styles.bodyBox}>
            <p className={styles.bodyPre}>{character.visibleMarks}</p>
          </div>
        </div>
      )}

      {/* Public Description */}
      {character.publicBackground && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            📜 Descrizione Pubblica
          </h3>
          <div className={styles.bodyBox}>
            <p className={styles.bodyPre}>{character.publicBackground}</p>
          </div>
        </div>
      )}

      {/* Anagrafica privata — solo proprietario/master */}
      {canViewPrivate ? (
        <div className={styles.mtSection}>
          <h3 className={styles.sectionTitleLg}>
            🔒 Anagrafica Riservata
          </h3>
          <div className={styles.grid2}>
            <InfoField label="Età reale" value={character.age?.toString() || 'N/A'} />
            <InfoField label="Data di nascita" value={character.birthDate || 'N/A'} />
            <InfoField label="Luogo di nascita" value={character.birthPlace || 'N/A'} />
            <InfoField label="Stato civile" value={character.maritalStatus ? (MARITAL_STATUS_LABELS[character.maritalStatus] || character.maritalStatus) : 'N/A'} />
            <InfoField label="Titolo di studio" value={character.educationTitle || 'N/A'} />
            <InfoField label="Colore occhi" value={character.eyeColor || 'N/A'} />
            <InfoField label="Colore capelli" value={character.hairColor || 'N/A'} />
          </div>

          {character.hiddenMarks && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Segni Particolari Non Visibili</h3>
              <div className={styles.bodyBox}>
                <p className={styles.bodyPre}>{character.hiddenMarks}</p>
              </div>
            </div>
          )}

          {character.pathologies && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Patologie</h3>
              <div className={styles.bodyBox}>
                <p className={styles.bodyPre}>{character.pathologies}</p>
              </div>
            </div>
          )}

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Fedina Penale</h3>
            <div className={styles.bodyBox}>
              <p className={styles.bodyPre}>{character.criminalRecord || 'Nessuna'}</p>
            </div>
          </div>

          {character.privateDescription && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Biografia Privata</h3>
              <div className={styles.bodyBox}>
                <p className={styles.bodyPre}>{character.privateDescription}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.lockPanelMt}>
          <div className={styles.emptyIconSm}>🔒</div>
          <p className={styles.lockTextPlain}>
            Età reale, dati anagrafici riservati e biografia privata sono visibili solo al proprietario e ai master.
          </p>
        </div>
      )}

      {/* Stats Preview */}
      <div className={styles.mtSection}>
        <h3 className={styles.sectionTitle}>
          ⚡ Statistiche Rapide
        </h3>
        <div className={styles.grid3}>
          <StatBox label="HP" value={character.derived?.hitPoints || 0} color="#4ade80" />
          <StatBox label="Sanity" value={character.derived?.sanity || 0} color="#fbbf24" />
          <StatBox label="MP" value={character.derived?.magicPoints || 0} color="#60a5fa" />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoField}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className={styles.statBox}
      style={{ '--stat-accent': color } as CSSProperties}
    >
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  );
}
