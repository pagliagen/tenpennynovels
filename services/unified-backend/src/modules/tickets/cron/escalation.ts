import cron from 'node-cron';
import { Ticket } from '@database/models/Ticket';
import { NotificationService } from '@shared/services/NotificationService';
import { logger } from '../logger';

/**
 * Ticket Escalation CRON Job
 *
 * Runs every hour to automatically escalate tickets that haven't received
 * timely responses or updates according to SLA rules.
 *
 * Escalation Rules:
 * 1. Tickets open/assigned > 24h without staff response → escalate +1
 * 2. Tickets in_progress > 48h without any update → escalate +1
 * 3. Max escalation level: 10
 * 4. Auto-bump priority if escalationLevel >= 5 (to 'high' or 'critical' if >= 8)
 * 5. Notify character owner on escalation
 * 6. Notify administrators if escalationLevel >= 5 (requires urgent attention)
 *
 * Schedule: Every hour at minute 0 (cron: "0 * * * *")
 */

// Run every hour
const escalationJob = cron.schedule('0 * * * *', async () => {
  logger.info('[TicketEscalation] Starting escalation check...');

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Rule 1: Tickets open/assigned > 24h without staff response
    // These are tickets that staff has never read
    const ticketsNoResponse24h = await Ticket.find({
      status: { $in: ['open', 'assigned'] },
      createdAt: { $lt: twentyFourHoursAgo },
      'lastReadBy.staff': { $exists: false }  // Staff has never read
    });

    logger.info(`[TicketEscalation] Found ${ticketsNoResponse24h.length} tickets without staff response > 24h`);

    // Rule 2: Tickets in_progress > 48h without any update
    // These are tickets that were being worked on but stalled
    const ticketsStalled48h = await Ticket.find({
      status: 'in_progress',
      updatedAt: { $lt: fortyEightHoursAgo }
    });

    logger.info(`[TicketEscalation] Found ${ticketsStalled48h.length} tickets stalled > 48h`);

    // Combine both sets (avoid duplicates)
    const ticketIdsToEscalate = new Set<string>();
    [...ticketsNoResponse24h, ...ticketsStalled48h].forEach(ticket => {
      ticketIdsToEscalate.add(ticket._id.toString());
    });

    const ticketsToEscalate = await Ticket.find({
      _id: { $in: Array.from(ticketIdsToEscalate) }
    });

    logger.info(`[TicketEscalation] Processing ${ticketsToEscalate.length} unique tickets for escalation`);

    let escalatedCount = 0;
    let criticalEscalationsCount = 0;

    for (const ticket of ticketsToEscalate) {
      const oldLevel = ticket.escalationLevel || 0;
      const newLevel = Math.min(oldLevel + 1, 10);  // Max level 10

      // Determine escalation reason
      let reason = '';
      if (ticket.status === 'in_progress' && ticket.updatedAt && ticket.updatedAt < fortyEightHoursAgo) {
        reason = 'Automatic escalation: No update in 48+ hours (ticket stalled)';
      } else if (['open', 'assigned'].includes(ticket.status) && !ticket.lastReadBy?.staff) {
        reason = 'Automatic escalation: No staff response in 24+ hours (SLA breach)';
      } else {
        reason = 'Automatic escalation: SLA threshold exceeded';
      }

      // Update ticket
      ticket.escalationLevel = newLevel;
      ticket.escalatedAt = now;

      // Add to escalation history
      if (!ticket.escalationHistory) {
        ticket.escalationHistory = [];
      }
      ticket.escalationHistory.push({
        fromLevel: oldLevel,
        toLevel: newLevel,
        escalatedAt: now,
        reason
      });

      // Auto-bump priority if escalation >= 5
      const oldPriority = ticket.priority;
      if (newLevel >= 8 && ticket.priority !== 'critical') {
        ticket.priority = 'critical';
        logger.info(`[TicketEscalation] Ticket ${ticket._id}: Priority bumped ${oldPriority} → critical (level ${newLevel})`);
      } else if (newLevel >= 5 && ticket.priority === 'low') {
        ticket.priority = 'medium';
        logger.info(`[TicketEscalation] Ticket ${ticket._id}: Priority bumped ${oldPriority} → medium (level ${newLevel})`);
      } else if (newLevel >= 5 && ticket.priority === 'medium') {
        ticket.priority = 'high';
        logger.info(`[TicketEscalation] Ticket ${ticket._id}: Priority bumped ${oldPriority} → high (level ${newLevel})`);
      }

      await ticket.save();
      escalatedCount++;

      logger.info(`[TicketEscalation] Escalated ticket ${ticket._id}: level ${oldLevel} → ${newLevel} (${reason})`);

      // Notify character owner
      try {
        await NotificationService.notifyTicketEscalated(ticket, newLevel);
        logger.info(`[TicketEscalation] Notified character ${ticket.createdBy} about escalation`);
      } catch (notifyError) {
        logger.error(`[TicketEscalation] Failed to notify character for ticket ${ticket._id}:`, notifyError);
      }

      // Alert supervisors if escalation level >= 5
      if (newLevel >= 5) {
        criticalEscalationsCount++;
        try {
          await NotificationService.send({
            recipientType: 'role',
            recipientRole: 'amministratore',  // Notify all administrators
            namespace: 'ticket',
            type: 'ticket:escalated_high',
            title: `URGENT: Ticket Escalated to Level ${newLevel}`,
            message: `Ticket requires immediate attention | Category: ${ticket.category} | Priority: ${ticket.priority}`,
            data: {
              ticketId: ticket._id,
              ticketNumber: ticket._id.toString().slice(-6).toUpperCase(), // Last 6 chars as ticket number
              ticketPriority: ticket.priority,
              ticketCategory: ticket.category,
              escalationLevel: newLevel,
              triggeredBy: {
                type: 'system',
                name: 'Escalation CRON'
              }
            },
            channels: ['in_app', 'websocket'],
            priority: 'urgent',
            actionUrl: `/admin/tickets/${ticket._id}`
          });
          logger.info(`[TicketEscalation] Alerted administrators about critical escalation (level ${newLevel})`);
        } catch (alertError) {
          logger.error(`[TicketEscalation] Failed to alert administrators for ticket ${ticket._id}:`, alertError);
        }
      }
    }

    logger.info(`[TicketEscalation] Completed: ${escalatedCount} tickets escalated, ${criticalEscalationsCount} critical alerts sent`);
  } catch (error) {
    logger.error('[TicketEscalation] Error during escalation check:', error);
  }
});

// Start the CRON job
escalationJob.start();
logger.info('[TicketEscalation] CRON job started (runs every hour at minute 0)');

export default escalationJob;
