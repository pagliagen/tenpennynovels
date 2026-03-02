import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';
import botRoutes from './bots';
import syncRoutes from './sync';

const router = Router();

// Health check routes (no auth required)
router.get('/health', HealthController.health);
router.get('/health/ready', HealthController.ready);
router.get('/health/live', HealthController.live);

// Bot management routes (admin API key required on each route)
router.use(botRoutes);

// Sync routes (webhook endpoints) - no auth required
router.use(syncRoutes);

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'BotAI Backend',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

export default router;
