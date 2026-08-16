import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';
import { ConfrontationController } from '../controllers/ConfrontationController';

const router = Router();

// CodeQL (js/missing-rate-limiting): il limiter globale applicato in
// bootstrapFeatures() non e' tracciabile staticamente fin qui (stesso
// motivo/stesso rimedio di features/tickets/routes/game.ts).
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

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
