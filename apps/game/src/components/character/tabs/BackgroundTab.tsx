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

interface BackgroundTabProps {
  character: CharacterSheetData['character'];
  permissions: CharacterSheetPermissions;
  visibleSkills: string[];
  visibleEquipment: string[];
}

export function BackgroundTab({ character, permissions }: BackgroundTabProps): JSX.Element {
  return (
    <div style={{ padding: '1.5rem', color: '#e8e0d5', fontFamily: 'Georgia, serif' }}>
      <h2 style={{ color: '#ff9500', marginBottom: '1.5rem', fontSize: '1.5rem', borderBottom: '2px solid rgba(255, 149, 0, 0.3)', paddingBottom: '0.5rem' }}>
        📖 Background del Personaggio
      </h2>

      {/* Public Background */}
      {character.publicBackground && (
        <Section title="📜 Background Pubblico" icon="🌍">
          <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
            {character.publicBackground}
          </p>
        </Section>
      )}

      {/* Private Background (Owner/Game Masters only) */}
      {permissions.canViewPrivateBackground ? (
        <>
          {character.privateBackground && (
            <Section title="🔒 Background Privato" icon="🔐">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.privateBackground}
              </p>
            </Section>
          )}

          {character.motivations && (
            <Section title="💫 Motivazioni">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.motivations}
              </p>
            </Section>
          )}

          {character.fears && (
            <Section title="😨 Paure">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.fears}
              </p>
            </Section>
          )}

          {character.traumas && (
            <Section title="💔 Traumi">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.traumas}
              </p>
            </Section>
          )}

          {character.beliefSystem && (
            <Section title="✨ Sistema di Credenze">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.beliefSystem}
              </p>
            </Section>
          )}

          {character.bonds && (
            <Section title="🤝 Legami">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.bonds}
              </p>
            </Section>
          )}

          {character.secrets && (
            <Section title="🤫 Segreti">
              <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {character.secrets}
              </p>
            </Section>
          )}
        </>
      ) : (
        /* Permission Denied Message */
        <div style={{
          background: 'rgba(139, 69, 19, 0.3)',
          border: '2px solid rgba(255, 149, 0, 0.4)',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center',
          marginTop: '1.5rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔒</div>
          <h3 style={{ color: '#ff9500', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            Background Privato Non Accessibile
          </h3>
          <p style={{ color: '#999', lineHeight: '1.6' }}>
            Il background privato di questo personaggio è visibile solo al proprietario<br />
            e ai game masters. Puoi vedere solo le informazioni pubbliche.
          </p>
        </div>
      )}

      {/* Empty State */}
      {!character.publicBackground && !character.privateBackground && (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1.5rem',
          color: '#999'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📖</div>
          <p>Nessun background disponibile per questo personaggio.</p>
        </div>
      )}
    </div>
  );
}

// Helper Component
function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{
        color: '#ff9500',
        fontSize: '1.125rem',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        {icon && <span>{icon}</span>}
        {title}
      </h3>
      <div style={{
        background: 'rgba(40, 30, 20, 0.6)',
        padding: '1rem',
        borderRadius: '6px',
        border: '1px solid rgba(255, 149, 0, 0.2)'
      }}>
        {children}
      </div>
    </div>
  );
}
