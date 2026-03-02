/**
 * DocumentsLayout Component
 *
 * Master layout wrapper for all documents pages.
 * Includes Header, Sidebar (desktop), MobileBottomNav (mobile), and main content area.
 *
 * @module components/layout/DocumentsLayout
 * @since 1.0.0
 */

'use client';

import { useState, ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import styles from '@/styles/components/layout/DocumentsLayout.module.scss';

interface DocumentsLayoutProps {
  children: ReactNode;
}

export function DocumentsLayout({ children }: DocumentsLayoutProps): JSX.Element {
  const [searchVisible, setSearchVisible] = useState(false);

  return (
    <div className={styles.layout}>
      <Header onSearchToggle={() => setSearchVisible(!searchVisible)} showSearch={searchVisible} />

      <div className={styles.container}>
        <Sidebar />

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
