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

import { WindowData } from '@/types/window-manager';
import { CharacterDirectoryContent } from './CharacterDirectoryContent';
import { CharacterFaceClaimContent } from './CharacterFaceClaimContent';

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

    default:
      // Stub for unknown utility types
      return (
        <div style={{ padding: '2rem' }}>
          <h3>Utility Window (Stub)</h3>
          <p>Utility Name: {utilityName}</p>
          <p>TODO: Implement utility-specific UI based on utilityName</p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      );
  }
}
