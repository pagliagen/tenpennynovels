/**
 * Ticket Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Handles all ticket-related events:
 * - Ticket creation
 * - Ticket assignment/reassignment
 * - Ticket transfer between departments
 * - Ticket messages
 * - Ticket closure/reopening
 * - Ticket escalation
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../logger';

export class TicketEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return [
      'ticket_created',
      'ticket_assigned',
      'ticket_reassigned',
      'ticket_transferred',
      'ticket_message',
      'ticket_closed',
      'ticket_reopened',
      'ticket_escalated'
    ];
  }

  async handle(event: RedisEvent): Promise<void> {
    // Support both 'type' (from Game Backend) and 'eventType' (from Management Backend)
    const eventType = event.type || event.eventType;

    this.logEventHandling(eventType, event);

    switch (eventType) {
      case 'ticket_created':
        await this.handleTicketCreated(event);
        break;

      case 'ticket_assigned':
        await this.handleTicketAssigned(event);
        break;

      case 'ticket_reassigned':
        await this.handleTicketReassigned(event);
        break;

      case 'ticket_transferred':
        await this.handleTicketTransferred(event);
        break;

      case 'ticket_message':
        await this.handleTicketMessage(event);
        break;

      case 'ticket_closed':
        await this.handleTicketClosed(event);
        break;

      case 'ticket_reopened':
        await this.handleTicketReopened(event);
        break;

      case 'ticket_escalated':
        await this.handleTicketEscalated(event);
        break;

      default:
        logger.debug(`[TicketEventHandler] Unhandled event type: ${eventType}`);
    }
  }

  /**
   * Handle ticket creation
   * Notifies all staff members about new ticket
   */
  private async handleTicketCreated(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_created event:', {
      ticketId: event.ticketId,
      category: event.category,
      department: event.department,
      priority: event.priority
    });

    // Notify all staff members about new ticket
    this.io.to('staff').emit('ticket_created', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      timestamp: event.timestamp
    });

    // Notify specific department staff
    this.io.to(`staff_${event.department}`).emit('ticket_created_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle ticket assignment
   * Notifies character and assigned staff member
   */
  private async handleTicketAssigned(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_assigned event:', {
      ticketId: event.ticketId,
      assignedTo: event.assignedTo?.name
    });

    // Notify character about assignment (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_assigned', {
          ticketId: event.ticketId,
          title: event.title,
          assignedTo: event.assignedTo,
          assignedAt: event.assignedAt,
          timestamp: event.timestamp
        });
      }
    }

    // Notify assigned staff member
    if (event.assignedTo?.id) {
      this.io.to(`user_${event.assignedTo.id}`).emit('ticket_assigned_to_you', {
        ticketId: event.ticketId,
        title: event.title,
        category: event.category,
        categoryLabel: event.categoryLabel,
        priority: event.priority,
        department: event.department,
        createdBy: event.createdBy,
        assignedAt: event.assignedAt,
        timestamp: event.timestamp
      });
    }

    // Notify other staff members about assignment
    this.io.to('staff').emit('ticket_assignment_updated', {
      ticketId: event.ticketId,
      title: event.title,
      assignedTo: event.assignedTo,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle ticket reassignment
   * Notifies character, old staff member, and new staff member
   */
  private async handleTicketReassigned(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_reassigned event:', {
      ticketId: event.ticketId,
      fromStaff: event.reassignment?.fromStaff?.name,
      toStaff: event.reassignment?.toStaff?.name
    });

    // Notify character about reassignment (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_reassigned', {
          ticketId: event.ticketId,
          title: event.title,
          reassignment: event.reassignment,
          timestamp: event.timestamp
        });
      }
    }

    // Notify old staff member
    if (event.reassignment?.fromStaff?.id) {
      this.io.to(`user_${event.reassignment.fromStaff.id}`).emit('ticket_reassigned_from_you', {
        ticketId: event.ticketId,
        title: event.title,
        reassignedTo: event.reassignment.toStaff,
        reason: event.reassignment.reason,
        timestamp: event.timestamp
      });
    }

    // Notify new staff member
    if (event.reassignment?.toStaff?.id) {
      this.io.to(`user_${event.reassignment.toStaff.id}`).emit('ticket_reassigned_to_you', {
        ticketId: event.ticketId,
        title: event.title,
        category: event.category,
        categoryLabel: event.categoryLabel,
        priority: event.priority,
        department: event.department,
        createdBy: event.createdBy,
        reassignedFrom: event.reassignment.fromStaff,
        reason: event.reassignment.reason,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Handle ticket transfer between departments
   * Notifies character and both departments
   */
  private async handleTicketTransferred(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_transferred event:', {
      ticketId: event.ticketId,
      fromDepartment: event.transfer?.fromDepartment,
      toDepartment: event.transfer?.toDepartment
    });

    // Notify character about department transfer (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_transferred', {
          ticketId: event.ticketId,
          title: event.title,
          transfer: event.transfer,
          timestamp: event.timestamp
        });
      }
    }

    // Notify old department staff
    this.io.to(`staff_${event.transfer.fromDepartment}`).emit('ticket_transferred_from_department', {
      ticketId: event.ticketId,
      title: event.title,
      transfer: event.transfer,
      timestamp: event.timestamp
    });

    // Notify new department staff
    this.io.to(`staff_${event.transfer.toDepartment}`).emit('ticket_transferred_to_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      transfer: event.transfer,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle ticket messages
   * Routes messages between character and staff
   */
  private async handleTicketMessage(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_message event:', {
      ticketId: event.ticketId,
      senderType: event.sender?.type,
      senderName: event.sender?.name
    });

    if (event.sender?.type === 'character') {
      // Character sent a message - notify staff
      this.io.to('staff').emit('ticket_message_from_character', {
        ticketId: event.ticketId,
        messageId: event.messageId,
        content: event.content,
        sender: event.sender,
        sentAt: event.sentAt,
        ticketTitle: event.ticketTitle,
        department: event.department,
        timestamp: event.timestamp
      });

      // Specific notification to department
      this.io.to(`staff_${event.department}`).emit('ticket_message_character_department', {
        ticketId: event.ticketId,
        messageId: event.messageId,
        content: event.content,
        sender: event.sender,
        sentAt: event.sentAt,
        ticketTitle: event.ticketTitle,
        department: event.department,
        timestamp: event.timestamp
      });

    } else if (event.sender?.type === 'staff') {
      // Staff sent a message - notify character
      if (event.createdBy?.id) {
        const characterSocket = await this.findCharacterSocket(event.createdBy.id);
        if (characterSocket) {
          characterSocket.emit('ticket_message_from_staff', {
            ticketId: event.ticketId,
            messageId: event.messageId,
            content: event.content,
            sender: event.sender,
            sentAt: event.sentAt,
            ticketTitle: event.ticketTitle,
            isInternal: event.isInternal || false,
            timestamp: event.timestamp
          });
        }
      }

      // Also notify other staff members (for coordination)
      this.io.to('staff').emit('ticket_message_staff_update', {
        ticketId: event.ticketId,
        messageId: event.messageId,
        sender: event.sender,
        sentAt: event.sentAt,
        isInternal: event.isInternal || false,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Handle ticket closure
   * Notifies character and staff
   */
  private async handleTicketClosed(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_closed event:', {
      ticketId: event.ticketId,
      closedBy: event.closedBy?.name
    });

    // Notify character about ticket closure
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_closed', {
          ticketId: event.ticketId,
          title: event.title,
          closedBy: event.closedBy,
          closedAt: event.closedAt,
          finalMessage: event.finalMessage,
          timestamp: event.timestamp
        });
      }
    }

    // Notify staff about ticket closure
    this.io.to('staff').emit('ticket_closed_update', {
      ticketId: event.ticketId,
      title: event.title,
      closedBy: event.closedBy,
      closedAt: event.closedAt,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle ticket reopening
   * Notifies all staff and specific department
   */
  private async handleTicketReopened(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_reopened event:', {
      ticketId: event.ticketId,
      reopenedBy: event.reopenedBy?.name
    });

    // Notify all staff about ticket reopening
    this.io.to('staff').emit('ticket_reopened', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      reopenedBy: event.reopenedBy,
      reason: event.reason,
      timestamp: event.timestamp
    });

    // Notify specific department staff
    this.io.to(`staff_${event.department}`).emit('ticket_reopened_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      reopenedBy: event.reopenedBy,
      reason: event.reason,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle ticket escalation
   * Notifies character, staff, and leadership if high priority
   */
  private async handleTicketEscalated(event: any): Promise<void> {
    logger.info('[TicketEventHandler] Handling ticket_escalated event:', {
      ticketId: event.ticketId,
      escalationLevel: event.escalation?.toLevel,
      reason: event.escalation?.reason
    });

    // Notify character about escalation (if they have socket connection)
    if (event.createdBy?.id) {
      const characterSocket = await this.findCharacterSocket(event.createdBy.id);
      if (characterSocket) {
        characterSocket.emit('ticket_escalated', {
          ticketId: event.ticketId,
          title: event.title,
          escalation: event.escalation,
          timestamp: event.timestamp
        });
      }
    }

    // Notify all staff about escalation with high priority
    this.io.to('staff').emit('ticket_escalated', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      escalation: event.escalation,
      timestamp: event.timestamp
    });

    // Notify specific department staff with extra urgency
    this.io.to(`staff_${event.department}`).emit('ticket_escalated_department', {
      ticketId: event.ticketId,
      title: event.title,
      category: event.category,
      categoryLabel: event.categoryLabel,
      priority: event.priority,
      department: event.department,
      escalation: event.escalation,
      timestamp: event.timestamp
    });

    // Notify leadership/admin about escalated tickets
    if (event.escalation?.toLevel >= 2) {
      this.io.to('staff_leadership').emit('critical_ticket_escalated', {
        ticketId: event.ticketId,
        title: event.title,
        escalation: event.escalation,
        timestamp: event.timestamp
      });
    }
  }
}
