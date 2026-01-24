import React from 'react';
import styles from './TurnOrderDisplay.module.scss';

interface TurnOrderDisplayProps {
  occupants: Array<{
    characterId: string;
    characterName: string;
    enteredAt: Date | string;
  }>;
}

export default function TurnOrderDisplay({ occupants }: TurnOrderDisplayProps) {
  // Sort by entry time
  const sortedOccupants = [...occupants].sort((a, b) => {
    const timeA = typeof a.enteredAt === 'string' ? new Date(a.enteredAt).getTime() : a.enteredAt.getTime();
    const timeB = typeof b.enteredAt === 'string' ? new Date(b.enteredAt).getTime() : b.enteredAt.getTime();
    return timeA - timeB;
  });

  if (sortedOccupants.length === 0) {
    return null;
  }

  return (
    <div className={styles.turnOrderDisplay}>
      <span className={styles.label}>Ordine turni:</span>
      <div className={styles.turnList}>
        {sortedOccupants.map((occupant, index) => (
          <span key={occupant.characterId} className={styles.turnItem}>
            {index + 1}. {occupant.characterName}
          </span>
        ))}
      </div>
    </div>
  );
}

