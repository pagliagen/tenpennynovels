import { Router } from 'express';
import { ExperienceController } from '../controllers/ExperienceController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Character progression routes (require character auth)
router.get('/character/experience',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:experience:read'),
  ExperienceController.getCharacterProgression
);

router.get('/character/progression-stats',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:experience:stats'),
  ExperienceController.getProgressionStats
);

router.post('/character/experience/spend',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:experience:spend'),
  ExperienceController.spendExperiencePoints
);

// Master experience granting routes (require master role)
router.post('/experience/grant',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:experience:grant'),
  ExperienceController.grantExperience
);

export default router;