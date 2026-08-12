'use client';

import { Occupation } from '@/lib/api/characterCreation';
import styles from '@/styles/components/character/wizard/OccupationCard.module.scss';

import { getOccupationImage } from './OccupationIconMap';

interface OccupationCardProps {
  occupation: Occupation;
  isSelected: boolean;
  onSelect: () => void;
}

export function OccupationCard({ occupation, isSelected, onSelect }: OccupationCardProps): JSX.Element {
  const imageSrc = getOccupationImage(occupation.image);
  const requiredSkillNames = (occupation.requiredSkillSlots || [])
    .map((slot) => {
      const names = slot.options.map((o) => o.name);
      return names.length > 1 ? names.join(' / ') : names[0] || '';
    })
    .filter(Boolean)
    .join(', ');
  const bonusSkillInfo = occupation.bonusSkills
    .map((s) => `${s.name} (+${s.bonusValue})`)
    .join(', ');

  return (
    <button
      type="button"
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      onClick={onSelect}
    >
      <header className={styles.header}>
        <img
          src={imageSrc}
          alt={occupation.name}
          width={32}
          height={32}
          className={styles.icon}
        />
        <h3 className={styles.title}>{occupation.name.toUpperCase()}</h3>
      </header>

      <div className={styles.body}>
        <p className={styles.description}>{occupation.description}</p>
      </div>

      <footer className={styles.footer}>
        <div className={styles.infoSection}>
          <span className={styles.infoLabel}>Contatti:</span>
          <span className={styles.infoValue}>{occupation.contacts || '—'}</span>
        </div>
        <div className={styles.infoSection}>
          <span className={styles.infoLabel}>Requisiti:</span>
          <span className={styles.infoValue}>{requiredSkillNames || '—'}</span>
        </div>
        <div className={styles.infoSection}>
          <span className={styles.infoLabel}>Guadagni:</span>
          <span className={styles.infoValue}>{occupation.earnings || '—'}</span>
        </div>
        <div className={styles.infoSection}>
          <span className={styles.infoLabel}>Bonus:</span>
          <span className={styles.infoValue}>{bonusSkillInfo || '—'}</span>
        </div>
      </footer>
    </button>
  );
}
