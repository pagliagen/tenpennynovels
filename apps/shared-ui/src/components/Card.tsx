import React from 'react';
import classNames from 'classnames';

export interface CardProps {
  variant?: 'default' | 'simple' | 'elevated' | 'ornate';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  children,
  className,
  onClick
}) => {
  const cardClasses = classNames(
    'card',
    {
      [`card-${variant}`]: variant !== 'default',
    },
    className
  );

  const CardComponent = onClick ? 'button' : 'div';

  return (
    <CardComponent 
      className={cardClasses} 
      onClick={onClick}
      style={onClick ? { border: 'none', background: 'transparent', padding: 0 } : undefined}
    >
      {onClick ? <div className="card">{children}</div> : children}
    </CardComponent>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className }) => (
  <div className={classNames('card-header', className)}>
    {children}
  </div>
);

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className }) => (
  <div className={classNames('card-body', className)}>
    {children}
  </div>
);

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className }) => (
  <div className={classNames('card-footer', className)}>
    {children}
  </div>
);

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className }) => (
  <h3 className={classNames('card-title', className)}>
    {children}
  </h3>
);

export interface CardSubtitleProps {
  children: React.ReactNode;
  className?: string;
}

export const CardSubtitle: React.FC<CardSubtitleProps> = ({ children, className }) => (
  <p className={classNames('card-subtitle', className)}>
    {children}
  </p>
);

export interface CardActionsProps {
  children: React.ReactNode;
  alignment?: 'start' | 'center' | 'end' | 'between';
  className?: string;
}

export const CardActions: React.FC<CardActionsProps> = ({ 
  children, 
  alignment = 'end',
  className 
}) => (
  <div className={classNames(
    'card-actions',
    {
      [`card-actions-${alignment}`]: alignment !== 'end'
    },
    className
  )}>
    {children}
  </div>
);

// Character Card Component
export interface CharacterCardProps {
  character: {
    id: string;
    name: string;
    occupation: string;
    status: 'approved' | 'pending' | 'rejected';
    avatar?: string;
    stats?: Record<string, number>;
  };
  selected?: boolean;
  onClick?: (characterId: string) => void;
  className?: string;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  selected = false,
  onClick,
  className
}) => {
  const cardClasses = classNames(
    'character-card',
    {
      'selected': selected,
    },
    className
  );

  const handleClick = () => {
    if (onClick) {
      onClick(character.id);
    }
  };

  return (
    <div className={cardClasses} onClick={handleClick}>
      <div className="character-avatar">
        {character.avatar ? (
          <img src={character.avatar} alt={character.name} />
        ) : (
          character.name.charAt(0)
        )}
      </div>
      
      <h3 className="character-name">{character.name}</h3>
      <p className="character-occupation">{character.occupation}</p>
      
      <span className={classNames('character-status', `status-${character.status}`)}>
        {character.status}
      </span>
      
      {character.stats && (
        <div className="character-stats">
          {Object.entries(character.stats).slice(0, 3).map(([stat, value]) => (
            <div key={stat} className="stat-row">
              <span className="stat-name">{stat}</span>
              <span className="stat-value">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Location Card Component
export interface LocationCardProps {
  location: {
    id: string;
    name: string;
    description: string;
    icon?: string;
    occupantCount?: number;
  };
  current?: boolean;
  onClick?: (locationId: string) => void;
  className?: string;
}

export const LocationCard: React.FC<LocationCardProps> = ({
  location,
  current = false,
  onClick,
  className
}) => {
  const cardClasses = classNames(
    'location-card',
    {
      'current-location': current,
    },
    className
  );

  const handleClick = () => {
    if (onClick) {
      onClick(location.id);
    }
  };

  return (
    <div className={cardClasses} onClick={handleClick}>
      <div className="location-icon">
        {location.icon || '🏛'}
      </div>
      
      <h3 className="location-name">{location.name}</h3>
      <p className="location-description">{location.description}</p>
      
      {location.occupantCount !== undefined && (
        <div className="location-occupants">
          <span className="occupant-count">{location.occupantCount}</span> occupants
        </div>
      )}
    </div>
  );
};

// Stats Card Component
export interface StatsCardProps {
  stats: Record<string, { value: number; modifier?: string }>;
  title?: string;
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  stats,
  title,
  className
}) => {
  return (
    <div className={classNames('stats-card', className)}>
      {title && <CardTitle>{title}</CardTitle>}
      
      <div className="stat-grid">
        {Object.entries(stats).map(([statName, statData]) => (
          <div key={statName} className="stat-item">
            <div className="stat-label">{statName}</div>
            <div className="stat-value">{statData.value}</div>
            {statData.modifier && (
              <div className="stat-modifier">{statData.modifier}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Message Card Component
export interface MessageCardProps {
  message: {
    id: string;
    sender: string;
    content: string;
    timestamp: Date;
    type?: 'letter' | 'telegram' | 'note';
  };
  variant?: 'sent' | 'received';
  className?: string;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  variant = 'received',
  className
}) => {
  const cardClasses = classNames(
    'message-card',
    `message-${variant}`,
    className
  );

  return (
    <div className={cardClasses}>
      <div className="message-header">
        <span className="message-sender">{message.sender}</span>
        <span className="message-timestamp">
          {message.timestamp.toLocaleTimeString()}
        </span>
      </div>
      
      <div className="message-content">
        {message.content}
      </div>
      
      {message.type && (
        <div className={classNames('message-type', `type-${message.type}`)}>
          {message.type}
        </div>
      )}
    </div>
  );
};