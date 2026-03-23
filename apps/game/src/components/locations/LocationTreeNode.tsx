/**
 * Location Tree Node Component (Recursive)
 *
 * **CRITICAL COMPONENT** - Heart of the locations system.
 *
 * Renders a location node in the tree with:
 * - Recursive rendering for arbitrary depth (N levels)
 * - Always expanded (no collapse functionality)
 * - Proper indentation based on depth
 * - Highlight selected node
 * - Keyboard navigation support
 *
 * @module components/locations/LocationTreeNode
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/locations/list.module.scss';
import type { AccessibleLocation } from '@/types/location';

/**
 * Location Tree Node Props
 */
interface LocationTreeNodeProps {
  /** Location node to render */
  location: AccessibleLocation;
  /** Current depth in tree (for indentation) */
  depth?: number;
  /** ID of selected location */
  selectedId?: string;
  /** Callback when location is clicked */
  onLocationClick?: (location: AccessibleLocation) => void;
  /** Initially expanded state (unused - all nodes always expanded) */
  defaultExpanded?: boolean;
}

/**
 * Location Tree Node Component
 *
 * Recursive component that renders a location and all its children.
 * Handles arbitrary depth with proper indentation.
 *
 * @component
 * @param {LocationTreeNodeProps} props - Component props
 * @returns {JSX.Element} Location tree node
 *
 * @example
 * ```tsx
 * <LocationTreeNode
 *   location={westminster}
 *   depth={0}
 *   selectedId={selectedLocationId}
 *   onLocationClick={(loc) => setSelectedLocation(loc)}
 *   defaultExpanded={true}
 * />
 * ```
 */
export function LocationTreeNode({
  location,
  depth = 0,
  selectedId,
  onLocationClick,
  defaultExpanded = false,
}: LocationTreeNodeProps): JSX.Element {
  const hasChildren = (location.children?.length || 0) > 0;
  const isSelected = location._id === selectedId;
  const hasOccupants = (location.occupantCount || 0) > 0;

  // Calculate indentation (1.5rem per level)
  const indentStyle = {
    paddingLeft: `${depth * 1.5}rem`,
  };

  /**
   * Handle node click
   * Trigger onLocationClick callback
   */
  const handleClick = () => {
    if (onLocationClick) {
      onLocationClick(location);
    }
  };

  /**
   * Handle keyboard navigation
   * Enter/Space: Activate node
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={styles.treeNode}>
      {/* Current Node */}
      <div
        className={`${styles.nodeContent} ${isSelected ? styles.selected : ''} ${
          hasChildren ? styles.hasChildren : ''
        }`}
        style={indentStyle}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        aria-selected={isSelected}
        tabIndex={0}
      >
        {/* Location Name (icons removed) */}
        <span className={styles.nodeName}>{location.name}</span>

        {/* Occupant Count (if present) */}
        {hasOccupants && (
          <span className={styles.nodeOccupants} aria-label={`${location.occupantCount} presenti`}>
            ({location.occupantCount})
          </span>
        )}

        {/* Chat Available Indicator */}
        {location.hasChat && (
          <span className={styles.nodeChatBadge} title="Chat disponibile">
            💬
          </span>
        )}
      </div>

      {/* Children (Recursive - Always Expanded) */}
      {hasChildren && (
        <div className={styles.nodeChildren} role="group">
          {location.children!.map((child) => (
            <LocationTreeNode
              key={child._id}
              location={child}
              depth={depth + 1}
              selectedId={selectedId}
              onLocationClick={onLocationClick}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
