/**
 * Card Component
 *
 * Reusable card for character information. Used in the character selection modal.
 *
 * When onSelectCharacter is provided and the character is selectable, the entire card
 * is clickable (no separate "Seleziona" button). When the character is not selectable,
 * the card shows "Non disponibile" in the footer.
 *
 * @module components/ui/Card
 */

import React from 'react';

/**
 * Character data shape for Card (from API / Character type + optional fields)
 */
export interface CharacterCardData {
  id: string;
  name: string;
  occupationDetails?: { name: string };
  currentOccupation?: string;
  description?: string;
  status?: string;
  playerStatus?: string;
  avatar?: string;
  characterType?: 'pg_principale' | 'pg_master' | 'png';
  isBot?: boolean;
}

/**
 * Card component props (character-based).
 */
export interface CardProps {
  /** Character data; the card derives title, subtitle, description, status, avatar and badge from it. */
  character: CharacterCardData;
  /** Fallback avatar URL when character.avatar is missing. */
  fallbackAvatarUrl?: string;
  /** When provided, the whole card is clickable (if character is selectable) and this is called on click. */
  onSelectCharacter?: (characterId: string) => void;
  /** ID of the character currently being selected (loading state). */
  selectingId?: string;
  /** Additional CSS classes. */
  className?: string;
}

type CardStatus = 'approved' | 'pending' | 'rejected' | 'draft';

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    approved: 'Disponibile',
    pending: 'In attesa',
    rejected: 'Rifiutato',
    draft: 'Bozza',
  };
  return labels[status] || status;
}

function normalizeStatus(c: CharacterCardData): CardStatus {
  const s = (c.playerStatus ?? c.status)?.toLowerCase() || 'draft';
  if (s === 'approved' || s === 'pending' || s === 'rejected' || s === 'draft') return s;
  return 'draft';
}

function canSelectCharacter(c: CharacterCardData): boolean {
  const status = (c.playerStatus ?? c.status)?.toLowerCase();
  return status === 'approved' || status === 'draft' || status === 'pending';
}

/**
 * Renders a styled card. When onSelectCharacter is set and the character is selectable,
 * the entire card is clickable (role="button"). When not selectable, the footer shows "Non disponibile".
 *
 * @param props - Character and optional callbacks.
 * @returns Rendered card.
 *
 * @example
 * characters.map((character) => (
 *   <Card
 *     key={character.id}
 *     character={character}
 *     fallbackAvatarUrl={FALLBACK_AVATAR}
 *     onSelectCharacter={handleSelectCharacter}
 *     selectingId={selecting}
 *   />
 * ));
 */
export const Card: React.FC<CardProps> = ({
  character,
  fallbackAvatarUrl,
  onSelectCharacter,
  selectingId,
  className = '',
}) => {
  const status = normalizeStatus(character);
  const title = character.name;
  const subtitle = character.occupationDetails?.name ?? character.currentOccupation;
  const description = character.description;
  const avatarUrl = character.avatar || fallbackAvatarUrl;
  const characterType = character.characterType;
  const isBot = character.isBot;
  const showAction = onSelectCharacter != null;
  const canSelect = showAction && canSelectCharacter(character);
  const loading = selectingId === character.id;

  const cardClasses = [
    'card',
    status && `card--status-${status}`,
    canSelect && 'card--clickable',
    loading && 'card--loading',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (e: React.MouseEvent) => {
    if (canSelect && !loading && onSelectCharacter) {
      e.stopPropagation();
      onSelectCharacter(character.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (canSelect && !loading && onSelectCharacter && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelectCharacter(character.id);
    }
  };

  return (
    <div
      className={cardClasses}
      role={canSelect ? 'button' : undefined}
      tabIndex={canSelect ? 0 : undefined}
      aria-label={canSelect ? `Seleziona personaggio ${title}` : undefined}
      aria-busy={loading}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {status && (
        <div className={`card__status card__status--${status}`}>
          {getStatusLabel(status)}
        </div>
      )}

      <div className="card__header">
        {avatarUrl && (
          <div className="card__avatar">
            <img src={avatarUrl} alt={`Avatar di ${title}`} />
          </div>
        )}

        <div className="card__title-group">
          <div className="card__title-row">
            <h3 className="card__title">{title}</h3>
            {isBot && (
              <span className="card__badge card__badge--bot">BOT</span>
            )}
            {!isBot && characterType === 'pg_master' && (
              <span className="card__badge card__badge--master">MASTER</span>
            )}
            {!isBot && characterType === 'png' && (
              <span className="card__badge card__badge--png">PNG</span>
            )}
          </div>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
      </div>

      {description && (
        <div className="card__body">
          <p className="card__description">{description}</p>
        </div>
      )}

      {showAction && !canSelect && (
        <div className="card__footer">
          <span className="card__unavailable">Non disponibile</span>
        </div>
      )}
    </div>
  );
};
