import React from 'react';
import styles from '../../styles/components/dashboard/PersonalMetricCard.module.scss';

export interface MetricItem {
  id: string;
  label: string;
  meta: string; // Secondary info (e.g., "2 giorni fa", "80% approval rate")
}

export interface PersonalMetricCardProps {
  icon: string;
  title: string;
  count: number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  items?: MetricItem[];
  onViewAll?: () => void;
  loading?: boolean;
  emptyMessage?: string;
}

export const PersonalMetricCard: React.FC<PersonalMetricCardProps> = ({
  icon,
  title,
  count,
  subtitle,
  trend,
  items,
  onViewAll,
  loading = false,
  emptyMessage = 'Nessun elemento'
}) => {
  if (loading) {
    return (
      <div className={`${styles.metricCard} ${styles.loading}`}>
        <div className={styles.skeletonHeader}></div>
        <div className={styles.skeletonCount}></div>
        <div className={styles.skeletonSubtitle}></div>
      </div>
    );
  }

  return (
    <div className={styles.metricCard}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>{icon}</span>
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.countContainer}>
          <span className={styles.cardCount}>{count}</span>
          {trend && (
            <span
              className={`${styles.trend} ${
                trend.direction === 'up' ? styles.trendUp : styles.trendDown
              }`}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>

        {subtitle && <p className={styles.cardSubtitle}>{subtitle}</p>}

        {count === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>✓</span>
            <p>{emptyMessage}</p>
          </div>
        ) : items && items.length > 0 ? (
          <>
            <div className={styles.itemsList}>
              {items.map((item) => (
                <div key={item.id} className={styles.itemRow}>
                  <span className={styles.itemLabel}>{item.label}</span>
                  <span className={styles.itemMeta}>{item.meta}</span>
                </div>
              ))}
            </div>

            {onViewAll && (
              <button
                className={styles.viewAllButton}
                onClick={onViewAll}
                type="button"
              >
                Vedi tutti ({count})
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
