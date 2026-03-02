/**
 * Card Component
 *
 * Reusable card component for displaying character information.
 * Used primarily in character-select page.
 *
 * **Features**:
 * - Victorian decorative styling
 * - Hover effects
 * - Clickable / Non-clickable variants
 * - Status badges (pending, approved, rejected)
 * - Character preview (avatar, name, occupation, description)
 *
 * **Use Cases**:
 * - Character selection cards
 * - Character profile preview
 * - List of characters
 *
 * @module components/ui/Card
 */

import React from 'react';

/**
 * Card component props
 *
 * @interface CardProps
 */
export interface CardProps {
  /** Card title (typically character name) */
  title?: string;
  /** Subtitle (typically occupation) */
  subtitle?: string;
  /** Card description text */
  description?: string;
  /** Status badge (e.g., 'approved', 'pending', 'rejected') */
  status?: 'approved' | 'pending' | 'rejected' | 'draft';
  /** Avatar image URL (optional) */
  avatarUrl?: string;
  /** Whether card is clickable */
  clickable?: boolean;
  /** Click handler (if clickable) */
  onClick?: () => void;
  /** Additional content (footer, actions, etc.) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get status label in Italian
 *
 * @param {string} status - Status code
 * @returns {string} Italian label
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    approved: 'Approvato',
    pending: 'In attesa',
    rejected: 'Rifiutato',
    draft: 'Bozza',
  };

  return labels[status] || status;
}

/**
 * Card Component
 *
 * Renders a styled card with Victorian aesthetics.
 * Primarily used for character display in character-select page.
 *
 * **Benefits**:
 * - **Consistent**: All character cards look the same
 * - **Reusable**: Use for any card-like content
 * - **Accessible**: Proper semantic HTML and ARIA attributes
 * - **Interactive**: Hover states and click handling
 *
 * **Variants**:
 * - **Clickable**: Has hover effect, cursor pointer, onClick handler
 * - **Non-clickable**: Static display only
 *
 * @param {CardProps} props - Component props
 * @returns {JSX.Element} Rendered card
 *
 * @example
 * ```typescript
 * import { Card } from '@/components/ui/Card';
 *
 * // Character card
 * <Card
 *   title="John Watson"
 *   subtitle="Medico"
 *   description="Un medico con un passato militare..."
 *   status="approved"
 *   avatarUrl="/avatars/watson.jpg"
 *   clickable={true}
 *   onClick={() => selectCharacter('watson-id')}
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Character selection list
 * function CharacterSelectPage() {
 *   const { characters } = useCharacters();
 *
 *   return (
 *     <div className="character-grid">
 *       {characters.map(char => (
 *         <Card
 *           key={char.id}
 *           title={char.name}
 *           subtitle={char.occupationDetails?.name}
 *           description={char.description}
 *           status={char.status}
 *           clickable={char.status === 'approved'}
 *           onClick={() => selectCharacter(char.id)}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Card with custom footer
 * <Card
 *   title="Character Name"
 *   subtitle="Occupation"
 *   status="pending"
 * >
 *   <div className="card-footer">
 *     <Button variant="secondary" size="small">Edit</Button>
 *     <Button variant="ghost" size="small">Delete</Button>
 *   </div>
 * </Card>
 * ```
 */
export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  description,
  status,
  avatarUrl,
  clickable = false,
  onClick,
  children,
  className = '',
}) => {
  const cardClasses = [
    'card',
    clickable && 'card--clickable',
    status && `card--status-${status}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (clickable && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `Seleziona ${title}` : undefined}
    >
      {/* Status badge */}
      {status && (
        <div className={`card__status card__status--${status}`}>
          {getStatusLabel(status)}
        </div>
      )}

      {/* Card header */}
      <div className="card__header">
        {/* Avatar (optional) */}
        {avatarUrl && (
          <div className="card__avatar">
            <img src={avatarUrl} alt={`${title} avatar`} />
          </div>
        )}

        {/* Title + Subtitle */}
        <div className="card__title-group">
          <h3 className="card__title">{title}</h3>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
      </div>

      {/* Card body */}
      {description && (
        <div className="card__body">
          <p className="card__description">{description}</p>
        </div>
      )}

      {/* Card footer (custom children) */}
      {children && <div className="card__footer">{children}</div>}
    </div>
  );
};
