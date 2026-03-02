/**
 * ClientOnly Component
 *
 * Wrapper component that prevents rendering during Server-Side Rendering (SSR).
 * Only renders children on the client side after hydration.
 *
 * **Use Cases**:
 * - Components that use browser-only APIs (window, localStorage, etc.)
 * - Components with client-side animations
 * - Third-party libraries that break SSR
 * - Hydration mismatch prevention
 *
 * **How it works**:
 * 1. During SSR: Renders fallback (or nothing)
 * 2. After mount: Renders children
 *
 * @module components/ClientOnly
 */

import React, { useState, useEffect } from 'react';

/**
 * ClientOnly component props
 *
 * @interface ClientOnlyProps
 */
export interface ClientOnlyProps {
  /** Content to render on client side only */
  children: React.ReactNode;
  /** Optional fallback content to show during SSR/initial load */
  fallback?: React.ReactNode;
}

/**
 * ClientOnly Component
 *
 * Prevents rendering of children until component has mounted on the client.
 * Useful for SSR-incompatible code or preventing hydration mismatches.
 *
 * **Benefits**:
 * - **SSR Safe**: Prevents server/client rendering mismatches
 * - **Hydration Fix**: Avoids "Text content does not match" errors
 * - **Browser API Safe**: Allows use of window, document, localStorage
 * - **Loading State**: Optional fallback during initial load
 *
 * **Performance Note**:
 * Children are not rendered during SSR, so they don't benefit from
 * server-side rendering. Use only when necessary.
 *
 * @param {ClientOnlyProps} props - Component props
 * @returns {JSX.Element} Children (client-side) or fallback (SSR)
 *
 * @example
 * ```typescript
 * import { ClientOnly } from '@/components/ClientOnly';
 *
 * // Component that uses window API
 * function MyComponent() {
 *   return (
 *     <ClientOnly>
 *       <div>Window width: {window.innerWidth}px</div>
 *     </ClientOnly>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With loading fallback
 * <ClientOnly fallback={<div>Loading...</div>}>
 *   <HeavyClientComponent />
 * </ClientOnly>
 * ```
 *
 * @example
 * ```typescript
 * // Cookie banner (only show client-side)
 * <ClientOnly>
 *   <CookieBanner />
 * </ClientOnly>
 * ```
 *
 * @example
 * ```typescript
 * // Victorian masks (client-side DOM manipulation)
 * <ClientOnly fallback={<input type="text" />}>
 *   <MaskedInput value={value} maskType="text" />
 * </ClientOnly>
 * ```
 */
export const ClientOnly: React.FC<ClientOnlyProps> = ({
  children,
  fallback = null,
}) => {
  const [hasMounted, setHasMounted] = useState<boolean>(false);

  /**
   * Set mounted flag after first render (client-side only)
   *
   * This effect runs only on the client, never during SSR.
   */
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // During SSR or before mount: show fallback
  if (!hasMounted) {
    return <>{fallback}</>;
  }

  // After mount (client-side): show children
  return <>{children}</>;
};
