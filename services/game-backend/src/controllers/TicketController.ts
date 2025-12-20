import { Request, Response } from 'express';
import { Ticket, TicketMessage, Character } from '../../../../packages/database/models';
import { ApiResponse, TicketCategory, TicketPriority, TicketDepartment, TICKET_CATEGORIES, CATEGORY_DEPARTMENT_MAPPING, CATEGORY_PRIORITY_MAPPING } from '../types/game';
import { logger } from '../utils/logger';
import { AuthMiddleware } from '../middleware/auth';
import { getRedisPublisher } from '../config/redis';

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
        page: Number(page)
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

      const response: ApiResponse = {
        success: true,
        data: {
          tickets: formattedTickets,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            hasMore: skip + tickets.length < totalCount
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching user tickets:', {
        error: err.message,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i ticket',
        code: 'FETCH_TICKETS_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Titolo, categoria e contenuto sono obbligatori',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Verifica che la categoria sia valida
      if (!Object.values(TicketCategory).includes(category)) {
        const response: ApiResponse = {
          success: false,
          error: 'Categoria ticket non valida',
          code: 'INVALID_CATEGORY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Tutti i personaggi possono creare ticket (anche DRAFT/PENDING per supporto approvazione)
      const character = await Character.findById(characterId);
      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
      const redisPublisher = getRedisPublisher();
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

      // Risposta success
      const response: ApiResponse = {
        success: true,
        data: {
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
        message: 'Ticket creato con successo',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error creating ticket:', {
        error: err.message,
        characterId: req.character?.characterId,
        body: req.body,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile creare il ticket',
        code: 'CREATE_TICKET_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /game/tickets/:id
   * Dettagli singolo ticket (solo proprietario)
   */
  static async getTicketDetails(req: Request, res: Response): Promise<void> {
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
        const response: ApiResponse = {
          success: false,
          error: 'Ticket non trovato',
          code: 'TICKET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          ticket: ticketDetails
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching ticket details:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i dettagli del ticket',
        code: 'FETCH_TICKET_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * PUT /game/tickets/:id/reopen
   * Riapri ticket chiuso (solo proprietario)
   */
  static async reopenTicket(req: Request, res: Response): Promise<void> {
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
          new: true
        }
      );

      if (!ticket) {
        const response: ApiResponse = {
          success: false,
          error: 'Ticket non trovato o non può essere riaperto',
          code: 'TICKET_NOT_REOPENABLE',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
      const redisPublisher = getRedisPublisher();
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

      const response: ApiResponse = {
        success: true,
        data: {
          ticket: {
            id: ticket._id.toString(),
            status: ticket.status
          }
        },
        message: 'Ticket riaperto con successo',
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error reopening ticket:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile riaprire il ticket',
        code: 'REOPEN_TICKET_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /game/tickets/:id/messages
   * Aggiungi messaggio a ticket esistente
   */
  static async addTicketMessage(req: Request, res: Response): Promise<void> {
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
        const response: ApiResponse = {
          success: false,
          error: 'Il contenuto del messaggio è obbligatorio',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Verifica ownership e che il ticket non sia chiuso
      const ticket = await Ticket.findOne({
        _id: id,
        createdBy: characterId,
        status: { $ne: 'closed' }
      });

      if (!ticket) {
        const response: ApiResponse = {
          success: false,
          error: 'Ticket non trovato o chiuso',
          code: 'TICKET_NOT_FOUND_OR_CLOSED',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
      const redisPublisher = getRedisPublisher();
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

      const response: ApiResponse = {
        success: true,
        data: {
          message: {
            id: message._id.toString(),
            content: message.content,
            sender: message.sender,
            sentAt: message.sentAt,
            isFromCurrentUser: true
          }
        },
        message: 'Messaggio aggiunto con successo',
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error adding ticket message:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiungere il messaggio',
        code: 'ADD_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /game/tickets/:id/messages
   * Lista messaggi del ticket (solo proprietario, escluse note interne)
   */
  static async getTicketMessages(req: Request, res: Response): Promise<void> {
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
        const response: ApiResponse = {
          success: false,
          error: 'Ticket non trovato',
          code: 'TICKET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          messages: formattedMessages
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching ticket messages:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i messaggi',
        code: 'FETCH_MESSAGES_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * PUT /game/tickets/:id/read
   * Segna ticket come letto dal personaggio
   */
  static async markTicketAsRead(req: Request, res: Response): Promise<void> {
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
          new: true
        }
      );

      if (!ticket) {
        const response: ApiResponse = {
          success: false,
          error: 'Ticket non trovato',
          code: 'TICKET_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        message: 'Ticket segnato come letto',
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error marking ticket as read:', {
        error: err.message,
        ticketId: req.params.id,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile segnare il ticket come letto',
        code: 'MARK_READ_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /game/tickets/categories
   * Lista categorie disponibili per la creazione ticket
   */
  static async getTicketCategories(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching ticket categories');

      const categories = Object.entries(TICKET_CATEGORIES).map(([value, label]) => ({
        value,
        label,
        department: CATEGORY_DEPARTMENT_MAPPING[value as TicketCategory] || TicketDepartment.GENERAL,
        priority: CATEGORY_PRIORITY_MAPPING[value as TicketCategory] || TicketPriority.LOW
      }));

      const response: ApiResponse = {
        success: true,
        data: {
          categories
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching ticket categories:', {
        error: err.message,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le categorie',
        code: 'FETCH_CATEGORIES_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          unreadCount: totalUnread
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching unread tickets count:', {
        error: err.message,
        characterId: req.character?.characterId,
        stack: err.stack
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare il conteggio non letti',
        code: 'FETCH_UNREAD_COUNT_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}