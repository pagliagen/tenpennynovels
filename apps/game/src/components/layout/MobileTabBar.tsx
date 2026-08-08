/**
 * Mobile Tab Bar
 *
 * Sotto MOBILE_SHELL_BREAKPOINT (useIsCompactLayout.ts), Presenti e Bacheca
 * non hanno più un'icona propria in TopBar: si raggiungono da qui. Non sono
 * pannelli nuovi - sono i PresenceModal/ForumModal esistenti, riusati così
 * come sono (overlay `position: fixed` sopra la vista Game, che resta
 * sempre montata sotto qualunque tab sia "attiva" - nessun problema di
 * perdita di stato/scroll/bozze da gestire).
 *
 * Stato attivo derivato dagli store, non duplicato qui. I due store non si
 * conoscono a vicenda: la mutua esclusione (un solo pannello alla volta) la
 * impone questo componente.
 *
 * @module components/layout/MobileTabBar
 * @since 2.0.0
 */

'use client';

import { useForumStore } from '@/store/forumStore';
import { usePresenceStore } from '@/store/presenceStore';
import styles from '@/styles/components/layout/MobileTabBar.module.scss';

interface MobileTabBarProps {
  /** Numero di bacheche con novità, per il badge sul tab Bacheca */
  unreadForumCount?: number;
}

export function MobileTabBar({ unreadForumCount = 0 }: MobileTabBarProps): JSX.Element {
  const isForumOpen = useForumStore((s) => s.isOpen);
  const isForumCollapsed = useForumStore((s) => s.isCollapsed);
  const openForum = useForumStore((s) => s.openForum);
  const collapseForum = useForumStore((s) => s.collapseForum);

  const isPresenceModalOpen = usePresenceStore((s) => s.isModalOpen);
  const openPresenceModal = usePresenceStore((s) => s.openModal);
  const closePresenceModal = usePresenceStore((s) => s.closeModal);

  const isForumActive = isForumOpen && !isForumCollapsed;
  const isPresenceActive = isPresenceModalOpen;
  const isGameActive = !isForumActive && !isPresenceActive;

  const handleGameClick = () => {
    if (isPresenceModalOpen) closePresenceModal();
    if (isForumOpen && !isForumCollapsed) collapseForum();
  };

  const handlePresenzeClick = () => {
    if (isForumOpen && !isForumCollapsed) collapseForum();
    openPresenceModal();
  };

  const handleBachecaClick = () => {
    if (isPresenceModalOpen) closePresenceModal();
    openForum();
  };

  return (
    <nav className={styles.tabBar} aria-label="Navigazione principale">
      <button
        type="button"
        className={isPresenceActive ? styles.tabActive : styles.tab}
        onClick={handlePresenzeClick}
        aria-pressed={isPresenceActive}
      >
        <span className={styles.tabIcon} aria-hidden="true">👥</span>
        <span className={styles.tabLabel}>Presenti</span>
      </button>

      <button
        type="button"
        className={isGameActive ? styles.tabActive : styles.tab}
        onClick={handleGameClick}
        aria-pressed={isGameActive}
      >
        <span className={styles.tabIcon} aria-hidden="true">🎭</span>
        <span className={styles.tabLabel}>Game</span>
      </button>

      <button
        type="button"
        className={isForumActive ? styles.tabActive : styles.tab}
        onClick={handleBachecaClick}
        aria-pressed={isForumActive}
      >
        <span className={styles.tabIcon} aria-hidden="true">
          📜
          {unreadForumCount > 0 && (
            <span className={styles.tabBadge}>{unreadForumCount > 99 ? '99+' : unreadForumCount}</span>
          )}
        </span>
        <span className={styles.tabLabel}>Bacheca</span>
      </button>
    </nav>
  );
}
