import React from 'react';
import styles from '@/styles/components/sidebar/MoonPhase.module.scss';

interface MoonPhaseProps {
  phase?: 'new' | 'waxing' | 'full' | 'waning';
}

export const MoonPhase: React.FC<MoonPhaseProps> = ({ phase = 'waning' }) => {
  // Map phase to image
  const getMoonImage = () => {
    switch (phase) {
      case 'waning':
        return '/images/sidebar/moon-waning.png';
      case 'new':
        return '/images/sidebar/moon-waning.png'; // Use waning as default
      case 'waxing':
        return '/images/sidebar/moon-waning.png'; // Use waning as default
      case 'full':
        return '/images/sidebar/moon-waning.png'; // Use waning as default
      default:
        return '/images/sidebar/moon-waning.png';
    }
  };

  return (
    <div className={styles.moonPhase}>
      <img 
        src={getMoonImage()} 
        alt={`Fase lunare: ${phase}`}
        className={styles.moonImage}
      />
    </div>
  );
};

