import { Request, Response } from 'express';
import { Ticket } from '../models/Ticket';
import { User } from '@database/models/User';
import { NotificationService } from '../services/NotificationService';
import { logger } from '@modules/admin/utils/logger';
import { errorResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

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
