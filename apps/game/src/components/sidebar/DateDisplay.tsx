import React from 'react';
import styles from '@/styles/components/sidebar/DateDisplay.module.scss';

export const DateDisplay: React.FC = () => {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className={styles.dateDisplay}>
      <svg
        className={styles.arco}
        viewBox="0 0 400 200"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <path
            id="arco"
            d="M 80 160 A 120 120 0 0 1 320 160"
          />
        </defs>

        <text className={styles.dateText}>
          <textPath
            href="#arco"
            startOffset="50%"
            textAnchor="middle"
          >
            {formattedDate}
          </textPath>
        </text>
      </svg>
    </div>
  );
};
