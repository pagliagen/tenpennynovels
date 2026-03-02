import { Router } from 'express';
import { LocationChatsController } from '../controllers/LocationChatsController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// Chat messages in locations
router.post('/', AuthMiddleware.requireCharacterAuth, LocationChatsController.createMessage);
router.get('/:locationId', AuthMiddleware.requireCharacterAuth, LocationChatsController.getMessages);
router.patch('/:messageId', AuthMiddleware.requireCharacterAuth, LocationChatsController.updateMessage);
router.delete('/:messageId', AuthMiddleware.requireCharacterAuth, LocationChatsController.deleteMessage);

// Social conflicts (skill-based interactions)
router.post('/social-conflict', AuthMiddleware.requireCharacterAuth, LocationChatsController.createSocialConflict);

// Admin operations
router.delete('/:locationId/clear', AuthMiddleware.requireCharacterAuth, LocationChatsController.clearChat);

// Bot integration (requires BOT_API_KEY)
router.post('/bot', LocationChatsController.createBotMessage);

export default router;
