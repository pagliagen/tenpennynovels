import { Request, Response } from 'express';
import { Ticket } from '@database/models/Ticket';
import { User } from '@database/models/User';
import { NotificationService } from '@shared/services/NotificationService';
import { logger } from '../utils/logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

import { escapeRegex } from '@shared/utils/validation';

/**
 * TicketDashboardController
 * Admin-side operations for ticket management system
 *
 * Features:
 * - Dashboard stats for staff
 * - Advanced ticket filtering and search
 * - Manual assignment operations (take, release, reassign)
 * - Bulk operations
 * - Manual escalation override
 * - Department transfer
 * - Close/reopen tickets
 */

export class TicketDashboardController {
  /**
   * GET /admin/tickets/dashboard
   * Stats overview per staff dashboard
   */
  static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const staffId = req.user!.userId;
      const staffRoles = req.user!.characterRoles || [];

      logger.info('Fetching ticket dashboard', { staffId, staffRoles });

      // Departments accessibili da questo staff (basato su roles)
      const departments = getDepartmentsForRoles(staffRoles);

      const stats = {
        // My tickets
        myTickets: {
          total: await Ticket.countDocuments({ assignedTo: staffId }),
          byStatus: await Ticket.aggregate([
            { $match: { assignedTo: staffId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]),
          byPriority: await Ticket.aggregate([
            { $match: { assignedTo: staffId } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ]),
          unread: await Ticket.countDocuments({
            assignedTo: staffId,
            'lastReadBy.staff': { $exists: false }
          })
        },

        // Department queue (unassigned tickets in my departments)
        departmentQueue: {
          total: await Ticket.countDocuments({
            department: { $in: departments },
            assignedTo: null,
            status: 'open'
          }),
          byDepartment: await Ticket.aggregate([
            { $match: { department: { $in: departments }, assignedTo: null, status: 'open' } },
            { $group: { _id: '$department', count: { $sum: 1 } } }
          ]),
          byPriority: await Ticket.aggregate([
            { $match: { department: { $in: departments }, assignedTo: null, status: 'open' } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ])
        },

        // Escalated tickets
        escalated: {
          total: await Ticket.countDocuments({
            escalationLevel: { $gte: 1 },
            status: { $nin: ['closed'] }
          }),
          critical: await Ticket.countDocuments({
            escalationLevel: { $gte: 5 },
            status: { $nin: ['closed'] }
          })
        },

        // Recent activity
        recentlyUpdated: await Ticket.find({
          $or: [
            { assignedTo: staffId },
            { department: { $in: departments } }
          ],
          status: { $nin: ['closed'] }
        })
          .sort({ updatedAt: -1 })
          .limit(10)
          .select('title status priority department updatedAt createdByName escalationLevel')
          .lean()
      };

      res.json({ success: true, data: stats });
    } catch (error: any) {
      const err = error as Error;
      logger.error('Error fetching dashboard:', {
        error: err.message,
        staffId: req.user?.userId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare dashboard',
        'FETCH_DASHBOARD_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /admin/tickets
   * Lista ticket per staff con filtri avanzati
   */
  static async listTickets(req: Request, res: Response): Promise<void> {
    try {
      const staffId = req.user!.userId;
      const staffRoles = req.user!.characterRoles || [];
      const departments = getDepartmentsForRoles(staffRoles);

      const {
        status,
        priority,
        department,
        category,
        assignedTo,  // 'me', 'unassigned', 'any', staffId
        escalationLevel,
        search,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        page = '1',
        limit = '25'
      } = req.query;

      logger.info('Listing tickets', { staffId, filters: { status, priority, department, assignedTo } });

      // Build filter
      const filter: any = {};

      // Department access control
      if (!staffRoles.includes('amministratore')) {
        filter.department = { $in: departments };
      }

      // Status filter
      if (status) {
        filter.status = Array.isArray(status) ? { $in: status } : status;
      }

      // Priority filter
      if (priority) {
        filter.priority = Array.isArray(priority) ? { $in: priority } : priority;
      }

      // Department filter
      if (department) {
        filter.department = department;
      }

      // Category filter
      if (category) {
        filter.category = category;
      }

      // Assignment filter
      if (assignedTo === 'me') {
        filter.assignedTo = staffId;
      } else if (assignedTo === 'unassigned') {
        filter.assignedTo = null;
      } else if (assignedTo && assignedTo !== 'any') {
        filter.assignedTo = assignedTo;
      }

      // Escalation filter
      if (escalationLevel) {
        if (escalationLevel === 'any') {
          filter.escalationLevel = { $gte: 1 };
        } else {
          filter.escalationLevel = parseInt(escalationLevel as string);
        }
      }

      // Search filter (title, createdByName)
      if (search) {
        const escapedSearch = escapeRegex(search as string);
        filter.$or = [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { createdByName: { $regex: escapedSearch, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      const sortOptions: any = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

      const [tickets, total] = await Promise.all([
        Ticket.find(filter)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNum)
          .select('title status priority category department escalationLevel createdAt updatedAt createdByName assignedTo assignedToName lastReadBy')
          .lean(),
        Ticket.countDocuments(filter)
      ]);

      res.json(listResponse(
        tickets.map(t => ({
          ...t,
          id: t._id.toString(),
          unread: !t.lastReadBy?.staff
        })),
        {
          currentPage: pageNum,
          pageSize: limitNum,
          totalItems: total,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: skip + tickets.length < total,
          hasPreviousPage: pageNum > 1
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Error listing tickets:', {
        error: err.message,
        staffId: req.user?.userId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i ticket',
        'LIST_TICKETS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/tickets/:id/take
   * Staff prende in carico ticket (manual assignment)
   */
  static async takeTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const staffId = req.user!.userId;
      const staffName = req.user!.username;

      logger.info('Taking ticket', { ticketId: id, staffId });

      const ticket = await Ticket.findById(id);
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

      // Check if already assigned
      if (ticket.assignedTo) {
        res.status(400).json(errorResponse(
          `Ticket già assegnato a ${ticket.assignedToName}`,
          'ALREADY_ASSIGNED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Assign using model method
      await ticket.assignTo(staffId, staffName);

      // Notify character owner
      try {
        await NotificationService.notifyTicketAssigned(ticket, req.user);
      } catch (notifyError) {
        logger.error('Failed to send ticket assigned notification:', notifyError);
      }

      logger.info('Ticket taken successfully', { ticketId: id, staffId });

      res.json(updateResponse(
        { ticket: { id: ticket._id.toString(), assignedToName: staffName, status: ticket.status } },
        `Ticket assegnato a te`,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Error taking ticket:', {
        error: err.message,
        ticketId: req.params.id,
        staffId: req.user?.userId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile prendere in carico il ticket',
        'TAKE_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/tickets/:id/release
   * Staff rilascia ticket (torna a unassigned)
   */
  static async releaseTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const staffId = req.user!.userId;

      logger.info('Releasing ticket', { ticketId: id, staffId, reason });

      const ticket = await Ticket.findById(id);
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

      // Check if assigned to this staff
      if (!ticket.assignedTo || ticket.assignedTo.toString() !== staffId) {
        res.status(403).json(errorResponse(
          'Non sei assegnato a questo ticket',
          'NOT_ASSIGNED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Release using model method
      await ticket.release();

      logger.info('Ticket released successfully', { ticketId: id });

      res.json(updateResponse(
        { ticket: { id: ticket._id.toString(), status: 'open' } },
        'Ticket rilasciato alla coda',
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Error releasing ticket:', {
        error: err.message,
        ticketId: req.params.id,
        staffId: req.user?.userId,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile rilasciare il ticket',
        'RELEASE_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/tickets/:id/reassign
   * Reassign ticket to another staff member
   */
  static async reassignTicket(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { toStaffId } = req.body;

      if (!toStaffId) {
        res.status(400).json(errorResponse(
          'toStaffId è obbligatorio',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info('Reassigning ticket', { ticketId: id, toStaffId });

      const [ticket, targetStaff] = await Promise.all([
        Ticket.findById(id),
        User.findById(toStaffId)
      ]);

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

      if (!targetStaff) {
        res.status(404).json(errorResponse(
          'Staff destinatario non trovato',
          'STAFF_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Assign using model method
      await ticket.assignTo(toStaffId, targetStaff.username);

      // Notify new assigned staff
      try {
        await NotificationService.notifyTicketAssigned(ticket, targetStaff);
      } catch (notifyError) {
        logger.error('Failed to send reassign notification:', notifyError);
      }

      logger.info('Ticket reassigned successfully', { ticketId: id, toStaffId });

      res.json(updateResponse(
        { ticket: { id: ticket._id.toString(), assignedToName: targetStaff.username } },
        `Ticket riassegnato a ${targetStaff.username}`,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Error reassigning ticket:', {
        error: err.message,
        ticketId: req.params.id,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile riassegnare il ticket',
        'REASSIGN_TICKET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/tickets/bulk-assign
   * Bulk assign tickets to staff
   */
  static async bulkAssign(req: Request, res: Response): Promise<void> {
    try {
      const { ticketIds, toStaffId } = req.body;

      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        res.status(400).json(errorResponse(
          'ticketIds array è obbligatorio',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!toStaffId) {
        res.status(400).json(errorResponse(
          'toStaffId è obbligatorio',
          'VALIDATION_ERROR',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      logger.info('Bulk assigning tickets', { ticketIds, toStaffId });

      const targetStaff = await User.findById(toStaffId);
      if (!targetStaff) {
        res.status(404).json(errorResponse(
          'Staff destinatario non trovato',
          'STAFF_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Update all tickets
      const result = await Ticket.updateMany(
        { _id: { $in: ticketIds }, assignedTo: null },  // Only unassigned
        {
          $set: {
            assignedTo: toStaffId,
            assignedToName: targetStaff.username,
            assignedAt: new Date(),
            status: 'assigned'
          }
        }
      );

      // Notify staff
      try {
        await NotificationService.send({
          recipientType: 'staff',
          recipientId: toStaffId,
          namespace: 'ticket',
          type: 'ticket:bulk_assigned',
          title: `${result.modifiedCount} ticket assegnati a te`,
          message: `Assegnazione massiva da ${req.user!.username}`,
          data: { ticketIds, count: result.modifiedCount },
          channels: ['in_app', 'websocket'],
          priority: 'normal',
          actionUrl: '/admin/tickets?assignedTo=me'
        });
      } catch (notifyError) {
        logger.error('Failed to send bulk assign notification:', notifyError);
      }

      logger.info('Bulk assignment completed', { count: result.modifiedCount });

      res.json(updateResponse(
        { assignedCount: result.modifiedCount },
        `${result.modifiedCount} ticket assegnati a ${targetStaff.username}`,
        getRequestId(req)
      ));
    } catch (error: any) {
      const err = error as Error;
      logger.error('Error bulk assigning tickets:', {
        error: err.message,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile assegnare i ticket in massa',
        'BULK_ASSIGN_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}

/**
 * Helper function to get departments accessible by staff roles
 */
function getDepartmentsForRoles(roles: string[]): string[] {
  if (roles.includes('amministratore')) {
    return ['master', 'technical', 'moderation', 'administration', 'general'];
  }
  if (roles.includes('master')) {
    return ['master', 'general'];
  }
  if (roles.includes('moderatore')) {
    return ['moderation', 'general'];
  }
  return ['general'];
}
