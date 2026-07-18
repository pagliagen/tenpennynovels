/**
 * WebSocket Client Singleton
 *
 * Provides access to WebSocket emit functionality outside of React components.
 * Designed for use in Zustand stores where hooks cannot be called.
 *
 * Architecture:
 * - WebSocketContext manages connection lifecycle
 * - WebSocketContext registers socket instance here on connect
 * - Stores/utilities emit events via this singleton
 *
 * @module lib/websocket/client
 * @since 3.0.0
 */

import type { Socket } from 'socket.io-client';
import { logger } from '@/lib/logger';

/**
 * WebSocket Client Singleton Class
 *
 * Maintains reference to active Socket.IO instance.
 * Provides type-safe emit methods for common events.
 */
class WebSocketClient {
  private socket: Socket | null = null;

  /**
   * Register socket instance
   *
   * Called by WebSocketContext when socket connects.
   * Automatically cleared on disconnect.
   *
   * @param {Socket | null} socket - Socket.IO instance
   * @returns {void}
   */
  setSocket(socket: Socket | null): void {
    this.socket = socket;
    if (socket) {
      logger.info('[WebSocketClient] Socket registered');
    } else {
      logger.info('[WebSocketClient] Socket cleared');
    }
  }

  /**
   * Generic emit method
   *
   * Emits any event with data. Falls back gracefully if not connected.
   *
   * @param {string} event - Event name
   * @param {any} data - Event data
   * @returns {void}
   */
  emit(event: string, data?: any): void {
    if (!this.socket || !this.socket.connected) {
      logger.warn(`[WebSocketClient] Cannot emit '${event}' - socket not connected`);
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Join location room
   *
   * Notifies backend to add character to location's Socket.IO room.
   * Required for receiving location-scoped events (chat, presence).
   *
   * @param {string} locationId - Location MongoDB ObjectId
   * @returns {void}
   */
  joinLocation(locationId: string): void {
    logger.info('[WebSocketClient] Joining location:', { locationId });
    this.emit('join_location', locationId);
  }

  /**
   * Leave location room
   *
   * Notifies backend to remove character from location's Socket.IO room.
   * Stops receiving location-scoped events.
   *
   * @param {string} locationId - Location MongoDB ObjectId
   * @returns {void}
   */
  leaveLocation(locationId: string): void {
    logger.info('[WebSocketClient] Leaving location:', { locationId });
    this.emit('leave_location', locationId);
  }

  /**
   * Check if socket is connected
   *
   * @returns {boolean} Whether socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

/**
 * WebSocket Client Singleton Instance
 *
 * Import this in stores/utilities to emit events.
 *
 * @example
 * ```typescript
 * import { wsClient } from '@/lib/websocket/client';
 *
 * // In Zustand store action
 * enterLocation: async (locationId) => {
 *   await locationsApi.enter(locationId); // DB update
 *   wsClient.joinLocation(locationId);     // WebSocket room
 * }
 * ```
 */
export const wsClient = new WebSocketClient();
