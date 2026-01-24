import React from 'react';
import styles from '@/styles/components/sidebar/DateDisplay.module.scss';

export const DateDisplay: React.FC = () => {
  // Get current date formatted
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className={styles.dateDisplay}>
      {formattedDate}
    </div>
  );
};

