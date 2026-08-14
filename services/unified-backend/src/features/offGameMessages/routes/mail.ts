import { Router } from 'express';
import { OffGameMailController } from '../controllers/OffGameMailController';

const router = Router();

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
