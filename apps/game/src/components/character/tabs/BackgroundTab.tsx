/**
 * Background Tab Component
 *
 * Shows character background with permission-based rendering:
 * - Public background (always visible)
 * - Private background (owner + game masters only)
 * - Motivations, fears, traumas, belief system, bonds, secrets
 *
 * @module components/character/tabs/BackgroundTab
 * @since 2.0.0
 */

'use client';

import { CharacterSheetData, CharacterSheetPermissions } from '@/hooks/useCharacterSheetData';
import styles from '@/styles/components/character/CharacterSheetTab.module.scss';

interface BackgroundTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function BackgroundTab({ character, permissions }: BackgroundTabProps): JSX.Element {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        📖 Background del Personaggio
      </h2>

      {/* Public Background */}
      {character.publicBackground && (
        <Section title="📜 Background Pubblico" icon="🌍">
          <p className={styles.bodyPre}>{character.publicBackground}</p>
        </Section>
      )}

      {/* Private Background (Owner/Game Masters only) */}
      {permissions.canViewPrivateBackground ? (
        <>
          {character.privateBackground && (
            <Section title="🔒 Background Privato" icon="🔐">
              <p className={styles.bodyPre}>{character.privateBackground}</p>
            </Section>
          )}

          {character.motivations && (
            <Section title="💫 Motivazioni">
              <p className={styles.bodyPre}>{character.motivations}</p>
            </Section>
          )}

          {character.fears && (
            <Section title="😨 Paure">
              <p className={styles.bodyPre}>{character.fears}</p>
            </Section>
          )}

          {character.traumas && (
            <Section title="💔 Traumi">
              <p className={styles.bodyPre}>{character.traumas}</p>
            </Section>
          )}

          {character.beliefSystem && (
            <Section title="✨ Sistema di Credenze">
              <p className={styles.bodyPre}>{character.beliefSystem}</p>
            </Section>
          )}

          {character.bonds && (
            <Section title="🤝 Legami">
              <p className={styles.bodyPre}>{character.bonds}</p>
            </Section>
          )}

          {character.secrets && (
            <Section title="🤫 Segreti">
              <p className={styles.bodyPre}>{character.secrets}</p>
            </Section>
          )}
        </>
      ) : (
        /* Permission Denied Message */
        <div className={styles.lockPanelMt}>
          <div className={styles.emptyIconSm}>🔒</div>
          <h3 className={styles.lockTitle}>
            Background Privato Non Accessibile
          </h3>
          <p className={styles.lockText}>
            Il background privato di questo personaggio è visibile solo al proprietario<br />
            e ai game masters. Puoi vedere solo le informazioni pubbliche.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!character.publicBackground && !character.privateBackground && (
        <div className={styles.emptyStatePadded}>
          <div className={styles.emptyIcon}>📖</div>
          <p>Nessun background disponibile per questo personaggio.</p>
        </div>
      )}
    </div>
  );
}

// Helper Component
function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitleFlex}>
        {icon && <span>{icon}</span>}
        {title}
      </h3>
      <div className={styles.bodyBox}>
        {children}
      </div>
    </div>
  );
}
