'use client';

import styles from '@/styles/components/fake-png/FakePngManager.module.scss';
import type { FakePng } from '@/types/fakePng';

interface FakePngSlotProps {
  fake: FakePng | null;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreate: () => void;
}

export function FakePngSlot({
  fake,
  isActive,
  onActivate,
  onEdit,
  onDelete,
  onCreate
}: FakePngSlotProps) {
  if (!fake) {
    return (
      <button className={styles.slotEmpty} onClick={onCreate}>
        <span className={styles.plusIcon}>+</span>
        <span className={styles.slotLabel}>Crea PNG</span>
      </button>
    );
  }

  return (
    <div className={`${styles.slotCard} ${isActive ? styles.slotActive : ''}`}>
      <div className={styles.slotAvatar}>
        {fake.avatar ? (
          <img src={fake.avatar} alt="" />
        ) : (
          <span className={styles.avatarPlaceholder}>
            {fake.name[0]?.toUpperCase()}
          </span>
        )}
      </div>

      <div className={styles.slotInfo}>
        <div className={styles.slotName}>
          {fake.name} {fake.surname}
        </div>
        {isActive && <span className={styles.activeBadge}>✓ Attivo</span>}
      </div>

      <div className={styles.slotActions}>
        {!isActive && (
          <button
            className={styles.actionButton}
            onClick={onActivate}
            title="Attiva questo PNG"
          >
            ▶
          </button>
        )}
        <button
          className={styles.actionButton}
          onClick={onEdit}
          title="Modifica"
        >
          ✏️
        </button>
        <button
          className={styles.actionButton}
          onClick={onDelete}
          title="Elimina"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
