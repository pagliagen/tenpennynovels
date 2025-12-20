import { Router } from 'express';
import { FinancialController } from '../controllers/FinancialController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// All financial routes require authentication
router.use(AuthMiddleware.authenticate);

// Character finances
router.get('/finances/character/:characterId', FinancialController.getCharacterFinances);
router.get('/finances/transactions/:characterId', FinancialController.getTransactionHistory);

// Money transfers
router.post('/finances/transfer', FinancialController.transferMoney);

// Administrative endpoints
router.post('/finances/admin/grant', FinancialController.adminMoneyGrant);
router.post('/finances/admin/reset-credit', FinancialController.adminResetCredit);
router.get('/finances/admin/status', FinancialController.getSystemStatus);

export default router;