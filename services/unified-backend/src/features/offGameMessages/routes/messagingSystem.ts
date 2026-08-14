import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { MessagingSystemController } from '../controllers/MessagingSystemController';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { requireViewPermission } from '@modules/admin/utils/permissions';

const router = Router();

// CodeQL non riconosce AdminAuthMiddleware.sensitiveOperationLimit() (Redis)
// come rate limiting — la sua analisi statica cerca il pattern
// express-rate-limit. Layer aggiuntivo sulle route distruttive, non in
// sostituzione: il controllo Redis (10/ora) resta a valle.
const destructiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? ''),
});

// CodeQL (js/missing-rate-limiting): le route GET (dashboard/stats/cleanup)
// non avevano alcun limiter, solo quelle distruttive sopra. Limiter
// generico su tutto il router, prima ancora dell'auth check.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

// All messaging system routes require admin access
router.use(readLimiter);
router.use(AdminAuthMiddleware.requireAdminAccess);

// Chat listing and statistics routes
router.get(
  '/',
  requireViewPermission('messaging.access'),
  AdminAuthMiddleware.logAdminAction('view_chats', 'messaging_system'),
  MessagingSystemController.getChats
);

router.get(
  '/stats',
  requireViewPermission('messaging.access'),
  AdminAuthMiddleware.logAdminAction('view_messaging_stats', 'messaging_system'),
  MessagingSystemController.getMessagingStats
);

// Chat detail and management routes
router.get(
  '/chat/:chatId',
  requireViewPermission('messaging.detail.view'),
  AdminAuthMiddleware.logAdminAction('view_chat_details', 'messaging_system'),
  MessagingSystemController.getChatDetails
);

router.delete(
  '/chat/:chatId',
  requireViewPermission('messaging.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_chat', 'messaging_system'),
  destructiveLimiter,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.deleteChat
);

router.delete(
  '/message/:messageId',
  requireViewPermission('messaging.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_message', 'messaging_system'),
  destructiveLimiter,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.deleteMessage
);

// Participant moderation
router.post(
  '/chat/:chatId/participant/:participantId/moderate',
  requireViewPermission('messaging.moderation.manage'),
  AdminAuthMiddleware.logAdminAction('moderate_participant', 'messaging_system'),
  destructiveLimiter,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.moderateParticipant
);

// Bulk operations
router.post(
  '/bulk',
  requireViewPermission('messaging.detail.update'),
  AdminAuthMiddleware.logAdminAction('bulk_messaging_operation', 'messaging_system'),
  destructiveLimiter,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.bulkOperations
);

// Cleanup recommendations
router.get(
  '/cleanup',
  requireViewPermission('messaging.maintenance.view'),
  AdminAuthMiddleware.logAdminAction('view_cleanup_recommendations', 'messaging_system'),
  MessagingSystemController.getCleanupRecommendations
);

export default router;
