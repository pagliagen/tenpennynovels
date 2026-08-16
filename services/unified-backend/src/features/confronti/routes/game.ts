import { Router } from 'express';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';
import { ConfrontationController } from '../controllers/ConfrontationController';

const router = Router();

// TiroContrapposto - Confrontation system (Phase 1)
router.post('/confrontation-attack',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:social-conflicts'), // Reuse same permission
  ConfrontationController.createConfrontationAttack
);

router.post('/confrontation-reaction',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:social-conflicts'),
  ConfrontationController.handleConfrontationReaction
);

// Master controls
router.post('/force-confrontation-outcome',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:master-action'), // Master-only permission
  ConfrontationController.forceConfrontationOutcome
);

export default router;
