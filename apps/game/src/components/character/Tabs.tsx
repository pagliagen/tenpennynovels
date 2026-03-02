/**
 * Character Sheet Tabs Component
 *
 * Vertical sidebar tabs for character sheet navigation.
 * Positioned as third column in characterSheetContent layout.
 *
 * @module components/character/Tabs
 * @since 2.0.0
 */

'use client';

import { CharacterSheetTab } from '../windows/contents/CharacterSheetContent';
import styles from '@/styles/components/character/CharacterSheetContent.module.scss';

/**
 * Tab Configuration
 */
interface TabConfig {
  key: CharacterSheetTab;
  label: string;
  icon: string;
}

/**
 * All available tabs
 */
const TABS: TabConfig[] = [
  { key: 'informazioni', label: 'Informazioni', icon: 'ℹ️' },
  { key: 'background', label: 'Background', icon: '📖' },
  { key: 'statistiche', label: 'Statistiche', icon: '📊' },
  { key: 'abilita', label: 'Abilità', icon: '🎯' },
  { key: 'diario', label: 'Diario', icon: '📔' },
  { key: 'noteMaster', label: 'Note Master', icon: '🎭' },
  { key: 'inventario', label: 'Inventario', icon: '🎒' },
  { key: 'corporations', label: 'Corporations', icon: '🏢' },
  { key: 'alloggio', label: 'Alloggio', icon: '🏠' },
];

/**
 * Tabs Component Props
 */
interface TabsProps {
  /** Currently active tab */
  activeTab: CharacterSheetTab;

  /** Tab change handler */
  onTabChange: (tab: CharacterSheetTab) => void;
}

/**
 * Tabs Component
 *
 * Vertical sidebar with clickable tabs for character sheet navigation.
 *
 * @component
 * @param {TabsProps} props - Component props
 * @returns {JSX.Element} Tabs sidebar
 * @since 2.0.0
 */
export function Tabs({ activeTab, onTabChange }: TabsProps): JSX.Element {
  return (
    <div className={styles.tabsBar}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tab} ${activeTab === tab.key ? styles.active : ''}`}
          onClick={() => onTabChange(tab.key)}
          aria-label={tab.label}
          aria-selected={activeTab === tab.key}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
