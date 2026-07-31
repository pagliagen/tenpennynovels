/**
 * Utility Content Component
 *
 * Type-specific content for utility windows.
 * Varies by utility type (defined in window.data.utilityName).
 *
 * @module components/windows/contents/UtilityContent
 * @since 2.0.0
 */

'use client';

import { TicketPanelContent } from '@/components/tickets/TicketPanelContent';
import styles from '@/styles/components/windows/UtilityContent.module.scss';
import { WindowData } from '@/types/window-manager';

import { CharacterDirectoryContent } from './CharacterDirectoryContent';
import { CharacterFaceClaimContent } from './CharacterFaceClaimContent';
import { MarketContent } from './MarketContent';

/**
 * Utility Content Props
 *
 * @interface UtilityContentProps
 * @since 2.0.0
 */
interface UtilityContentProps {
  /** Utility name/type */
  utilityName: string;

  /** Full window data (allows arbitrary utility-specific fields) */
  data: Extract<WindowData, { type: 'utility' }>;
}

/**
 * Utility Content Component
 *
 * Routes utility windows based on utilityName.
 *
 * @component
 * @param {UtilityContentProps} props - Component props
 * @returns {JSX.Element} Utility content
 * @since 2.0.0
 */
export function UtilityContent({ utilityName, data }: UtilityContentProps): JSX.Element {
  // Route based on utilityName
  switch (utilityName) {
    case 'character-directory':
      return <CharacterDirectoryContent />;

    case 'character-faceclaim':
      return <CharacterFaceClaimContent />;

    case 'tickets':
      return <TicketPanelContent />;

    case 'market':
      return <MarketContent />;

    default:
      // Stub for unknown utility types (fallback for extensibility)
      return (
        <div className={styles.stub}>
          <h3>Utility Window</h3>
          <p>Utility Name: {utilityName}</p>
          <p className={styles.stubHint}>
            This utility type is not yet implemented.
          </p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      );
  }
}
