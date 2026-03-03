/**
 * useGamePermission Hook
 *
 * Provides easy access to game permission checking.
 * Wraps authStore permission methods for convenient component use.
 *
 * @module hooks/useGamePermission
 * @since 3.0.0
 */

import { useAuthStore } from '@/store/authStore';

/**
 * Check if current character has a specific game permission
 *
 * @function useGamePermission
 * @param {string} permission - Permission to check (e.g., 'game:chat:send')
 * @returns {boolean} Whether character has permission
 * @since 3.0.0
 *
 * @example
 * ```tsx
 * function ChatBox() {
 *   const canSendChat = useGamePermission('game:chat:send');
 *
 *   return (
 *     <button disabled={!canSendChat}>
 *       {canSendChat ? 'Invia' : 'Non autorizzato'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useGamePermission(permission: string): boolean {
  return useAuthStore((state) => state.hasGamePermission(permission));
}

/**
 * Check multiple game permissions at once
 *
 * Returns an object mapping each permission to its status.
 * Useful when checking multiple permissions for conditional rendering.
 *
 * @function useGamePermissions
 * @param {string[]} permissions - Array of permissions to check
 * @returns {Record<string, boolean>} Object mapping permissions to their status
 * @since 3.0.0
 *
 * @example
 * ```tsx
 * function ActionBar() {
 *   const permissions = useGamePermissions([
 *     'game:chat:send',
 *     'game:postal:send',
 *     'game:items:buy'
 *   ]);
 *
 *   return (
 *     <div>
 *       {permissions['game:chat:send'] && <ChatButton />}
 *       {permissions['game:postal:send'] && <PostalButton />}
 *       {permissions['game:items:buy'] && <ShopButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useGamePermissions(permissions: string[]): Record<string, boolean> {
  return useAuthStore((state) => {
    const result: Record<string, boolean> = {};
    permissions.forEach((permission) => {
      result[permission] = state.hasGamePermission(permission);
    });
    return result;
  });
}

/**
 * Get all game permissions for current character
 *
 * Returns the raw permissions array.
 * Useful for debugging or displaying permission list.
 *
 * @function useAllGamePermissions
 * @returns {string[]} Array of all permissions
 * @since 3.0.0
 *
 * @example
 * ```tsx
 * function PermissionsDebugPanel() {
 *   const permissions = useAllGamePermissions();
 *
 *   return (
 *     <div>
 *       <h3>Current Permissions ({permissions.length})</h3>
 *       <ul>
 *         {permissions.map(p => <li key={p}>{p}</li>)}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAllGamePermissions(): string[] {
  return useAuthStore((state) => state.gamePermissions);
}
