import { Request, Response } from 'express';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';
import { Ticket, TicketMessage, Character, SystemConfiguration } from '@database/models';
import { ApiResponse, TicketCategory, TicketPriority, TicketDepartment, TICKET_CATEGORIES, CATEGORY_DEPARTMENT_MAPPING, CATEGORY_PRIORITY_MAPPING } from '@modules/game/types/game';
import { logger } from '@modules/game/logger';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { redis } from '@config/runtime/redis';
import { NotificationService } from '@shared/services/NotificationService';

/**
 * Helper: Schedule auto-close for ticket categories with autoClose enabled
 * @param ticketId Ticket ID to auto-close
 * @param categoryConfig Category configuration from SystemConfiguration
 */
async function scheduleAutoClose(ticketId: string, categoryConfig: any): Promise<void> {
  const { autoClose, autoCloseMessage, autoCloseDelaySeconds } = categoryConfig;

  // Check autoClose is enabled and has required fields (allow 0 as valid delay)
  if (!autoClose || !autoCloseMessage || autoCloseDelaySeconds == null) {
    return; // Auto-close not configured
  }

  // Wait for configured delay
  await new Promise(resolve => setTimeout(resolve, autoCloseDelaySeconds * 1000));

  try {
    // Fetch ticket to ensure it still exists and is not already closed
    const ticket = await Ticket.findById(ticketId);
    if (!ticket || ticket.status === 'closed') {
      logger.info('Auto-close skipped: ticket already closed or not found', { ticketId });
      return;
    }

    // Create auto-close message (from system/staff)
    const autoMessage = new TicketMessage({
      ticketId: ticket._id,
      content: autoCloseMessage,
      sender: {
        type: 'staff',
        id: ticket.createdBy, // Use character ID as placeholder (system message)
        name: 'Sistema'
      },
      isInternal: false, // Visible to character
      readAt: {} // Not read yet
    });

    await autoMessage.save();

    // Close ticket atomically
    const closedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      {
        status: 'closed',
        closedAt: new Date(),
        closedBy: null, // System auto-close (no staff involved)
        lastActivityAt: new Date()
      },
      { new: true }
    );

    if (!closedTicket) {
      logger.warn('Auto-close failed: ticket not found after message creation', { ticketId });
      return;
    }

    logger.info('Ticket auto-closed successfully', {
      ticketId,
      category: closedTicket.category,
      autoCloseDelaySeconds
    });

    // Publish Redis event for WebSocket broadcast
    const redisPublisher = redis.getPublisher();
    await redisPublisher.publish('ticket:events', JSON.stringify({
      type: 'ticket_closed',
      ticketId: closedTicket._id.toString(),
      category: closedTicket.category,
      closedBy: 'system',
      closedAt: closedTicket.closedAt,
      autoClose: true,
      timestamp: new Date().toISOString(),
      source: 'auto-close-scheduler'
    }));

  } catch (error) {
    logger.error('Auto-close error:', {
      ticketId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export class TicketController {
  /**
   * GET /game/tickets
   * Lista ticket del personaggio corrente
   */
  static async getUserTickets(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { status, limit = '20', page = '1' } = req.query;

      logger.info('Fetching user tickets', {
        characterId,
        status,
        limit: Number(limit),
        currentPage: Number(page)
      });

      // Build query filters
      const filters: any = { createdBy: characterId };
      if (status && typeof status === 'string') {
        filters.status = status;
      }

      // Pagination
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(50, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Get tickets with pagination
      const tickets = await Ticket.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Get total count for pagination
      const totalCount = await Ticket.countDocuments(filters);

      // Get unread message counts for each ticket
      const ticketIds = tickets.map(t => t._id);
      const unreadCounts = await TicketMessage.aggregate([
        {
          $match: {
            ticketId: { $in: ticketIds },
            isInternal: false, // Characters can't see internal messages
            'sender.type': 'staff', // Only staff messages count as unread for character
            'readAt.character': { $exists: false }
          }
        },
        {
          $group: {
            _id: '$ticketId',
            unreadCount: { $sum: 1 }
          }
        }
      ]);

      const unreadMap = new Map(
        unreadCounts.map(item => [item._id.toString(), item.unreadCount])
      );

      // Format response
      const formattedTickets = tickets.map(ticket => ({
        id: ticket._id.toString(),
        title: ticket.title,
        category: ticket.category,
        categoryLabel: TICKET_CATEGORIES[ticket.category as TicketCategory] || ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        department: ticket.department,
        createdAt: ticket.createdAt,
        lastReadBy: ticket.lastReadBy,
        unreadMessages: unreadMap.get(ticket._id.toString()) || 0,
        assignedTo: ticket.assignedTo ? {
          id: ticket.assignedTo.toString(),
          name: ticket.assignedToName
        } : null,
        escalationLevel: ticket.escalationLevel || 0
      }));

      res.json(listResponse(
        formattedTickets,
        {
          currentPage: pageNum,
          pageSize: limitNum,
        totalItems: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasNextPage: skip + tickets.length < totalCount,
          hasPreviousPage: pageNum > 1
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching user tickets:', {
        error: err.message,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i ticket',
        'FETCH_TICKETS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/tickets
   * Crea nuovo ticket (solo personaggi APPROVED)
   */
  static async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const { title, category, content } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      logger.info('Creating new ticket', {
        characterId,
        characterName,
        title,
        category
      });

      // Validazione input
      if (!title || !category || !content) {
        res.status(400).json(errorResponse(
          'Titolo, categoria e contenuto sono obbligatori',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Verifica che la categoria sia valida
      if (!Object.values(TicketCategory).includes(category)) {
        res.status(400).json(errorResponse(
          'Categoria ticket non valida',
          'INVALID_CATEGORY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Tutti i personaggi possono creare ticket (anche DRAFT/PENDING per supporto approvazione)
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Crea il ticket con routing automatico categoria→dipartimento e priorità
      const department = CATEGORY_DEPARTMENT_MAPPING[category as TicketCategory] || TicketDepartment.GENERAL;
      const priority = CATEGORY_PRIORITY_MAPPING[category as TicketCategory] || TicketPriority.LOW;

      const ticket = new Ticket({
        title: title.trim(),
        category,
        priority, // Sarà impostato automaticamente dal pre-save middleware
        department, // Sarà impostato automaticamente dal pre-save middleware
        status: 'open',
        createdBy: characterId,
        createdByName: characterName,
        lastReadBy: {
          character: new Date() // Il creatore ha "letto" il suo ticket
        }
      });

      await ticket.save();

      // Crea il primo messaggio del ticket
      const firstMessage = new TicketMessage({
        ticketId: ticket._id,
        content: content.trim(),
        sender: {
          type: 'character',
          id: characterId,
          name: characterName
        },
        isInternal: false
      });

      await firstMessage.save();

      logger.info('Ticket created successfully', {
        ticketId: ticket._id.toString(),
        characterId,
        category,
        department: ticket.department,
        priority: ticket.priority
      });

      // Pubblica evento Redis per notificare lo staff
      const redisPublisher = redis.getPublisher();
      await redisPublisher.publish('ticket:events', JSON.stringify({
        type: 'ticket_created',
        ticketId: ticket._id.toString(),
        title: ticket.title,
        category: ticket.category,
        categoryLabel: TICKET_CATEGORIES[ticket.category as TicketCategory],
        priority: ticket.priority,
        department: ticket.department,
        createdBy: {
          id: characterId,
          name: characterName
        },
        createdAt: ticket.createdAt,
        timestamp: new Date().toISOString(),
        source: 'game-backend'
      }));

      // Send notification to staff via NotificationService
      try {
        await NotificationService.notifyNewTicket({
          _id: ticket._id,
          ticketNumber: ticket._id.toString().slice(-6).toUpperCase(),
          category: ticket.category,
          priority: ticket.priority,
          department: ticket.department,
          createdBy: {
            characterId,
            characterName
          }
        });
      } catch (notifyError) {
        logger.error('Failed to send new ticket notification:', notifyError);
        // Non blocca la risposta - notifica è best-effort
      }

      res.status(201).json(createResponse(
        {
          ticket: {
            id: ticket._id.toString(),
            title: ticket.title,
            category: ticket.category,
            categoryLabel: TICKET_CATEGORIES[ticket.category as TicketCategory],
            priority: ticket.priority,
            status: ticket.status,
            department: ticket.department,
            createdAt: ticket.createdAt,
            unreadMessages: 0
          }
        },
        'Ticket creato con successo',
        getRequestId(req)
      ));

      // Check for auto-close configuration (fire-and-forget, doesn't block response)
      setImmediate(async () => {
        try {
          const categoryConfigKey = `ticket_category_${category}`;
          const categoryConfigDoc = await SystemConfiguration.findOne({
            configKey: categoryConfigKey,
            configSection: 'ticket_system',
            isActive: true
          });

          if (categoryConfigDoc && categoryConfigDoc.value?.autoClose) {
            logger.info('Scheduling auto-close for ticket', {
              ticketId: ticket._id.toString(),
              category,
              autoCloseDelaySeconds: categoryConfigDoc.value.autoCloseDelaySeconds
            });

            await scheduleAutoClose(ticket._id.toString(), categoryConfigDoc.value);
          }
        } catch (autoCloseError) {
          logger.error('Auto-close scheduling error:', {
            ticketId: ticket._id.toString(),
            error: autoCloseError instanceof Error ? autoCloseError.message : String(autoCloseError)
          });
          // Don't fail ticket creation if auto-close setup fails
        }
      });

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error creating ticket:', {
        error: err.message,
        characterId: req.character?.characterId,
        body: req.body,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile creare il ticket',
        'CREATE_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/tickets/:id
   * Dettagli singolo ticket (solo proprietario)
   */
  static async getTicketDetails(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const characterId = req.character!.characterId;

      logger.info('Fetching ticket details', {
        ticketId: id,
        characterId
      });

      // Trova il ticket e verifica ownership
      const ticket = await Ticket.findOne({
        _id: id,
        createdBy: characterId
      }).lean();

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket non trovato',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Aggiorna il lastReadBy per il personaggio (atomic update)
      await Ticket.findByIdAndUpdate(id, {
        'lastReadBy.character': new Date()
      });

      // Format ticket details
      const ticketDetails = {
        id: ticket._id.toString(),
        title: ticket.title,
        category: ticket.category,
        categoryLabel: TICKET_CATEGORIES[ticket.category as TicketCategory] || ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        department: ticket.department,
        createdAt: ticket.createdAt,
        lastReadBy: ticket.lastReadBy,
        assignedTo: ticket.assignedTo ? {
          id: ticket.assignedTo.toString(),
          name: ticket.assignedToName
        } : null,
        closedAt: ticket.closedAt,
        escalationLevel: ticket.escalationLevel || 0
      };

      res.json(successResponse(
        {
          ticket: ticketDetails
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching ticket details:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli del ticket',
        'FETCH_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PUT /game/tickets/:id/reopen
   * Riapri ticket chiuso (solo proprietario)
   */
  static async reopenTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      logger.info('Reopening ticket', {
        ticketId: id,
        characterId,
        reason
      });

      // Usa findOneAndUpdate atomico per evitare race conditions
      const ticket = await Ticket.findOneAndUpdate(
        {
          _id: id,
          createdBy: characterId,
          status: 'closed'
        },
        {
          status: 'reopened',
          'lastReadBy.character': new Date(),
          // Rimuove closedAt e closedBy quando riaperto
          $unset: { closedAt: '', closedBy: '' }
        },
        {
          returnDocument: 'after'
        }
      );

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket non trovato o non può essere riaperto',
          'TICKET_NOT_REOPENABLE',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Aggiungi messaggio di sistema per la riapertura
      if (reason && reason.trim()) {
        const reopenMessage = new TicketMessage({
          ticketId: ticket._id,
          content: `Ticket riaperto dal personaggio.\n\nMotivo: ${reason.trim()}`,
          sender: {
            type: 'character',
            id: characterId,
            name: characterName
          },
          isInternal: false
        });

        await reopenMessage.save();
      }

      logger.info('Ticket reopened successfully', {
        ticketId: ticket._id.toString(),
        characterId
      });

      // Pubblica evento Redis
      const redisPublisher = redis.getPublisher();
      await redisPublisher.publish('ticket:events', JSON.stringify({
        type: 'ticket_reopened',
        ticketId: ticket._id.toString(),
        title: ticket.title,
        category: ticket.category,
        categoryLabel: TICKET_CATEGORIES[ticket.category as TicketCategory],
        priority: ticket.priority,
        department: ticket.department,
        reopenedBy: {
          id: characterId,
          name: characterName
        },
        reason: reason?.trim() || null,
        timestamp: new Date(),
        source: 'game-backend'
      }));

      // Send notification to staff via NotificationService
      try {
        await NotificationService.notifyTicketReopened({
          _id: ticket._id,
          ticketNumber: ticket._id.toString().slice(-6).toUpperCase(),
          category: ticket.category,
          priority: ticket.priority,
          department: ticket.department,
          assignedTo: ticket.assignedTo,
          createdBy: {
            characterId,
            characterName
          }
        });
      } catch (notifyError) {
        logger.error('Failed to send ticket reopened notification:', notifyError);
        // Non blocca la risposta - notifica è best-effort
      }

      res.json(updateResponse(
        {
          ticket: {
            id: ticket._id.toString(),
            status: ticket.status
          }
        },
        'Ticket riaperto con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error reopening ticket:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile riaprire il ticket',
        'REOPEN_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PUT /game/tickets/:id/close
   * Chiudi ticket (solo proprietario, solo se non già chiuso)
   */
  static async closeTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      logger.info('Closing ticket (player-side)', {
        ticketId: id,
        characterId,
        reason
      });

      // Usa findOneAndUpdate atomico per evitare race conditions
      const ticket = await Ticket.findOneAndUpdate(
        {
          _id: id,
          createdBy: characterId,
          status: { $ne: 'closed' } // Non già chiuso
        },
        {
          status: 'closed',
          closedAt: new Date(),
          closedBy: characterId, // Character che chiude
          lastActivityAt: new Date()
        },
        {
          returnDocument: 'after'
        }
      );

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket non trovato o già chiuso',
          'TICKET_NOT_CLOSEABLE',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Aggiungi messaggio opzionale per la chiusura
      if (reason && reason.trim()) {
        const closeMessage = new TicketMessage({
          ticketId: ticket._id,
          content: `Ticket chiuso dal personaggio.\n\nMotivo: ${reason.trim()}`,
          sender: {
            type: 'character',
            id: characterId,
            name: characterName
          },
          isInternal: false
        });

        await closeMessage.save();
      }

      logger.info('Ticket closed successfully (player-side)', {
        ticketId: ticket._id.toString(),
        characterId
      });

      // Pubblica evento Redis
      const redisPublisher = redis.getPublisher();
      await redisPublisher.publish('ticket:events', JSON.stringify({
        type: 'ticket_closed',
        ticketId: ticket._id.toString(),
        title: ticket.title,
        category: ticket.category,
        categoryLabel: TICKET_CATEGORIES[ticket.category as TicketCategory],
        priority: ticket.priority,
        department: ticket.department,
        closedBy: {
          type: 'character',
          id: characterId,
          name: characterName
        },
        reason: reason?.trim() || null,
        timestamp: new Date(),
        source: 'game-backend'
      }));

      // Notifica staff (opzionale, solo se assigned)
      if (ticket.assignedTo) {
        try {
          await NotificationService.notifyTicketClosed({
            _id: ticket._id,
            ticketNumber: ticket._id.toString().slice(-6).toUpperCase(),
            category: ticket.category,
            priority: ticket.priority,
            department: ticket.department,
            assignedTo: ticket.assignedTo,
            createdBy: {
              characterId,
              characterName
            }
          });
        } catch (notifyError) {
          logger.error('Failed to send ticket closed notification:', notifyError);
          // Non blocca la risposta - notifica è best-effort
        }
      }

      res.json(updateResponse(
        {
          ticket: {
            id: ticket._id.toString(),
            status: ticket.status,
            closedAt: ticket.closedAt
          }
        },
        'Ticket chiuso con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error closing ticket:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile chiudere il ticket',
        'CLOSE_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/tickets/:id/messages
   * Aggiungi messaggio a ticket esistente
   */
  static async addTicketMessage(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;

      logger.info('Adding message to ticket', {
        ticketId: id,
        characterId
      });

      if (!content || !content.trim()) {
        res.status(400).json(errorResponse(
          'Il contenuto del messaggio è obbligatorio',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Verifica ownership e che il ticket non sia chiuso
      const ticket = await Ticket.findOne({
        _id: id,
        createdBy: characterId,
        status: { $ne: 'closed' }
      });

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket non trovato o chiuso',
          'TICKET_NOT_FOUND_OR_CLOSED',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Crea il messaggio
      const message = new TicketMessage({
        ticketId: id,
        content: content.trim(),
        sender: {
          type: 'character',
          id: characterId,
          name: characterName
        },
        isInternal: false
      });

      await message.save();

      // Aggiorna il ticket con nuovo timestamp di lettura per il personaggio
      await Ticket.findByIdAndUpdate(id, {
        'lastReadBy.character': new Date()
      });

      logger.info('Message added to ticket successfully', {
        ticketId: id,
        messageId: message._id.toString(),
        characterId
      });

      // Pubblica evento Redis
      const redisPublisher = redis.getPublisher();
      await redisPublisher.publish('ticket:events', JSON.stringify({
        type: 'ticket_message',
        ticketId: id,
        messageId: message._id.toString(),
        content: message.content,
        sender: {
          type: 'character',
          id: characterId,
          name: characterName
        },
        sentAt: message.sentAt,
        ticketTitle: ticket.title,
        department: ticket.department,
        timestamp: new Date().toISOString(),
        source: 'game-backend'
      }));

      // Send notification to assigned staff via NotificationService
      try {
        await NotificationService.notifyTicketReplied(
          {
            _id: ticket._id,
            ticketNumber: ticket._id.toString().slice(-6).toUpperCase(),
            category: ticket.category,
            priority: ticket.priority,
            department: ticket.department,
            assignedTo: ticket.assignedTo,
            createdBy: {
              characterId,
              characterName
            }
          },
          {
            _id: message._id,
            content: message.content,
            sender: {
              type: 'character',
              id: characterId,
              name: characterName
            },
            sentAt: message.sentAt,
            isInternal: false
          }
        );
      } catch (notifyError) {
        logger.error('Failed to send ticket reply notification:', notifyError);
        // Non blocca la risposta - notifica è best-effort
      }

      res.status(201).json(createResponse(
        {
          message: {
            id: message._id.toString(),
            content: message.content,
            sender: message.sender,
            sentAt: message.sentAt,
            isFromCurrentUser: true
          }
        },
        'Messaggio aggiunto con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error adding ticket message:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile aggiungere il messaggio',
        'ADD_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/tickets/:id/messages
   * Lista messaggi del ticket (solo proprietario, escluse note interne)
   */
  static async getTicketMessages(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const characterId = req.character!.characterId;

      logger.info('Fetching ticket messages', {
        ticketId: id,
        characterId
      });

      // Verifica ownership del ticket
      const ticket = await Ticket.findOne({
        _id: id,
        createdBy: characterId
      });

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket non trovato',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Ottieni i messaggi (escluse le note interne)
      const messages = await TicketMessage.find({
        ticketId: id,
        isInternal: false
      }).sort({ sentAt: 1 }).lean();

      // Segna tutti i messaggi dello staff come letti dal personaggio
      await TicketMessage.updateMany(
        {
          ticketId: id,
          'sender.type': 'staff',
          'readAt.character': { $exists: false }
        },
        {
          'readAt.character': new Date()
        }
      );

      // Format messages
      const formattedMessages = messages.map(msg => ({
        id: msg._id.toString(),
        content: msg.content,
        sender: msg.sender,
        sentAt: msg.sentAt,
        isFromCurrentUser: msg.sender.type === 'character' && msg.sender.id.toString() === characterId,
        readAt: msg.readAt
      }));

      res.json(successResponse(
        {
          messages: formattedMessages
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching ticket messages:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i messaggi',
        'FETCH_MESSAGES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PUT /game/tickets/:id/read
   * Segna ticket come letto dal personaggio
   */
  static async markTicketAsRead(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const characterId = req.character!.characterId;

      logger.info('Marking ticket as read', {
        ticketId: id,
        characterId
      });

      // Aggiornamento atomico del ticket
      const ticket = await Ticket.findOneAndUpdate(
        {
          _id: id,
          createdBy: characterId
        },
        {
          'lastReadBy.character': new Date()
        },
        {
          returnDocument: 'after'
        }
      );

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket non trovato',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Segna tutti i messaggi dello staff come letti
      await TicketMessage.updateMany(
        {
          ticketId: id,
          'sender.type': 'staff',
          'readAt.character': { $exists: false }
        },
        {
          'readAt.character': new Date()
        }
      );

      res.json(successResponse(
        undefined,
        'Ticket segnato come letto',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error marking ticket as read:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile segnare il ticket come letto',
        'MARK_READ_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/tickets/categories
   * Lista categorie disponibili per la creazione ticket
   */
  static async getTicketCategories(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching ticket categories from SystemConfiguration');

      // Fetch all ticket category configs from DB
      const categoryConfigs = await SystemConfiguration.find({
        configSection: 'ticket_system',
        configKey: { $regex: /^ticket_category_/ },
        isActive: true
      }).lean();

      // Map to frontend format
      const categories = categoryConfigs.map(config => {
        const categoryValue = config.configKey.replace('ticket_category_', '');
        const categoryData = config.value as any;

        return {
          value: categoryValue,
          label: categoryData.label || TICKET_CATEGORIES[categoryValue as TicketCategory] || categoryValue,
          description: categoryData.description || '',
          department: categoryData.department || TicketDepartment.GENERAL,
          priority: categoryData.defaultPriority || TicketPriority.LOW
        };
      });

      const seen = new Set(categories.map((c) => c.value));
      const staticFallback = (Object.values(TicketCategory) as string[])
        .filter((v) => !seen.has(v))
        .map((value) => ({
          value,
          label: TICKET_CATEGORIES[value as TicketCategory] || value,
          description: '',
          department: CATEGORY_DEPARTMENT_MAPPING[value as TicketCategory] || TicketDepartment.GENERAL,
          priority: CATEGORY_PRIORITY_MAPPING[value as TicketCategory] || TicketPriority.LOW,
        }));

      const merged = [...categories, ...staticFallback];

      logger.info('Ticket categories fetched from DB', { count: merged.length });

      res.json(successResponse(
        {
          categories: merged
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching ticket categories:', {
        error: err.message,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le categorie',
        'FETCH_CATEGORIES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/tickets/unread-count
   * Contatore notifiche non lette per il personaggio
   */
  static async getUnreadTicketsCount(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      logger.info('Fetching unread tickets count', {
        characterId
      });

      // Conta i messaggi dello staff non letti dal personaggio
      const unreadCount = await TicketMessage.aggregate([
        {
          $lookup: {
            from: 'tickets',
            localField: 'ticketId',
            foreignField: '_id',
            as: 'ticket'
          }
        },
        {
          $match: {
            'ticket.createdBy': characterId,
            'sender.type': 'staff',
            'readAt.character': { $exists: false },
            isInternal: false
          }
        },
        {
          $count: 'unreadCount'
        }
      ]);

      const totalUnread = unreadCount.length > 0 ? unreadCount[0].unreadCount : 0;

      res.json(successResponse(
        {
          unreadCount: totalUnread
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching unread tickets count:', {
        error: err.message,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare il conteggio non letti',
        'FETCH_UNREAD_COUNT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}