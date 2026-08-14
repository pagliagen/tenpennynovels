import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';
import { CorporationController } from '../controllers/CorporationController';

const router = Router();

// Il limiter va prima di AuthMiddleware.requireCharacterAuth (che fa a sua
// volta accessi DB/Redis) per proteggere anche il percorso di auth da un
// flood di richieste — req.user non è ancora popolato qui, chiave su IP.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

// Corporation routes (require character auth)
router.get('/corporations',
  readLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:list'),
  CorporationController.getCorporations
);

router.get('/corporations/:corporationId',
  readLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:read'),
  CorporationController.getCorporation
);

router.post('/corporations/:corporationId/join',
  writeLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:join'),
  CorporationController.joinCorporation
);

router.post('/corporations/:corporationId/leave',
  writeLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:leave'),
  CorporationController.leaveCorporation
);

router.get('/corporations/:corporationId/invitations',
  readLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:invitations:read'),
  CorporationController.getInvitations
);

router.put('/corporations/:corporationId/invitations/:invitationId',
  writeLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:invitations:respond'),
  CorporationController.handleInvitation
);

export default router;
