import cron from 'node-cron';
import { Ticket } from '../../../database/models';
import { redisService } from '../utils/redis';
import { logger } from '../utils/logger';

interface EscalationConfig {
  [category: string]: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    escalationHours: number;
  };
}

// Mapping categoria → priorità e tempo di escalation (in ore)
const ESCALATION_CONFIG: EscalationConfig = {
  // CRITICA (6h escalation)
  'game_bug_report': { priority: 'critical', escalationHours: 6 },
  'performance_problem': { priority: 'critical', escalationHours: 6 },
  'websocket_problem': { priority: 'critical', escalationHours: 6 },

  // ALTA (24h escalation)
  'character_access_problem': { priority: 'high', escalationHours: 24 },
  'location_chat_problem': { priority: 'high', escalationHours: 24 },
  'offgame_chat_problem': { priority: 'high', escalationHours: 24 },
  'postal_system_problem': { priority: 'high', escalationHours: 24 },
  'user_report': { priority: 'high', escalationHours: 24 },

  // MEDIA (48h escalation)  
  'character_approval': { priority: 'medium', escalationHours: 48 },
  'character_sheet_review': { priority: 'medium', escalationHours: 48 },
  'location_problem': { priority: 'medium', escalationHours: 48 },
  'private_location_access': { priority: 'medium', escalationHours: 48 },

  // BASSA (5 giorni escalation)
  'character_status_change': { priority: 'low', escalationHours: 120 },
  'corporation_join_request': { priority: 'low', escalationHours: 120 },
  'corporation_management_problem': { priority: 'low', escalationHours: 120 },
  'group_chat_request': { priority: 'low', escalationHours: 120 },
  'general_support': { priority: 'low', escalationHours: 120 },
  'information_request': { priority: 'low', escalationHours: 120 },

  // BASSA (7 giorni escalation)
  'location_event_creation': { priority: 'low', escalationHours: 168 },
  'new_location_request': { priority: 'low', escalationHours: 168 },
  'new_corporation_request': { priority: 'low', escalationHours: 168 },
  'improvement_suggestion': { priority: 'low', escalationHours: 168 },
};

export class EscalationService {
  private isRunning = false;

  /**
   * Avvia il sistema di escalation automatica con cron job
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Escalation service is already running');
      return;
    }

    // Controlla escalation ogni ora
    cron.schedule('0 * * * *', async () => {
      await this.processEscalations();
    });

    this.isRunning = true;
    logger.info('Escalation service started with hourly checks');
  }

  /**
   * Ferma il servizio di escalation
   */
  stop(): void {
    this.isRunning = false;
    logger.info('Escalation service stopped');
  }

  /**
   * Processa le escalation automatiche per tutti i ticket
   */
  async processEscalations(): Promise<void> {
    try {
      logger.info('Starting escalation process...');

      // Trova tutti i ticket aperti che potrebbero necessitare escalation
      const tickets = await Ticket.find({
        status: { $in: ['open', 'assigned', 'in_progress'] },
        escalationLevel: { $lte: 1 } // Max 2 escalation levels (0->1->2)
      });

      let escalatedCount = 0;

      for (const ticket of tickets) {
        const shouldEscalate = await this.shouldEscalateTicket(ticket);
        
        if (shouldEscalate) {
          await this.escalateTicket(ticket);
          escalatedCount++;
        }
      }

      logger.info(`Escalation process completed. Escalated ${escalatedCount} tickets`);

    } catch (error: any) {
      logger.error('Error during escalation process:', error);
    }
  }

  /**
   * Determina se un ticket deve essere escalato
   */
  private async shouldEscalateTicket(ticket: any): Promise<boolean> {
    const config = ESCALATION_CONFIG[ticket.category];
    if (!config) {
      logger.debug(`No escalation config for category: ${ticket.category}`);
      return false;
    }

    const now = new Date();
    const createdAt = new Date(ticket.createdAt);
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Se già escalato, controlla se serve un'ulteriore escalation
    if (ticket.escalationLevel > 0 && ticket.escalatedAt) {
      const escalatedAt = new Date(ticket.escalatedAt);
      const hoursSinceEscalation = (now.getTime() - escalatedAt.getTime()) / (1000 * 60 * 60);
      
      // Seconda escalation dopo ulteriori 50% del tempo originale
      const secondEscalationHours = config.escalationHours * 1.5;
      return ticket.escalationLevel === 1 && hoursSinceEscalation >= secondEscalationHours;
    }

    // Prima escalation basata sul tempo configurato
    return hoursSinceCreation >= config.escalationHours;
  }

  /**
   * Escala un ticket aumentando il livello di escalation
   */
  private async escalateTicket(ticket: any): Promise<void> {
    try {
      const previousLevel = ticket.escalationLevel || 0;
      const newLevel = Math.min(previousLevel + 1, 2); // Max level 2

      // Aggiorna il ticket
      const updatedTicket = await Ticket.findOneAndUpdate(
        { _id: ticket._id },
        {
          $set: {
            escalationLevel: newLevel,
            escalatedAt: new Date(),
            status: ticket.status === 'open' ? 'assigned' : ticket.status,
            // Auto-assign priorità se non già impostata correttamente
            priority: this.determinePriorityForEscalation(ticket.category, newLevel)
          },
          $push: {
            escalationHistory: {
              fromLevel: previousLevel,
              toLevel: newLevel,
              escalatedAt: new Date(),
              reason: `Automatic escalation due to SLA breach (${this.getEscalationHours(ticket.category)}h)`
            }
          }
        },
        { new: true }
      );

      if (updatedTicket) {
        // Pubblica evento Redis per notificare lo staff
        await redisService.publishManagementEvent('ticket:events', {
          eventType: 'ticket_escalated',
          ticketId: updatedTicket._id.toString(),
          ticketTitle: updatedTicket.title,
          department: updatedTicket.department,
          escalation: {
            fromLevel: previousLevel,
            toLevel: newLevel,
            reason: 'Automatic SLA escalation'
          },
          timestamp: new Date().toISOString()
        });

        logger.warn(`Ticket ${ticket._id} escalated from level ${previousLevel} to ${newLevel}`, {
          ticketId: ticket._id.toString(),
          category: ticket.category,
          department: ticket.department,
          hoursSinceCreation: this.getHoursSinceDate(ticket.createdAt)
        });
      }

    } catch (error: any) {
      logger.error(`Error escalating ticket ${ticket._id}:`, error);
    }
  }

  /**
   * Determina la priorità per un ticket escalato
   */
  private determinePriorityForEscalation(category: string, escalationLevel: number): string {
    const config = ESCALATION_CONFIG[category];
    if (!config) return 'medium';

    // Aumenta priorità con escalation
    switch (escalationLevel) {
      case 1:
        return config.priority === 'low' ? 'medium' : 
               config.priority === 'medium' ? 'high' : 'critical';
      case 2:
        return config.priority === 'critical' ? 'critical' : 'high';
      default:
        return config.priority;
    }
  }

  /**
   * Ottiene le ore di escalation per una categoria
   */
  private getEscalationHours(category: string): number {
    return ESCALATION_CONFIG[category]?.escalationHours || 48;
  }

  /**
   * Calcola le ore trascorse da una data
   */
  private getHoursSinceDate(date: Date): number {
    const now = new Date();
    return (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60);
  }

  /**
   * Test manuale dell'escalation per debugging
   */
  async testEscalation(): Promise<void> {
    logger.info('Running manual escalation test...');
    await this.processEscalations();
    logger.info('Manual escalation test completed');
  }
}

// Singleton instance
export const escalationService = new EscalationService();