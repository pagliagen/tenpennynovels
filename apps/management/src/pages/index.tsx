/**
 * Dashboard - Home page
 */

import React from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import styles from '@/styles/pages/Dashboard.module.scss';

export default function Dashboard() {
  return (
    <ManagementLayout>
      <Head>
        <title>Ten Penny Novels | Dashboard</title>
      </Head>

      <div className={styles.dashboard}>
        <h1 className={styles.title}>Dashboard</h1>

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>👥</div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>Utenti</h3>
              <p className={styles.cardValue}>-</p>
              <p className={styles.cardLabel}>Totale utenti registrati</p>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon}>🎭</div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>Personaggi</h3>
              <p className={styles.cardValue}>-</p>
              <p className={styles.cardLabel}>Personaggi attivi</p>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardIcon}>📄</div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>Documenti</h3>
              <p className={styles.cardValue}>-</p>
              <p className={styles.cardLabel}>Documenti pubblicati</p>
            </div>
          </div>
        </div>

        <div className={styles.welcome}>
          <h2>Benvenuto nel Management Panel</h2>
          <p>Sistema di gestione Ten Penny Novels - PHASE 1-4 completate ✓</p>
        </div>
      </div>
    </ManagementLayout>
  );
}
