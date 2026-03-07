'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import styles from '@/styles/components/layout/DocumentsLayout.module.scss';

interface DocumentsLayoutProps {
  children: ReactNode;
}

export function DocumentsLayout({ children }: DocumentsLayoutProps): JSX.Element {
  return (
    <div className={styles.layout}>
      <Sidebar />

      <div className={styles.container}>
        <Header />

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
