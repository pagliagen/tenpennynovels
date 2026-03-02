import mongoose from 'mongoose';
import { TicketNotification, ITicketNotification } from '@database/models/TicketNotification';
import { Ticket } from '@database/models/Ticket';

/**
 * NotificationService
 * Centralized service per gestione notifiche multi-canale
 *
 * Supporta:
 * - In-app notifications (DB storage con TTL)
 * - WebSocket broadcast (real-time)
 * - Recipients: character, staff (userId), role broadcast (tutti i master, admin, ecc.)
 *
 * Pattern:
 * 1. Save to DB (TicketNotification model)
 * 2. Emit WebSocket event (se channel includes 'websocket')
 * 3. Update unread counters (cached in-memory o Redis)
 */

export interface Notification {
  recipientType: 'character' | 'user' | 'staff' | 'role';
  recipientId?: mongoose.Types.ObjectId | string;    // Per character/user/staff specifico
  recipientRole?: string;                            // Per broadcast a role ('master', 'moderatore', 'amministratore')
  namespace: string;                                 // 'ticket', 'forum', 'game', 'character'
  type: string;                                      // 'ticket:new', 'ticket:replied', 'ticket:escalated'
  title: string;
  message: string;
  data: any;                                         // Payload custom (ticketId, priority, ecc.)
  channels: ('in_app' | 'websocket')[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  expiresAt?: Date;
  actionUrl?: string;                                // Deep link (es: /admin/tickets/123)
}

export class NotificationService {
  /**
   * WebSocket server instance (singleton)
   * Inizializzato dinamicamente dal server
   */
  private static io: any = null;

  /**
   * Initialize WebSocket server instance
   * Chiamato da server.ts dopo che Socket.IO è pronto
   */
  static initialize(socketIOInstance: any): void {
    NotificationService.io = socketIOInstance;
    console.log('[NotificationService] WebSocket instance initialized');
  }

  /**
   * Core method: Send notification
   * @param notification Notification object
   */
  static async send(notification: Notification): Promise<void> {
    try {
      // 1. Save to DB (in-app channel)
      if (notification.channels.includes('in_app')) {
        await NotificationService.saveToDatabase(notification);
      }

      // 2. Emit WebSocket event (real-time channel)
      if (notification.channels.includes('websocket')) {
        await NotificationService.emitWebSocket(notification);
      }
    } catch (error) {
      console.error('[NotificationService] Failed to send notification:', error);
      // Don't throw - notifications are best-effort, not critical
    }
  }

  /**
   * Save notification to database (TicketNotification model)
   * @private
   */
  private static async saveToDatabase(notification: Notification): Promise<void> {
    // Only ticket namespace supported for now (extendable to forum, game)
    if (notification.namespace !== 'ticket') {
      console.warn(`[NotificationService] Namespace "${notification.namespace}" not yet implemented for DB storage`);
      return;
    }

    // Extract ticket info from data payload
    const { ticketId, ticketNumber, ticketPriority, ticketCategory } = notification.data || {};

    if (!ticketId) {
      console.error('[NotificationService] ticketId missing in data payload for ticket notification');
      return;
    }

    // Convert recipientId to ObjectId if string
    let recipientIdObj: mongoose.Types.ObjectId | undefined;
    if (notification.recipientId) {
      recipientIdObj = typeof notification.recipientId === 'string'
        ? new mongoose.Types.ObjectId(notification.recipientId)
        : notification.recipientId;
    }

    // Convert ticketId to ObjectId if string
    const ticketIdObj = typeof ticketId === 'string'
      ? new mongoose.Types.ObjectId(ticketId)
      : ticketId;

    // Map recipientType (normalize 'user' → 'staff')
    const mappedRecipientType = notification.recipientType === 'user'
      ? 'staff'
      : notification.recipientType;

    // Create notification document
    const notificationDoc: Partial<ITicketNotification> = {
      recipientType: mappedRecipientType as any,
      recipientId: recipientIdObj,
      recipientRole: notification.recipientRole,
      type: notification.type as any,
      title: notification.title,
      message: notification.message,
      ticketId: ticketIdObj,
      ticketNumber,
      ticketPriority,
      ticketCategory,
      triggeredBy: notification.data?.triggeredBy,
      isRead: false,
      createdAt: new Date(),
      actionUrl: notification.actionUrl || `/game/tickets/${ticketId}`
    };

    await TicketNotification.create(notificationDoc);
  }

  /**
   * Emit WebSocket event
   * @private
   */
  private static async emitWebSocket(notification: Notification): Promise<void> {
    if (!NotificationService.io) {
      console.warn('[NotificationService] WebSocket not initialized, skipping WebSocket emit');
      return;
    }

    // Determine target room
    let room: string;

    if (notification.recipientType === 'role') {
      // Broadcast a tutti con quel ruolo
      room = 'staff';  // Simplified: broadcast to all staff room
      // TODO: Future enhancement - separate rooms per role (staff_master, staff_moderatore, ecc.)
    } else if (notification.recipientType === 'character') {
      room = `user_${notification.recipientId}`;
    } else {
      // 'staff' or 'user'
      room = `staff_${notification.recipientId}`;
    }

    // Emit event
    const eventName = `notification:${notification.namespace}`;
    const payload = {
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      timestamp: new Date().toISOString()
    };

    NotificationService.io.to(room).emit(eventName, payload);
  }

  // ============ CONVENIENCE METHODS PER TICKET ============

  /**
   * Notify: New ticket created (to staff)
   */
  static async notifyNewTicket(ticket: any): Promise<void> {
    await NotificationService.send({
      recipientType: 'role',
      recipientRole: 'amministratore',  // Notify all admins (or department-specific staff)
      namespace: 'ticket',
      type: 'ticket:new',
      title: `New Ticket #${ticket.ticketNumber}`,
      message: `Category: ${ticket.category} | Priority: ${ticket.priority}`,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ticketPriority: ticket.priority,
        ticketCategory: ticket.category,
        triggeredBy: {
          type: 'character',
          id: ticket.createdBy.characterId,
          name: ticket.createdBy.characterName
        }
      },
      channels: ['in_app', 'websocket'],
      priority: ticket.priority === 'critical' ? 'urgent' : 'normal',
      actionUrl: `/admin/tickets/${ticket._id}`
    });
  }

  /**
   * Notify: Ticket replied (to character or staff)
   */
  static async notifyTicketReplied(ticket: any, message: any): Promise<void> {
    // Determine recipient (se message da staff → notify character, viceversa)
    const isStaffReply = message.sender.type === 'staff';

    if (isStaffReply) {
      // Notify character owner
      await NotificationService.send({
        recipientType: 'character',
        recipientId: ticket.createdBy.characterId,
        namespace: 'ticket',
        type: 'ticket:replied',
        title: `Reply on Ticket #${ticket.ticketNumber}`,
        message: message.isInternal
          ? 'Staff added internal note'
          : `${message.sender.name}: ${message.content.substring(0, 100)}...`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          ticketPriority: ticket.priority,
          triggeredBy: {
            type: 'staff',
            id: message.sender.id,
            name: message.sender.name
          }
        },
        channels: message.isInternal ? ['in_app'] : ['in_app', 'websocket'],  // No WebSocket for internal notes
        priority: 'normal',
        actionUrl: `/game/tickets/${ticket._id}`
      });
    } else {
      // Notify assigned staff (se ticket è assegnato)
      if (ticket.assignedTo) {
        await NotificationService.send({
          recipientType: 'staff',
          recipientId: ticket.assignedTo,
          namespace: 'ticket',
          type: 'ticket:replied',
          title: `Character replied to Ticket #${ticket.ticketNumber}`,
          message: `${message.sender.name}: ${message.content.substring(0, 100)}...`,
          data: {
            ticketId: ticket._id,
            ticketNumber: ticket.ticketNumber,
            ticketPriority: ticket.priority,
            triggeredBy: {
              type: 'character',
              id: message.sender.id,
              name: message.sender.name
            }
          },
          channels: ['in_app', 'websocket'],
          priority: ticket.priority === 'critical' ? 'high' : 'normal',
          actionUrl: `/admin/tickets/${ticket._id}`
        });
      }
    }
  }

  /**
   * Notify: Ticket assigned (to character and assigned staff)
   */
  static async notifyTicketAssigned(ticket: any, assignedStaff: any): Promise<void> {
    // Notify character owner
    await NotificationService.send({
      recipientType: 'character',
      recipientId: ticket.createdBy.characterId,
      namespace: 'ticket',
      type: 'ticket:assigned',
      title: `Ticket #${ticket.ticketNumber} Assigned`,
      message: `Your ticket has been assigned to ${assignedStaff.username}`,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ticketPriority: ticket.priority,
        assignedTo: {
          id: assignedStaff.userId || assignedStaff._id,
          name: assignedStaff.username
        }
      },
      channels: ['in_app', 'websocket'],
      priority: 'normal',
      actionUrl: `/game/tickets/${ticket._id}`
    });

    // Notify assigned staff
    await NotificationService.send({
      recipientType: 'staff',
      recipientId: assignedStaff.userId || assignedStaff._id,
      namespace: 'ticket',
      type: 'ticket:assigned',
      title: `Ticket #${ticket.ticketNumber} Assigned to You`,
      message: `Category: ${ticket.category} | Priority: ${ticket.priority}`,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ticketPriority: ticket.priority,
        ticketCategory: ticket.category
      },
      channels: ['in_app', 'websocket'],
      priority: ticket.priority === 'critical' ? 'urgent' : 'normal',
      actionUrl: `/admin/tickets/${ticket._id}`
    });
  }

  /**
   * Notify: Ticket escalated (to character)
   */
  static async notifyTicketEscalated(ticket: any, newLevel: number): Promise<void> {
    await NotificationService.send({
      recipientType: 'character',
      recipientId: ticket.createdBy.characterId,
      namespace: 'ticket',
      type: 'ticket:escalated',
      title: `Ticket #${ticket.ticketNumber} Escalated`,
      message: `Your ticket has been escalated to level ${newLevel} for faster resolution`,
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ticketPriority: ticket.priority,
        escalationLevel: newLevel
      },
      channels: ['in_app', 'websocket'],
      priority: newLevel >= 5 ? 'high' : 'normal',
      actionUrl: `/game/tickets/${ticket._id}`
    });
  }

  /**
   * Notify: Ticket closed (to character)
   */
  static async notifyTicketClosed(ticket: any): Promise<void> {
    await NotificationService.send({
      recipientType: 'character',
      recipientId: ticket.createdBy.characterId,
      namespace: 'ticket',
      type: 'ticket:closed',
      title: `Ticket #${ticket.ticketNumber} Closed`,
      message: 'Your ticket has been resolved and closed',
      data: {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        ticketPriority: ticket.priority
      },
      channels: ['in_app', 'websocket'],
      priority: 'low',
      actionUrl: `/game/tickets/${ticket._id}`
    });
  }

  /**
   * Notify: Ticket reopened (to staff)
   */
  static async notifyTicketReopened(ticket: any): Promise<void> {
    // Notify assigned staff (se esiste) o broadcast a department
    if (ticket.assignedTo) {
      await NotificationService.send({
        recipientType: 'staff',
        recipientId: ticket.assignedTo,
        namespace: 'ticket',
        type: 'ticket:reopened',
        title: `Ticket #${ticket.ticketNumber} Reopened`,
        message: `Character has reopened their ticket`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          ticketPriority: ticket.priority
        },
        channels: ['in_app', 'websocket'],
        priority: 'normal',
        actionUrl: `/admin/tickets/${ticket._id}`
      });
    } else {
      // Broadcast a staff role (department-specific in future)
      await NotificationService.send({
        recipientType: 'role',
        recipientRole: 'amministratore',
        namespace: 'ticket',
        type: 'ticket:reopened',
        title: `Ticket #${ticket.ticketNumber} Reopened`,
        message: `A closed ticket has been reopened`,
        data: {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          ticketPriority: ticket.priority
        },
        channels: ['in_app', 'websocket'],
        priority: 'normal',
        actionUrl: `/admin/tickets/${ticket._id}`
      });
    }
  }
}
