/**
 * Socket.IO Singleton Instance
 *
 * Provides global access to the Socket.IO server instance.
 * Avoids race conditions with req.app.get('io').
 *
 * @module websocket/socketInstance
 * @since 2.0.0
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';

/**
 * Singleton Socket.IO instance
 */
let io: SocketIOServer | null = null;

/**
 * Set Socket.IO instance (called once during server initialization)
 */
export function setSocketIO(instance: SocketIOServer): void {
  if (io) {
    logger.warn('[CRITICAL] Socket.IO instance already set, overwriting...');
  }
  io = instance;
  logger.info('[CRITICAL] Socket.IO instance registered in singleton');
  logger.info('[CRITICAL] Socket.IO instance status:', io ? 'AVAILABLE' : 'NULL');
}

/**
 * Get Socket.IO instance
 *
 * @returns Socket.IO instance or null if not initialized yet
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Check if Socket.IO is initialized
 */
export function isSocketIOReady(): boolean {
  return io !== null;
}
