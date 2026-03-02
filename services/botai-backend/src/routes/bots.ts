import { Router } from 'express';
import { BotController } from '../controllers/BotController';
import { requireAdminApiKey } from '../middleware/auth';

const router = Router();

// All bot routes require admin API key (applied individually to avoid affecting other routes)

// Bot CRUD operations
router.post('/bots', requireAdminApiKey, BotController.createBot);
router.post('/bots/generate', requireAdminApiKey, BotController.generateBot);
router.get('/bots', requireAdminApiKey, BotController.getBots);
router.get('/bots/:botId', requireAdminApiKey, BotController.getBot);
router.put('/bots/:botId', requireAdminApiKey, BotController.updateBot);
router.delete('/bots/:botId', requireAdminApiKey, BotController.deleteBot);

// Bot actions
router.post('/bots/:botId/activate', requireAdminApiKey, BotController.activateBot);
router.patch('/bots/:botId/emotional-state', requireAdminApiKey, BotController.updateEmotionalState);

// Bot-Location management
router.post('/bots/:botId/assign-locations', requireAdminApiKey, BotController.assignLocations);
router.delete('/bots/:botId/unassign-locations', requireAdminApiKey, BotController.unassignLocations);
router.get('/bots/:botId/locations', requireAdminApiKey, BotController.getBotLocations);
router.get('/locations/:locationId/bots', requireAdminApiKey, BotController.getLocationBots);

export default router;
