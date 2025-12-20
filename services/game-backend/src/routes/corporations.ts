import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CorporationController } from '../controllers/CorporationController';

const router = Router();

// Corporation routes (require character auth)
router.get('/corporations', 
  AuthMiddleware.requireCharacterAuth, 
  CorporationController.getCorporations
);

router.get('/corporations/:corporationId', 
  AuthMiddleware.requireCharacterAuth, 
  CorporationController.getCorporation
);

router.post('/corporations/:corporationId/join', 
  AuthMiddleware.requireCharacterAuth, 
  CorporationController.joinCorporation
);

router.post('/corporations/:corporationId/leave', 
  AuthMiddleware.requireCharacterAuth, 
  CorporationController.leaveCorporation
);

router.get('/corporations/:corporationId/invitations', 
  AuthMiddleware.requireCharacterAuth, 
  CorporationController.getInvitations
);

router.put('/corporations/:corporationId/invitations/:invitationId', 
  AuthMiddleware.requireCharacterAuth, 
  CorporationController.handleInvitation
);

export default router;