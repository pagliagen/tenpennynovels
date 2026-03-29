import { Router } from 'express';
import { OnGameMailController } from '../controllers/OnGameMailController';
import { OffGameMailController } from '../controllers/OffGameMailController';

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

// ==============================
// OffGame Mail Routes
// ==============================

// List OffGame messages with filters
router.get('/offgame', OffGameMailController.getMessages);

// Get OffGame statistics
router.get('/offgame/stats', OffGameMailController.getStats);

// Get single OffGame message
router.get('/offgame/:id', OffGameMailController.getMessage);

// Hard delete OffGame message (permanent)
router.delete('/offgame/:id/hard', OffGameMailController.hardDelete);

// Soft delete OffGame message
router.post('/offgame/:id/soft-delete', OffGameMailController.softDelete);

// Bulk delete OffGame messages
router.post('/offgame/bulk-delete', OffGameMailController.bulkDelete);

export default router;
