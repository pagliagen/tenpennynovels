import { Router } from 'express';
import { OnGameMailController } from '../controllers/OnGameMailController';

const router = Router();

// ==============================
// OnGame Mail Routes
// ==============================

// List OnGame messages with filters
router.get('/ongame', OnGameMailController.getMessages);

// Get OnGame statistics
router.get('/ongame/stats', OnGameMailController.getStats);

// Get single OnGame message
router.get('/ongame/:id', OnGameMailController.getMessage);

// Hard delete OnGame message (permanent)
router.delete('/ongame/:id/hard', OnGameMailController.hardDelete);

// Soft delete OnGame message (both sides)
router.post('/ongame/:id/soft-delete', OnGameMailController.softDelete);

// Bulk delete OnGame messages
router.post('/ongame/bulk-delete', OnGameMailController.bulkDelete);

export default router;
