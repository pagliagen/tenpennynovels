/**
 * Loading Skeleton Component
 *
 * Displays placeholder loading skeletons for async content.
 * Provides better UX than spinners by showing content structure while loading.
 *
 * **Features**:
 * - Multiple skeleton types (text, title, avatar, card, form)
 * - Animated pulse effect
 * - Composable (combine multiple skeletons)
 * - Accessible (proper ARIA attributes)
 *
 * **Use Cases**:
 * - Character list loading
 * - Profile loading
 * - Form loading (token validation)
 * - Occupation list loading
 *
 * @module components/ui/LoadingSkeleton
 */

import React, { type CSSProperties } from 'react';

/**
 * Skeleton variant types
 *
 * @typedef {string} SkeletonVariant
 */
export type SkeletonVariant = 'text' | 'title' | 'avatar' | 'card' | 'form';

/**
 * LoadingSkeleton component props
 *
 * @interface LoadingSkeletonProps
 */
export interface LoadingSkeletonProps {
  /** Skeleton variant type (default: 'text') */
  variant?: SkeletonVariant;
  /** Width (CSS value: '100%', '200px', '50rem', etc.) */
  width?: string;
  /** Height (CSS value: '1rem', '100px', '10vh', etc.) */
  height?: string;
  /** Whether to animate (pulse effect) */
  animated?: boolean;
  /** Number of repeated skeleton elements (for lists) */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Loading Skeleton Component
 *
 * Renders a loading placeholder skeleton with pulse animation.
 * Shows content structure while data is loading.
 *
 * **Benefits**:
 * - **Better UX**: Shows structure instead of blank screen
 * - **Perceived Performance**: Feels faster than spinners
 * - **Composable**: Combine multiple skeletons
 * - **Accessible**: Proper ARIA attributes
 *
 * **Variants**:
 * - **text**: Single line of text (default height: 1rem)
 * - **title**: Heading/title (default height: 2rem)
 * - **avatar**: Circular avatar (default size: 48px × 48px)
 * - **card**: Card placeholder (default height: 200px)
 * - **form**: Form field placeholder (default height: 3rem)
 *
 * @param {LoadingSkeletonProps} props - Component props
 * @returns {JSX.Element} Rendered skeleton(s)
 *
 * @example
 * ```typescript
 * import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
 *
 * // Text skeleton
 * <LoadingSkeleton variant="text" width="80%" />
 * ```
 *
 * @example
 * ```typescript
 * // Character card loading
 * function CharacterListLoading() {
 *   return (
 *     <div>
 *       <LoadingSkeleton variant="card" count={3} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Profile loading (composed)
 * <div className="profile-skeleton">
 *   <LoadingSkeleton variant="avatar" />
 *   <LoadingSkeleton variant="title" width="200px" />
 *   <LoadingSkeleton variant="text" width="300px" count={3} />
 * </div>
 * ```
 *
 * @example
 * ```typescript
 * // Form loading
 * <div className="form-skeleton">
 *   <LoadingSkeleton variant="form" count={4} />
 *   <LoadingSkeleton variant="form" width="150px" height="2.5rem" />
 * </div>
 * ```
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'text',
  width,
  height,
  animated = true,
  count = 1,
  className = '',
}) => {
  /**
   * Get default dimensions based on variant
   */
  const getDefaultDimensions = (): { width: string; height: string } => {
    switch (variant) {
      case 'text':
        return { width: '100%', height: '1rem' };
      case 'title':
        return { width: '60%', height: '2rem' };
      case 'avatar':
        return { width: '48px', height: '48px' };
      case 'card':
        return { width: '100%', height: '200px' };
      case 'form':
        return { width: '100%', height: '3rem' };
      default:
        return { width: '100%', height: '1rem' };
    }
  };

  const defaults = getDefaultDimensions();
  const finalWidth = width || defaults.width;
  const finalHeight = height || defaults.height;

  /**
   * Render single skeleton element
   */
  const renderSkeleton = (key: number) => (
    <div
      key={key}
      className={`loading-skeleton loading-skeleton--${variant} ${
        animated ? 'loading-skeleton--animated' : ''
      } ${variant === 'avatar' ? 'loading-skeleton--circle' : ''} ${className}`}
      style={
        {
          '--skeleton-width': finalWidth,
          '--skeleton-height': finalHeight,
        } as CSSProperties
      }
      role="status"
      aria-label="Caricamento in corso..."
    />
  );

  // Render multiple skeletons if count > 1
  if (count > 1) {
    return (
      <div className="loading-skeleton-group">
        {Array.from({ length: count }).map((_, index) => renderSkeleton(index))}
      </div>
    );
  }

  return renderSkeleton(0);
};
