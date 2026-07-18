/**
 * Ticket Notifications Hook
 *
 * Subscribes to WebSocket ticket events and invalidates queries
 *
 * @module hooks/useTicketNotifications
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { logger } from '@/lib/logger';

/**
 * Hook to handle real-time ticket notifications
 *
 * Subscribes to WebSocket ticket events and invalidates TanStack Query caches
 * to keep ticket data fresh.
 *
 * @returns {void}
 */
export function useTicketNotifications() {
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      // Filter ticket events
      if (!event.type.startsWith('ticket:')) {
        return;
      }

      switch (event.type) {
        case 'ticket:staff_replied':
          logger.info(`[Ticket] Ticket ${event.data.ticketId} aggiornato: nuova risposta staff`, { data: event.data });

          // Invalidate ticket list
          queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
          queryClient.invalidateQueries({ queryKey: ['tickets', 'unreadCount'] });

          // Invalidate specific ticket messages if currently viewing
          if (event.data.ticketId) {
            queryClient.invalidateQueries({
              queryKey: ['tickets', event.data.ticketId, 'messages']
            });
          }
          break;

        case 'ticket:status_changed':
          logger.info(`[Ticket] Ticket ${event.data.ticketId} aggiornato: status → ${event.data.newStatus}`, { data: event.data });

          // Invalidate ticket list to show updated status
          queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });

          // Invalidate specific ticket if ID provided
          if (event.data.ticketId) {
            queryClient.invalidateQueries({
              queryKey: ['tickets', event.data.ticketId]
            });
          }
          break;

        case 'ticket:closed':
          logger.info(`[Ticket] Ticket ${event.data.ticketId} aggiornato: CHIUSO`, { data: event.data });

          // Invalidate all ticket queries
          queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
          queryClient.invalidateQueries({ queryKey: ['tickets', 'unreadCount'] });

          if (event.data.ticketId) {
            queryClient.invalidateQueries({
              queryKey: ['tickets', event.data.ticketId]
            });
          }
          break;

        default:
          logger.info(`[Ticket] Evento ticket sconosciuto: ${event.type}`, { data: event.data });

          // Unknown ticket event - invalidate list as fallback
          queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] });
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, [onMessageEvent, queryClient]);
}
