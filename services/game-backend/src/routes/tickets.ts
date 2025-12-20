import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { TicketController } from '../controllers/TicketController';

const router = Router();

// Ticket routes - tutti richiedono autenticazione character (dual-cookie)
// Solo personaggi APPROVED possono creare ticket (verificato nel controller)

/**
 * GET /game/tickets
 * Lista ticket del personaggio corrente
 * Query params: status?, limit?, page?
 */
router.get('/tickets', 
  AuthMiddleware.requireCharacterAuth,
  TicketController.getUserTickets
);

/**
 * POST /game/tickets
 * Crea nuovo ticket
 * Body: { title: string, category: TicketCategory, content: string }
 * Permission: Solo personaggi APPROVED
 */
router.post('/tickets',
  AuthMiddleware.requireCharacterAuth,
  TicketController.createTicket
);

/**
 * GET /game/tickets/categories
 * Lista categorie disponibili per la creazione ticket
 * Include mapping automatico categoria→dipartimento e priorità
 * Endpoint pubblico (per dropdown nella UI)
 */
router.get('/tickets/categories',
  AuthMiddleware.requireCharacterAuth, // Require auth per consistenza
  TicketController.getTicketCategories
);

/**
 * GET /game/tickets/unread-count
 * Contatore notifiche non lette per badge UI
 * Conta solo messaggi staff non letti dal personaggio corrente
 */
router.get('/tickets/unread-count',
  AuthMiddleware.requireCharacterAuth,
  TicketController.getUnreadTicketsCount
);

/**
 * GET /game/tickets/:id
 * Dettagli singolo ticket (solo proprietario)
 * Aggiorna automaticamente lastReadBy.character
 */
router.get('/tickets/:id',
  AuthMiddleware.requireCharacterAuth,
  TicketController.getTicketDetails
);

/**
 * PUT /game/tickets/:id/reopen
 * Riapri ticket chiuso (solo proprietario)
 * Body: { reason?: string }
 */
router.put('/tickets/:id/reopen',
  AuthMiddleware.requireCharacterAuth,
  TicketController.reopenTicket
);

/**
 * POST /game/tickets/:id/messages
 * Aggiungi messaggio a ticket esistente
 * Body: { content: string }
 * Solo proprietario del ticket, solo se non chiuso
 */
router.post('/tickets/:id/messages',
  AuthMiddleware.requireCharacterAuth,
  TicketController.addTicketMessage
);

/**
 * GET /game/tickets/:id/messages
 * Lista messaggi del ticket (solo proprietario, escluse note interne)
 * Segna automaticamente come letti tutti i messaggi staff
 */
router.get('/tickets/:id/messages',
  AuthMiddleware.requireCharacterAuth,
  TicketController.getTicketMessages
);

/**
 * PUT /game/tickets/:id/read
 * Segna ticket e tutti i messaggi staff come letti dal personaggio
 */
router.put('/tickets/:id/read',
  AuthMiddleware.requireCharacterAuth,
  TicketController.markTicketAsRead
);

export default router;