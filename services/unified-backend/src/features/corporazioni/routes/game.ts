import { Router } from 'express';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';
import { CorporationController } from '../controllers/CorporationController';

const router = Router();

// Corporation routes (require character auth)
router.get('/corporations',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:list'),
  CorporationController.getCorporations
);

router.get('/corporations/:corporationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:read'),
  CorporationController.getCorporation
);

router.post('/corporations/:corporationId/join',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:join'),
  CorporationController.joinCorporation
);

router.post('/corporations/:corporationId/leave',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:leave'),
  CorporationController.leaveCorporation
);

router.get('/corporations/:corporationId/invitations',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:invitations:read'),
  CorporationController.getInvitations
);

router.put('/corporations/:corporationId/invitations/:invitationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:corporations:invitations:respond'),
  CorporationController.handleInvitation
);

export default router;
