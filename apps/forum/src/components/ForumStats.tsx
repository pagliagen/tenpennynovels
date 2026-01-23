import React, { useState, useEffect } from 'react';
import styles from '@/styles/components/ForumLayout.module.scss';

interface ForumStatsData {
  totalDiscussions: number;
  totalPosts: number;
}

export const ForumStats: React.FC = () => {
  const [stats, setStats] = useState<ForumStatsData>({
    totalDiscussions: 0,
    totalPosts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';
      const response = await fetch(`${API_BASE_URL}/forum/init`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load forum stats');
      }

      const data = await response.json();
      
      if (data.result && data.data) {
        setStats({
          totalDiscussions: data.data.totalDiscussions || 0,
          totalPosts: data.data.totalPosts || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load forum stats:', err);
      setError('Errore nel caricamento statistiche');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.sidebarSection}>
      <h3>Statistiche</h3>
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Discussioni Totali</span>
          <span className={styles.statValue}>
            {loading ? '...' : error ? '?' : stats.totalDiscussions}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Post Totali</span>
          <span className={styles.statValue}>
            {loading ? '...' : error ? '?' : stats.totalPosts}
          </span>
        </div>
      </div>
      {error && (
        <div className={styles.statsError}>
          <small>{error}</small>
        </div>
      )}
    </div>
  );
};