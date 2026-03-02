import { Router } from 'express';
import { TicketManagementController } from '../controllers/TicketManagementController';
import { TicketDashboardController } from '../controllers/TicketDashboardController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin authentication to all ticket management routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * Dashboard & Stats Endpoints (NEW)
 */

// GET /admin/tickets/dashboard - Dashboard stats overview
router.get('/dashboard',
  AdminAuthMiddleware.logAdminAction('view_ticket_dashboard', 'ticket_management'),
  TicketDashboardController.getDashboard
);

/**
 * Ticket Listing Endpoints
 */

// GET /admin/tickets - Get all tickets with filters and pagination
router.get('/', 
  AdminAuthMiddleware.logAdminAction('view_all_tickets', 'ticket_management'),
  TicketManagementController.getAllTickets
);

// GET /admin/tickets/my - Get tickets assigned to current admin
router.get('/my', 
  AdminAuthMiddleware.logAdminAction('view_my_tickets', 'ticket_management'),
  TicketManagementController.getMyTickets
);

// GET /admin/tickets/department - Get tickets from current admin's departments
router.get('/department', 
  AdminAuthMiddleware.logAdminAction('view_department_tickets', 'ticket_management'),
  TicketManagementController.getDepartmentTickets
);

// GET /admin/tickets/department/:dept - Get tickets from specific department
router.get('/department/:dept', 
  AdminAuthMiddleware.logAdminAction('view_specific_department_tickets', 'ticket_management'),
  TicketManagementController.getSpecificDepartmentTickets
);

// GET /admin/tickets/stats - Get ticket statistics (admin only)
router.get('/stats', 
  AdminAuthMiddleware.requireGranularPermission('tickets.view_stats'),
  AdminAuthMiddleware.logAdminAction('view_ticket_statistics', 'ticket_management'),
  TicketManagementController.getTicketStats
);

// GET /admin/tickets/staff - Get staff list (optionally filtered by department)
router.get('/staff', 
  AdminAuthMiddleware.logAdminAction('view_staff_list', 'ticket_management'),
  TicketManagementController.getStaffList
);

/**
 * Individual Ticket Operations
 */

// GET /admin/tickets/:id - Get detailed ticket information
router.get('/:id', 
  AdminAuthMiddleware.logAdminAction('view_ticket_details', 'ticket_management'),
  TicketManagementController.getTicketDetails
);

// PUT /admin/tickets/:id/assign - Assign ticket to staff member (first assignment)
router.put('/:id/assign', 
  AdminAuthMiddleware.logAdminAction('assign_ticket', 'ticket_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  TicketManagementController.assignTicket
);

// PUT /admin/tickets/:id/reassign - Reassign ticket from one staff to another
router.put('/:id/reassign', 
  AdminAuthMiddleware.logAdminAction('reassign_ticket', 'ticket_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  TicketManagementController.reassignTicket
);

// PUT /admin/tickets/:id/transfer - Transfer ticket to another department
router.put('/:id/transfer', 
  AdminAuthMiddleware.logAdminAction('transfer_ticket', 'ticket_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  TicketManagementController.transferTicket
);

// PUT /admin/tickets/:id/close - Close ticket
router.put('/:id/close', 
  AdminAuthMiddleware.logAdminAction('close_ticket', 'ticket_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  TicketManagementController.closeTicket
);

// POST /admin/tickets/:id/messages - Add staff message to ticket
router.post('/:id/messages', 
  AdminAuthMiddleware.logAdminAction('add_ticket_message', 'ticket_management'),
  TicketManagementController.addTicketMessage
);

// PUT /admin/tickets/:id/priority - Update ticket priority
router.put('/:id/priority', 
  AdminAuthMiddleware.logAdminAction('update_ticket_priority', 'ticket_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  TicketManagementController.updateTicketPriority
);

// PUT /admin/tickets/:id/internal-note - Update internal note
router.put('/:id/internal-note',
  AdminAuthMiddleware.logAdminAction('update_internal_note', 'ticket_management'),
  TicketManagementController.updateInternalNote
);

/**
 * Self-Assignment Operations (NEW)
 */

// POST /admin/tickets/:id/take - Staff takes ticket (self-assignment)
router.post('/:id/take',
  AdminAuthMiddleware.logAdminAction('take_ticket', 'ticket_management'),
  TicketDashboardController.takeTicket
);

// POST /admin/tickets/:id/release - Staff releases ticket (back to queue)
router.post('/:id/release',
  AdminAuthMiddleware.logAdminAction('release_ticket', 'ticket_management'),
  TicketDashboardController.releaseTicket
);

/**
 * Bulk Operations (NEW)
 */

// POST /admin/tickets/bulk-assign - Bulk assign multiple tickets
router.post('/bulk-assign',
  AdminAuthMiddleware.logAdminAction('bulk_assign_tickets', 'ticket_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  TicketDashboardController.bulkAssign
);

export default router;