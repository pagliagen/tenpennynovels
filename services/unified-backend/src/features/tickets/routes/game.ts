import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { TicketController } from '../controllers/TicketController';
import { TicketNotificationController } from '../controllers/TicketNotificationController';

const router = Router();

// CodeQL (js/missing-rate-limiting): nessun limiter express-rate-limit
// riconoscibile su queste route — il limiter globale applicato in
// app.ts/bootstrapFeatures non è tracciabile staticamente fin qui.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

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
 * PUT /game/tickets/:id/close
 * Chiudi ticket (solo proprietario, solo se non già chiuso)
 * Body: { reason?: string }
 */
router.put('/tickets/:id/close',
  AuthMiddleware.requireCharacterAuth,
  TicketController.closeTicket
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

// ========== NOTIFICATION ROUTES ==========

/**
 * GET /game/tickets/notifications
 * Lista notifiche ticket per character
 * Query params: unreadOnly?, limit?, offset?
 */
router.get('/tickets/notifications',
  AuthMiddleware.requireCharacterAuth,
  TicketNotificationController.listForCharacter
);

/**
 * GET /game/tickets/notifications/unread-count
 * Contatore notifiche non lette (per badge UI)
 */
router.get('/tickets/notifications/unread-count',
  AuthMiddleware.requireCharacterAuth,
  TicketNotificationController.getUnreadCount
);

/**
 * PUT /game/tickets/notifications/:id/read
 * Mark single notification as read
 */
router.put('/tickets/notifications/:id/read',
  AuthMiddleware.requireCharacterAuth,
  TicketNotificationController.markRead
);

/**
 * PUT /game/tickets/notifications/read-all
 * Mark all ticket notifications as read
 */
router.put('/tickets/notifications/read-all',
  AuthMiddleware.requireCharacterAuth,
  TicketNotificationController.markAllRead
);

/**
 * DELETE /game/tickets/notifications/:id
 * Delete single notification
 */
router.delete('/tickets/notifications/:id',
  AuthMiddleware.requireCharacterAuth,
  TicketNotificationController.deleteNotification
);

export default router;
