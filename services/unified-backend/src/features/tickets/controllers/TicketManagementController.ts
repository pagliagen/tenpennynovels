import { Request, Response } from 'express';
import mongoose from 'mongoose';
import {
  TicketManagement,
  TicketAssignment,
  TicketReassignment,
  TicketTransfer,
  TicketClosure,
  TicketMessage as TicketMessageResponse,
  TicketPriorityUpdate,
  TicketInternalNote,
  TicketStats,
  TicketFilters
} from '../types';
import type { PaginationInfo } from '@modules/admin/types/management';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { logger } from '@modules/admin/utils/logger';
import { redis } from '@config/runtime/redis';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

import { escapeRegex } from '@shared/utils/validation';

import { User } from '@core/auth/models/User';
import { Ticket } from '../models/Ticket';
import { TicketMessage } from '../models/TicketMessage';

// Department role mapping for access control
const DEPARTMENT_ROLES_MAPPING = {
  'master': ['master', 'amministratore'],
  'technical': ['amministratore'],
  'moderation': ['moderatore', 'amministratore'],
  'administration': ['master', 'moderatore', 'amministratore'],
  'general': ['master', 'moderatore', 'amministratore']
} as const;

// Category labels mapping
const TICKET_CATEGORIES = {
  'character_sheet_review': 'Revisione Scheda Personaggio',
  'character_approval': 'Approvazione Personaggio',
  'character_access_problem': 'Problema Accesso Personaggio',
  'character_status_change': 'Cambio Status Personaggio',
  'private_location_access': 'Accesso Location Private',
  'location_problem': 'Problema Location',
  'location_event_creation': 'Creazione Evento Location',
  'new_location_request': 'Richiesta Nuova Location',
  'location_chat_problem': 'Problema Chat Location',
  'offgame_chat_problem': 'Problema Chat Off-Game',
  'postal_system_problem': 'Problema Sistema Postale',
  'group_chat_request': 'Richiesta Chat Gruppo',
  'corporation_join_request': 'Richiesta Adesione Corporazione',
  'corporation_management_problem': 'Problema Gestione Corporazione',
  'new_corporation_request': 'Creazione Nuova Corporazione',
  'game_bug_report': 'Bug Sistema di Gioco',
  'performance_problem': 'Problema Performance',
  'websocket_problem': 'Problema WebSocket',
  'general_support': 'Supporto Generale',
  'information_request': 'Richiesta Informazioni',
  'user_report': 'Segnalazione Utente',
  'improvement_suggestion': 'Proposta Miglioramento',
  'sanction_appeal': 'Sanzione / contestazione'
} as const;

export class TicketManagementController {
  /**
   * Get all tickets with filters and pagination
   * GET /admin/tickets
   */
  static async getAllTickets(req: Request, res: Response): Promise<void> {
    try {
      const page = Number.parseInt(req.query.page as string) || 1;
      const pageSize = Number.parseInt(req.query.pageSize as string) || 25;
      const sortBy = req.query.sortBy as string || 'createdAt';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // CWE-943: `as string` è solo un cast a compile-time — a runtime un
      // client può mandare ?status[$where]=x (qs lo trasforma in oggetto) e
      // quell'oggetto finirebbe diretto nel filtro Mongo sotto. Guardia
      // typeof reale per ogni campo prima di usarlo come valore di filtro.
      const filters: TicketFilters = {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        department: typeof req.query.department === 'string' ? req.query.department : undefined,
        assignedTo: typeof req.query.assignedTo === 'string' ? req.query.assignedTo : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
        dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
        escalated: req.query.escalated === 'true'
      };

      // Build MongoDB query filters
      const mongoFilters: any = {};

      if (filters.status && filters.status !== 'all') {
        mongoFilters.status = filters.status;
      }

      if (filters.priority && filters.priority !== 'all') {
        mongoFilters.priority = filters.priority;
      }

      if (filters.category && filters.category !== 'all') {
        mongoFilters.category = filters.category;
      }

      if (filters.department && filters.department !== 'all') {
        mongoFilters.department = filters.department;
      }

      if (filters.assignedTo && filters.assignedTo !== 'all') {
        if (filters.assignedTo === 'unassigned') {
          mongoFilters.assignedTo = null;
        } else {
          mongoFilters.assignedTo = new mongoose.Types.ObjectId(filters.assignedTo);
        }
      }

      // Search filter
      if (filters.search && filters.search.trim()) {
        const escapedSearch = escapeRegex(filters.search);
        mongoFilters.$or = [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { createdByName: { $regex: escapedSearch, $options: 'i' } },
          { assignedToName: { $regex: escapedSearch, $options: 'i' } },
          { internalNotes: { $regex: escapedSearch, $options: 'i' } }
        ];
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        mongoFilters.createdAt = {};
        if (filters.dateFrom) {
          mongoFilters.createdAt.$gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
          mongoFilters.createdAt.$lte = new Date(filters.dateTo);
        }
      }

      // Escalated filter
      if (filters.escalated) {
        mongoFilters.escalatedAt = { $exists: true };
      }

      // Build sort object
      const sortObject: any = {};
      sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Count total documents
      const totalTickets = await Ticket.countDocuments(mongoFilters);

      // Execute query with pagination
      const tickets = await Ticket.find(mongoFilters)
        .sort(sortObject)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Get message counts for each ticket
      const ticketIds = tickets.map((ticket: any) => ticket!._id);
      const messageCounts = await TicketMessage.aggregate([
        { $match: { ticketId: { $in: ticketIds } } },
        { $group: { _id: '$ticketId', count: { $sum: 1 } } }
      ]);

      const messageCountMap = new Map();
      messageCounts.forEach(({ _id, count }: any) => {
        messageCountMap.set(_id.toString(), count);
      });

      // Transform tickets to API format
      const transformedTickets: TicketManagement[] = tickets.map((ticket: any) => ({
        id: ticket!._id.toString(),
        title: ticket!.title,
        category: ticket!.category,
        categoryLabel: TICKET_CATEGORIES[ticket!.category as keyof typeof TICKET_CATEGORIES] || ticket!.category,
        priority: ticket!.priority,
        status: ticket!.status,
        department: ticket!.department,
        createdBy: {
          id: ticket!.createdBy.toString(),
          name: ticket!.createdByName
        },
        createdAt: ticket.createdAt.toISOString(),
        assignedTo: ticket!.assignedTo ? {
          id: ticket!.assignedTo.toString(),
          name: ticket!.assignedToName || 'Unknown'
        } : undefined,
        assignedAt: ticket.assignedAt?.toISOString(),
        closedAt: ticket.closedAt?.toISOString(),
        closedBy: ticket.closedBy ? {
          id: ticket.closedBy.toString(),
          name: ticket!.closedByName || 'Unknown'
        } : undefined,
        escalatedAt: ticket.escalatedAt?.toISOString(),
        escalationLevel: ticket.escalationLevel,
        lastReadBy: {
          character: ticket.lastReadBy?.character?.toISOString(),
          staff: ticket.lastReadBy?.staff?.toISOString()
        },
        tags: ticket.tags,
        internalNotes: ticket.internalNotes,
        messageCount: messageCountMap.get(ticket!._id.toString()) || 0
      }));

      const totalPages = Math.ceil(totalTickets / pageSize);
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems: totalTickets,
        pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed all tickets', {
        ...auditInfo,
        filters,
        currentPage: page,
        pageSize,
        totalTickets
      });

      res.json(listResponse(
        transformedTickets,
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching all tickets:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params,
        adminInfo: AdminAuthMiddleware.getAuditInfo(req)
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
   * Get tickets assigned to current admin
   * GET /admin/tickets/my
   */
  static async getMyTickets(req: Request, res: Response): Promise<void> {
    try {
      const adminUserId = req.user?.userId;
      if (!adminUserId) {
        res.status(401).json(errorResponse(
          'User not authenticated',
          'USER_NOT_AUTHENTICATED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const page = Number.parseInt(req.query.page as string) || 1;
      const pageSize = Number.parseInt(req.query.pageSize as string) || 25;
      // CWE-943: vedi guardia di tipo in getAllTickets.
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      // Build query for assigned tickets
      const query: any = { assignedTo: new mongoose.Types.ObjectId(adminUserId) };

      if (status && status !== 'all') {
        query.status = status;
      }

      // Count total documents
      const totalTickets = await Ticket.countDocuments(query);

      // Execute query with pagination
      const tickets = await Ticket.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Get message counts for each ticket
      const ticketIds = tickets.map((ticket: any) => ticket!._id);
      const messageCounts = await TicketMessage.aggregate([
        { $match: { ticketId: { $in: ticketIds } } },
        { $group: { _id: '$ticketId', count: { $sum: 1 } } }
      ]);

      const messageCountMap = new Map();
      messageCounts.forEach(({ _id, count }: any) => {
        messageCountMap.set(_id.toString(), count);
      });

      // Transform tickets to API format
      const transformedTickets: TicketManagement[] = tickets.map((ticket: any) => ({
        id: ticket!._id.toString(),
        title: ticket!.title,
        category: ticket!.category,
        categoryLabel: TICKET_CATEGORIES[ticket!.category as keyof typeof TICKET_CATEGORIES] || ticket!.category,
        priority: ticket!.priority,
        status: ticket!.status,
        department: ticket!.department,
        createdBy: {
          id: ticket!.createdBy.toString(),
          name: ticket!.createdByName
        },
        createdAt: ticket.createdAt.toISOString(),
        assignedTo: ticket!.assignedTo ? {
          id: ticket!.assignedTo.toString(),
          name: ticket!.assignedToName || 'Unknown'
        } : undefined,
        assignedAt: ticket.assignedAt?.toISOString(),
        closedAt: ticket.closedAt?.toISOString(),
        closedBy: ticket.closedBy ? {
          id: ticket.closedBy.toString(),
          name: 'Staff'
        } : undefined,
        escalatedAt: ticket.escalatedAt?.toISOString(),
        escalationLevel: ticket.escalationLevel,
        lastReadBy: {
          character: ticket.lastReadBy?.character?.toISOString(),
          staff: ticket.lastReadBy?.staff?.toISOString()
        },
        tags: ticket.tags,
        internalNotes: ticket.internalNotes,
        messageCount: messageCountMap.get(ticket!._id.toString()) || 0
      }));

      const totalPages = Math.ceil(totalTickets / pageSize);
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems: totalTickets,
        pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed assigned tickets', {
        ...auditInfo,
        status,
        totalTickets
      });

      res.json(listResponse(
        transformedTickets,
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching my tickets:', { error: error instanceof Error ? error.message : String(error) });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i ticket assegnati',
        'FETCH_MY_TICKETS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get tickets from current admin's department
   * GET /admin/tickets/department
   */
  static async getDepartmentTickets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user?.characterRoles) {
        res.status(403).json(errorResponse(
          'Character roles required to access department tickets',
          'CHARACTER_ROLES_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Determine which departments the admin has access to
      const userRoles = req.user.characterRoles;
      const accessibleDepartments: string[] = [];

      Object.entries(DEPARTMENT_ROLES_MAPPING).forEach(([department, requiredRoles]) => {
        if (requiredRoles.some(role => userRoles.includes(role))) {
          accessibleDepartments.push(department);
        }
      });

      if (accessibleDepartments.length === 0) {
        res.status(403).json(errorResponse(
          'No department access permissions',
          'NO_DEPARTMENT_ACCESS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const page = Number.parseInt(req.query.page as string) || 1;
      const pageSize = Number.parseInt(req.query.pageSize as string) || 25;
      // CWE-943: vedi guardia di tipo in getAllTickets.
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      // Build query for department tickets
      const query: any = { department: { $in: accessibleDepartments } };

      if (status && status !== 'all') {
        query.status = status;
      }

      // Count total documents
      const totalTickets = await Ticket.countDocuments(query);

      // Execute query with pagination
      const tickets = await Ticket.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Transform and return similar to getAllTickets
      const ticketIds = tickets.map((ticket: any) => ticket!._id);
      const messageCounts = await TicketMessage.aggregate([
        { $match: { ticketId: { $in: ticketIds } } },
        { $group: { _id: '$ticketId', count: { $sum: 1 } } }
      ]);

      const messageCountMap = new Map();
      messageCounts.forEach(({ _id, count }: any) => {
        messageCountMap.set(_id.toString(), count);
      });

      const transformedTickets: TicketManagement[] = tickets.map((ticket: any) => ({
        id: ticket!._id.toString(),
        title: ticket!.title,
        category: ticket!.category,
        categoryLabel: TICKET_CATEGORIES[ticket!.category as keyof typeof TICKET_CATEGORIES] || ticket!.category,
        priority: ticket!.priority,
        status: ticket!.status,
        department: ticket!.department,
        createdBy: {
          id: ticket!.createdBy.toString(),
          name: ticket!.createdByName
        },
        createdAt: ticket.createdAt.toISOString(),
        assignedTo: ticket!.assignedTo ? {
          id: ticket!.assignedTo.toString(),
          name: ticket!.assignedToName || 'Unknown'
        } : undefined,
        assignedAt: ticket.assignedAt?.toISOString(),
        closedAt: ticket.closedAt?.toISOString(),
        closedBy: ticket.closedBy ? {
          id: ticket.closedBy.toString(),
          name: 'Staff'
        } : undefined,
        escalatedAt: ticket.escalatedAt?.toISOString(),
        escalationLevel: ticket.escalationLevel,
        lastReadBy: {
          character: ticket.lastReadBy?.character?.toISOString(),
          staff: ticket.lastReadBy?.staff?.toISOString()
        },
        tags: ticket.tags,
        internalNotes: ticket.internalNotes,
        messageCount: messageCountMap.get(ticket!._id.toString()) || 0
      }));

      const totalPages = Math.ceil(totalTickets / pageSize);
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems: totalTickets,
        pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed department tickets', {
        ...auditInfo,
        accessibleDepartments,
        status,
        totalTickets
      });

      res.json(successResponse(
        {
          tickets: transformedTickets,
          pagination,
          departments: accessibleDepartments
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching department tickets:', { error: error instanceof Error ? error.message : String(error) });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i ticket del reparto',
        'FETCH_DEPARTMENT_TICKETS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get tickets from specific department
   * GET /admin/tickets/department/:dept
   */
  static async getSpecificDepartmentTickets(req: Request<{ dept: string }>, res: Response): Promise<void> {
    try {
      const targetDepartment = req.params.dept;

      if (!req.user?.characterRoles) {
        res.status(403).json(errorResponse(
          'Character roles required to access department tickets',
          'CHARACTER_ROLES_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check if admin has access to this specific department
      const requiredRoles = DEPARTMENT_ROLES_MAPPING[targetDepartment as keyof typeof DEPARTMENT_ROLES_MAPPING];
      if (!requiredRoles) {
        res.status(400).json(errorResponse(
          'Reparto non valido',
          'INVALID_DEPARTMENT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const hasAccess = requiredRoles.some(role => req.user?.characterRoles?.includes(role));
      if (!hasAccess) {
        res.status(403).json(errorResponse(
          'Permessi insufficienti per questo reparto',
          'INSUFFICIENT_DEPARTMENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const page = Number.parseInt(req.query.page as string) || 1;
      const pageSize = Number.parseInt(req.query.pageSize as string) || 25;
      // CWE-943: vedi guardia di tipo in getAllTickets. targetDepartment è
      // un req.params (sempre stringa, Express non lo trasforma mai in
      // oggetto) ed è già validato contro DEPARTMENT_ROLES_MAPPING sopra —
      // nessuna guardia aggiuntiva necessaria lì.
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      // Build query for specific department tickets
      const query: any = { department: targetDepartment };

      if (status && status !== 'all') {
        query.status = status;
      }

      // Execute similar logic to getDepartmentTickets but for specific department
      const totalTickets = await Ticket.countDocuments(query);

      const tickets = await Ticket.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      const ticketIds = tickets.map((ticket: any) => ticket!._id);
      const messageCounts = await TicketMessage.aggregate([
        { $match: { ticketId: { $in: ticketIds } } },
        { $group: { _id: '$ticketId', count: { $sum: 1 } } }
      ]);

      const messageCountMap = new Map();
      messageCounts.forEach(({ _id, count }: any) => {
        messageCountMap.set(_id.toString(), count);
      });

      const transformedTickets: TicketManagement[] = tickets.map((ticket: any) => ({
        id: ticket!._id.toString(),
        title: ticket!.title,
        category: ticket!.category,
        categoryLabel: TICKET_CATEGORIES[ticket!.category as keyof typeof TICKET_CATEGORIES] || ticket!.category,
        priority: ticket!.priority,
        status: ticket!.status,
        department: ticket!.department,
        createdBy: {
          id: ticket!.createdBy.toString(),
          name: ticket!.createdByName
        },
        createdAt: ticket.createdAt.toISOString(),
        assignedTo: ticket!.assignedTo ? {
          id: ticket!.assignedTo.toString(),
          name: ticket!.assignedToName || 'Unknown'
        } : undefined,
        assignedAt: ticket.assignedAt?.toISOString(),
        closedAt: ticket.closedAt?.toISOString(),
        closedBy: ticket.closedBy ? {
          id: ticket.closedBy.toString(),
          name: 'Staff'
        } : undefined,
        escalatedAt: ticket.escalatedAt?.toISOString(),
        escalationLevel: ticket.escalationLevel,
        lastReadBy: {
          character: ticket.lastReadBy?.character?.toISOString(),
          staff: ticket.lastReadBy?.staff?.toISOString()
        },
        tags: ticket.tags,
        internalNotes: ticket.internalNotes,
        messageCount: messageCountMap.get(ticket!._id.toString()) || 0
      }));

      const totalPages = Math.ceil(totalTickets / pageSize);
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems: totalTickets,
        pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed specific department tickets', {
        ...auditInfo,
        targetDepartment,
        status,
        totalTickets
      });

      res.json(listResponse(
        transformedTickets,
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching specific department tickets:', {
        error: error instanceof Error ? error.message : String(error),
        department: req.params.dept
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i ticket del reparto',
        'FETCH_SPECIFIC_DEPARTMENT_TICKETS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get ticket statistics for dashboard
   * GET /admin/tickets/stats
   */
  static async getTicketStats(req: Request, res: Response): Promise<void> {
    try {
      // Check if user has administrative access
      if (!req.user?.characterRoles?.includes('amministratore')) {
        res.status(403).json(errorResponse(
          'Administrator role required for statistics',
          'ADMINISTRATOR_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get overview statistics for dashboard
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        openCount,
        unassignedCount,
        inProgressCount,
        closedThisMonthCount,
        categoryStatsRaw
      ] = await Promise.all([
        // Open tickets (open + reopened status)
        Ticket.countDocuments({ status: { $in: ['open', 'reopened'] } }),

        // Unassigned tickets (no assignedTo)
        Ticket.countDocuments({
          status: { $ne: 'closed' },
          assignedTo: null
        }),

        // In progress tickets
        Ticket.countDocuments({ status: 'in_progress' }),

        // Closed in last 30 days
        Ticket.countDocuments({
          status: 'closed',
          closedAt: { $gte: thirtyDaysAgo }
        }),

        // Category breakdown with all statuses
        Ticket.aggregate([
          {
            $group: {
              _id: '$category',
              openCount: {
                $sum: { $cond: [{ $in: ['$status', ['open', 'reopened']] }, 1, 0] }
              },
              inProgressCount: {
                $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
              },
              closedCount: {
                $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
              },
              totalCount: { $sum: 1 }
            }
          }
        ])
      ]);

      // Category labels mapping
      const categoryLabels: Record<string, string> = {
        character_approval: 'Approvazione Personaggio',
        character_edit: 'Modifica Personaggio',
        quest_proposal: 'Proposta Trama',
        game_bug_report: 'Segnalazione Bug',
        improvement_suggestion: 'Suggerimento'
      };

      // Transform category stats for dashboard
      const categoryStats = categoryStatsRaw.map((stat: any) => ({
        category: stat._id,
        categoryLabel: categoryLabels[stat._id] || stat._id,
        openCount: stat.openCount,
        inProgressCount: stat.inProgressCount,
        closedCount: stat.closedCount,
        totalCount: stat.totalCount
      }));

      const stats = {
        openCount,
        unassignedCount,
        inProgressCount,
        closedThisMonthCount,
        categoryStats
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed ticket statistics', auditInfo);

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching ticket statistics:', { error: error instanceof Error ? error.message : String(error) });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche dei ticket',
        'FETCH_TICKET_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed ticket information
   * GET /admin/tickets/:id
   */
  static async getTicketDetails(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId).lean();

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Type assertion for ticket to avoid union type issues
      const ticketData = ticket;

      // Check if admin has access to this ticket's department
      if (req.user?.characterRoles) {
        const requiredRoles = DEPARTMENT_ROLES_MAPPING[ticketData.department as keyof typeof DEPARTMENT_ROLES_MAPPING];
        const hasAccess = requiredRoles?.some(role => req.user?.characterRoles?.includes(role));

        if (!hasAccess) {
          res.status(403).json(errorResponse(
            'Permessi insufficienti per visualizzare questo ticket',
            'INSUFFICIENT_PERMISSIONS',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }
      }

      // Get ticket messages
      const messages = await TicketMessage.find({ ticketId: new mongoose.Types.ObjectId(ticketId) })
        .sort({ sentAt: 1 })
        .lean();

      // Transform ticket to API format
      const ticketDetails: TicketManagement = {
        id: ticketData._id.toString(),
        title: ticketData.title,
        category: ticketData.category,
        categoryLabel: TICKET_CATEGORIES[ticketData.category as keyof typeof TICKET_CATEGORIES] || ticketData.category,
        priority: ticketData.priority,
        status: ticketData.status,
        department: ticketData.department,
        createdBy: {
          id: ticketData.createdBy.toString(),
          name: ticketData.createdByName
        },
        createdAt: ticketData.createdAt.toISOString(),
        assignedTo: ticketData.assignedTo ? {
          id: ticketData.assignedTo.toString(),
          name: ticketData.assignedToName || 'Unknown'
        } : undefined,
        assignedAt: ticket.assignedAt?.toISOString(),
        closedAt: ticket.closedAt?.toISOString(),
        closedBy: ticket.closedBy ? {
          id: ticket.closedBy.toString(),
          name: 'Staff'
        } : undefined,
        escalatedAt: ticket.escalatedAt?.toISOString(),
        escalationLevel: ticket.escalationLevel,
        lastReadBy: {
          character: ticket.lastReadBy?.character?.toISOString(),
          staff: ticket.lastReadBy?.staff?.toISOString()
        },
        tags: ticket.tags,
        internalNotes: ticket.internalNotes,
        messageCount: messages.length
      };

      // Transform messages
      const transformedMessages: TicketMessageResponse[] = messages.map((message: any) => ({
        id: message._id.toString(),
        ticketId: message.ticketId.toString(),
        content: message.content,
        sender: {
          type: message.sender.type,
          id: message.sender.id.toString(),
          name: message.sender.name
        },
        sentAt: message.sentAt.toISOString(),
        isInternal: message.isInternal
      }));

      // Update staff read timestamp
      await Ticket.findByIdAndUpdate(ticketId, {
        'lastReadBy.staff': new Date()
      });

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed ticket details', {
        ...auditInfo,
        ticketId,
        ticketTitle: ticketData.title
      });

      res.json(successResponse(
        {
          ticket: ticketDetails,
          messages: transformedMessages
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching ticket details:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to fetch ticket details',
        'FETCH_TICKET_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Assign ticket to staff member (first assignment)
   * PUT /admin/tickets/:id/assign
   */
  static async assignTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const assignmentData: TicketAssignment = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // CWE-943: assignmentData è req.body non validato a runtime — il tipo
      // TicketAssignment è solo compile-time. Un assignedTo non-stringa
      // finirebbe in new mongoose.Types.ObjectId(...) sotto.
      if (
        !assignmentData.assignedTo || typeof assignmentData.assignedTo !== 'string' ||
        !assignmentData.assignedToName || typeof assignmentData.assignedToName !== 'string'
      ) {
        res.status(400).json(errorResponse(
          'Assignment details required',
          'ASSIGNMENT_DETAILS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get current ticket state to check if it's a reassignment
      const currentTicket = await Ticket.findById(ticketId);
      const wasAlreadyAssigned = currentTicket?.assignedTo ? true : false;
      const previousAssignee = currentTicket?.assignedToName;

      // Atomic operation to assign/reassign ticket (allows reassignment as all actions are logged)
      const updatedTicket = await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          status: { $in: ['open', 'reopened', 'assigned', 'in_progress'] }
        },
        {
          assignedTo: new mongoose.Types.ObjectId(assignmentData.assignedTo),
          assignedToName: assignmentData.assignedToName,
          assignedAt: new Date(),
          status: 'in_progress',
          'lastReadBy.staff': new Date()
        },
        { returnDocument: 'after' }
      );

      if (!updatedTicket) {
        res.status(404).json(errorResponse(
          'Ticket not found or in invalid status for assignment',
          'TICKET_ASSIGNMENT_FAILED',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Publish WebSocket event for real-time notification
      await redis.publish('ticket:events', JSON.stringify({
        eventType: wasAlreadyAssigned ? 'ticket_reassigned' : 'ticket_assigned',
        ticketId: updatedTicket!._id.toString(),
        ticketTitle: updatedTicket!.title,
        department: updatedTicket!.department,
        assignedTo: {
          id: assignmentData.assignedTo,
          name: assignmentData.assignedToName
        },
        previousAssignee: wasAlreadyAssigned ? {
          name: previousAssignee
        } : undefined,
        assignedBy: {
          id: req.user?.userId,
          name: req.user?.username
        },
        isReassignment: wasAlreadyAssigned
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      // Enhanced logging with reassignment tracking
      if (wasAlreadyAssigned) {
        logger.info('Ticket reassigned successfully', {
          ...auditInfo,
          ticketId,
          previousAssignee: previousAssignee,
          newAssignee: assignmentData.assignedToName,
          newAssigneeId: assignmentData.assignedTo,
          reason: assignmentData.reason,
          action: 'reassignment'
        });
      } else {
        logger.info('Ticket assigned successfully', {
          ...auditInfo,
          ticketId,
          assignedTo: assignmentData.assignedTo,
          assignedToName: assignmentData.assignedToName,
          reason: assignmentData.reason,
          action: 'initial_assignment'
        });
      }

      res.json(updateResponse(
        {
          ticketId: updatedTicket!._id.toString(),
          status: 'in_progress'
        },
        wasAlreadyAssigned ? 'Ticket riassegnato con successo' : 'Ticket assegnato con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error assigning ticket:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to assign ticket',
        'ASSIGN_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Reassign ticket from one staff to another
   * PUT /admin/tickets/:id/reassign
   */
  static async reassignTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const reassignmentData: TicketReassignment = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!reassignmentData.toStaff || !reassignmentData.toStaffName) {
        res.status(400).json(errorResponse(
          'Reassignment target required',
          'REASSIGNMENT_TARGET_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (!ticket!.assignedTo) {
        res.status(400).json(errorResponse(
          'Ticket is not assigned to anyone',
          'TICKET_NOT_ASSIGNED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Add to reassignment history
      if (!ticket.reassignmentHistory) {
        ticket!.reassignmentHistory = [];
      }

      ticket!.reassignmentHistory.push({
        fromStaff: ticket!.assignedTo,
        fromStaffName: ticket!.assignedToName || 'Unknown',
        toStaff: new mongoose.Types.ObjectId(reassignmentData.toStaff),
        toStaffName: reassignmentData.toStaffName,
        reassignedAt: new Date(),
        reason: reassignmentData.reason
      });

      // Update assignment
      ticket!.assignedTo = new mongoose.Types.ObjectId(reassignmentData.toStaff);
      ticket!.assignedToName = reassignmentData.toStaffName;
      ticket!.assignedAt = new Date();
      ticket!.lastReadBy.staff = new Date();

      await ticket!.save();

      // Publish WebSocket event
      await redis.publish('ticket:events', JSON.stringify({
        eventType: 'ticket_reassigned',
        ticketId: ticket!._id.toString(),
        ticketTitle: ticket!.title,
        department: ticket!.department,
        reassignment: {
          fromStaff: {
            id: reassignmentData.fromStaff,
            name: reassignmentData.fromStaffName
          },
          toStaff: {
            id: reassignmentData.toStaff,
            name: reassignmentData.toStaffName
          },
          reason: reassignmentData.reason
        },
        reassignedBy: {
          id: req.user?.userId,
          name: req.user?.username
        }
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Ticket reassigned', {
        ...auditInfo,
        ticketId,
        fromStaff: reassignmentData.fromStaff,
        toStaff: reassignmentData.toStaff,
        reason: reassignmentData.reason
      });

      res.json(updateResponse(
        {
          ticketId: ticket!._id.toString(),
          status: 'reassigned'
        },
        'Ticket riassegnato con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error reassigning ticket:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to reassign ticket',
        'REASSIGN_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Transfer ticket to another department
   * PUT /admin/tickets/:id/transfer
   */
  static async transferTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const transferData: TicketTransfer = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!transferData.toDepartment || !transferData.reason) {
        res.status(400).json(errorResponse(
          'Transfer department and reason required',
          'TRANSFER_DETAILS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const validDepartments = ['master', 'technical', 'moderation', 'administration', 'general'];
      if (!validDepartments.includes(transferData.toDepartment)) {
        res.status(400).json(errorResponse(
          'Invalid target department',
          'INVALID_DEPARTMENT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (ticket.department === transferData.toDepartment) {
        res.status(400).json(errorResponse(
          'Ticket is already in the target department',
          'SAME_DEPARTMENT_TRANSFER',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Add to department history
      if (!ticket.departmentHistory) {
        ticket!.departmentHistory = [];
      }

      ticket!.departmentHistory.push({
        fromDepartment: ticket.department,
        toDepartment: transferData.toDepartment,
        transferredBy: new mongoose.Types.ObjectId(req.user?.userId!),
        transferredByName: req.user?.username || 'Unknown',
        transferredAt: new Date(),
        reason: transferData.reason
      });

      // Update department and reset assignment
      ticket!.department = transferData.toDepartment;
      ticket!.assignedTo = undefined;
      ticket!.assignedToName = undefined;
      ticket!.assignedAt = undefined;
      ticket!.status = 'open'; // Reset to open when transferred
      ticket!.lastReadBy.staff = new Date();

      await ticket!.save();

      // Publish WebSocket event
      await redis.publish('ticket:events', JSON.stringify({
        eventType: 'ticket_transferred',
        ticketId: ticket!._id.toString(),
        ticketTitle: ticket!.title,
        transfer: {
          fromDepartment: transferData.fromDepartment,
          toDepartment: transferData.toDepartment,
          reason: transferData.reason
        },
        transferredBy: {
          id: req.user?.userId,
          name: req.user?.username
        }
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Ticket transferred between departments', {
        ...auditInfo,
        ticketId,
        fromDepartment: transferData.fromDepartment,
        toDepartment: transferData.toDepartment,
        reason: transferData.reason
      });

      res.json(updateResponse(
        {
          ticketId: ticket!._id.toString(),
          newDepartment: transferData.toDepartment
        },
        'Ticket trasferito con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error transferring ticket:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to transfer ticket',
        'TRANSFER_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Close ticket
   * PUT /admin/tickets/:id/close
   */
  static async closeTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const closureData: TicketClosure = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (ticket!.status === 'closed') {
        res.status(400).json(errorResponse(
          'Ticket is already closed',
          'TICKET_ALREADY_CLOSED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Close the ticket
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      ticket!.status = 'closed';
      ticket!.closedAt = new Date();
      ticket!.closedBy = new mongoose.Types.ObjectId(req.user?.userId!);
      ticket!.closedByName = auditInfo?.adminUsername ?? req.user?.username ?? 'Staff';
      ticket!.lastReadBy.staff = new Date();

      // Add resolution note if provided
      if (closureData.resolution) {
        if (ticket.internalNotes) {
          ticket!.internalNotes += `\n\n[CLOSED] ${closureData.resolution}`;
        } else {
          ticket!.internalNotes = `[CLOSED] ${closureData.resolution}`;
        }
      }

      await ticket!.save();

      // Send closure message to user if requested
      if (closureData.resolution && closureData.notifyUser !== false) {
        await TicketMessage.create({
          ticketId: ticket!._id,
          content: `Ticket chiuso: ${closureData.resolution}`,
          sender: {
            type: 'staff',
            id: new mongoose.Types.ObjectId(req.user?.userId!),
            name: req.user?.username || 'Staff'
          },
          sentAt: new Date(),
          isInternal: false
        });
      }

      // Publish WebSocket event (forma piatta: TicketEventHandler.handleTicketClosed
      // legge createdBy/title/closedAt/finalMessage a livello radice, non annidati)
      await redis.publish('ticket:events', JSON.stringify({
        eventType: 'ticket_closed',
        ticketId: ticket!._id.toString(),
        ticketNumber: ticket!._id.toString().slice(-6).toUpperCase(),
        title: ticket!.title,
        department: ticket!.department,
        createdBy: { id: ticket!.createdBy.toString() },
        resolution: closureData.resolution,
        closedBy: {
          id: req.user?.userId,
          name: req.user?.username
        },
        closedAt: ticket!.closedAt!.toISOString(),
        finalMessage: closureData.resolution,
        timestamp: new Date().toISOString()
      }));

      logger.info('Ticket closed', {
        ...auditInfo,
        ticketId,
        resolution: closureData.resolution,
        notifyUser: closureData.notifyUser
      });

      res.json(updateResponse(
        {
          ticketId: ticket!._id.toString(),
          status: 'closed'
        },
        'Ticket chiuso con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error closing ticket:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to close ticket',
        'CLOSE_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Add staff message to ticket
   * POST /admin/tickets/:id/messages
   */
  static async addTicketMessage(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const { content, isInternal } = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!content || content.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Message content is required',
          'MESSAGE_CONTENT_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (content.length > 5000) {
        res.status(400).json(errorResponse(
          'Message content too long (max 5000 characters)',
          'MESSAGE_TOO_LONG',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (ticket!.status === 'closed') {
        res.status(400).json(errorResponse(
          'Cannot add messages to closed tickets',
          'TICKET_CLOSED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Create the message
      const message = await TicketMessage.create({
        ticketId: new mongoose.Types.ObjectId(ticketId),
        content: content.trim(),
        sender: {
          type: 'staff',
          id: new mongoose.Types.ObjectId(req.user?.userId!),
          name: req.user?.username || 'Staff'
        },
        sentAt: new Date(),
        isInternal: Boolean(isInternal)
      });

      // Update ticket status based on current status and auto-assignment logic
      if (ticket!.status === 'waiting_user') {
        ticket!.status = 'in_progress';
      } else if (ticket!.status === 'open' && !isInternal) {
        // When staff responds to an open ticket with a non-internal message, it goes to in_progress
        ticket!.status = 'in_progress';

        // Auto-assign if not already assigned and autoAssign is requested
        const { autoAssign } = req.body;
        if (autoAssign && !ticket!.assignedTo) {
          ticket!.assignedTo = new mongoose.Types.ObjectId(req.user?.userId!);
          ticket!.assignedToName = req.user?.username || 'Staff';
          ticket!.assignedAt = new Date();
        }
      }

      // Update staff read timestamp
      ticket!.lastReadBy.staff = new Date();
      await ticket!.save();

      // Publish WebSocket event (only if not internal message)
      // Forma piatta: TicketEventHandler.handleTicketMessage legge
      // sender/content/createdBy.id a livello radice, non annidati sotto "message"
      if (!isInternal) {
        await redis.publish('ticket:events', JSON.stringify({
          eventType: 'ticket_message',
          ticketId: ticket!._id.toString(),
          ticketNumber: ticket!._id.toString().slice(-6).toUpperCase(),
          ticketTitle: ticket!.title,
          department: ticket!.department,
          createdBy: { id: ticket!.createdBy.toString() },
          messageId: message._id.toString(),
          content: content,
          sender: {
            type: 'staff',
            id: req.user?.userId,
            name: req.user?.username
          },
          isInternal: false,
          sentAt: message.sentAt.toISOString(),
          timestamp: new Date().toISOString()
        }));
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Staff message added to ticket', {
        ...auditInfo,
        ticketId,
        messageLength: content.length,
        isInternal: Boolean(isInternal)
      });

      res.json(createResponse(
        {
          messageId: message._id.toString(),
          ticketStatus: ticket!.status
        },
        'Messaggio aggiunto con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error adding ticket message:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to add message to ticket',
        'ADD_TICKET_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update ticket priority
   * PUT /admin/tickets/:id/priority
   */
  static async updateTicketPriority(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const priorityData: TicketPriorityUpdate = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!priorityData.priority || !validPriorities.includes(priorityData.priority)) {
        res.status(400).json(errorResponse(
          'Invalid priority level',
          'INVALID_PRIORITY',
          { validPriorities },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Only administrators can set critical priority
      if (priorityData.priority === 'critical' && !req.user?.characterRoles?.includes('amministratore')) {
        res.status(403).json(errorResponse(
          'Administrator role required to set critical priority',
          'CRITICAL_PRIORITY_REQUIRES_ADMIN',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const oldPriority = ticket!.priority;
      ticket!.priority = priorityData.priority;
      ticket!.lastReadBy.staff = new Date();

      // Add note about priority change
      const priorityChangeNote = `Priority changed from ${oldPriority} to ${priorityData.priority}${priorityData.reason ? ` - ${priorityData.reason}` : ''}`;

      if (ticket.internalNotes) {
        ticket!.internalNotes += `\n\n[PRIORITY CHANGE] ${priorityChangeNote}`;
      } else {
        ticket!.internalNotes = `[PRIORITY CHANGE] ${priorityChangeNote}`;
      }

      await ticket!.save();

      // Publish WebSocket event
      await redis.publish('ticket:events', JSON.stringify({
        eventType: 'ticket_priority_changed',
        ticketId: ticket!._id.toString(),
        ticketTitle: ticket!.title,
        department: ticket!.department,
        priorityChange: {
          oldPriority,
          newPriority: priorityData.priority,
          reason: priorityData.reason
        },
        changedBy: {
          id: req.user?.userId,
          name: req.user?.username
        }
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Ticket priority updated', {
        ...auditInfo,
        ticketId,
        oldPriority,
        newPriority: priorityData.priority,
        reason: priorityData.reason
      });

      res.json(updateResponse(
        {
          ticketId: ticket!._id.toString(),
          priority: priorityData.priority
        },
        'Priorità ticket aggiornata con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating ticket priority:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to update ticket priority',
        'UPDATE_TICKET_PRIORITY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get staff list (optionally filtered by department)
   * GET /admin/tickets/staff
   * GET /admin/tickets/staff?department=master
   */
  static async getStaffList(req: Request, res: Response): Promise<void> {
    try {
      const department = req.query.department as string;

      // Build query for staff members based on character roles
      let query: any = {
        canAccessAdminPanel: true,
        isActive: true,
        isBanned: false
      };

      // If department is specified, filter by roles that can access that department
      if (department && DEPARTMENT_ROLES_MAPPING[department as keyof typeof DEPARTMENT_ROLES_MAPPING]) {
        const requiredRoles = DEPARTMENT_ROLES_MAPPING[department as keyof typeof DEPARTMENT_ROLES_MAPPING];
        query.characterRoles = { $in: requiredRoles };
      } else {
        // Show all staff members with any character roles
        const allStaffRoles = Object.values(DEPARTMENT_ROLES_MAPPING).flat();
        query.characterRoles = { $in: allStaffRoles };
      }

      const staffMembers = await User.find(query)
        .select('_id username displayName characterRoles canAccessAdminPanel lastLoginAt')
        .sort({ username: 1 })
        .lean();

      // Transform to API format
      const transformedStaff = staffMembers.map((staff: any) => ({
        id: staff._id.toString(),
        username: staff.username,
        displayName: staff.displayName || staff.username,
        roles: staff.characterRoles || [],
        lastLoginAt: staff.lastLoginAt?.toISOString(),
        canAccessAdminPanel: staff.canAccessAdminPanel,
        // Determine which departments this staff member can access
        departments: Object.entries(DEPARTMENT_ROLES_MAPPING)
          .filter(([, requiredRoles]) =>
            requiredRoles.some(role => staff.characterRoles?.includes(role))
          )
          .map(([dept]) => dept)
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed staff list', {
        ...auditInfo,
        department,
        staffCount: transformedStaff.length
      });

      res.json(successResponse(
        {
          staff: transformedStaff,
          ...(department && { department })
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching staff list:', {
        error: error instanceof Error ? error.message : String(error),
        department: req.query.department
      });

      res.status(500).json(errorResponse(
        'Failed to fetch staff list',
        'FETCH_STAFF_LIST_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update internal note
   * PUT /admin/tickets/:id/internal-note
   */
  static async updateInternalNote(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const ticketId = req.params.id;
      const noteData: TicketInternalNote = req.body;

      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        res.status(400).json(errorResponse(
          'Formato ID ticket non valido',
          'INVALID_TICKET_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (noteData.note && noteData.note.length > 5000) {
        res.status(400).json(errorResponse(
          'Internal note too long (max 5000 characters)',
          'NOTE_TOO_LONG',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const ticket = await Ticket.findById(ticketId);

      if (!ticket) {
        res.status(404).json(errorResponse(
          'Ticket not found',
          'TICKET_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      ticket!.internalNotes = noteData.note?.trim() || '';
      ticket!.lastReadBy.staff = new Date();

      await ticket!.save();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Ticket internal note updated', {
        ...auditInfo,
        ticketId,
        noteLength: noteData.note?.length || 0
      });

      res.json(updateResponse(
        {
          ticketId: ticket!._id.toString(),
          updated: true
        },
        'Nota interna aggiornata con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating internal note:', {
        error: error instanceof Error ? error.message : String(error),
        ticketId: req.params.id
      });

      res.status(500).json(errorResponse(
        'Failed to update internal note',
        'UPDATE_INTERNAL_NOTE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
