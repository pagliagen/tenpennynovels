import { Router } from 'express';
import { ExperienceController } from '../controllers/ExperienceController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// Character progression routes (require character auth)
router.get('/character/experience', AuthMiddleware.requireCharacterAuth, ExperienceController.getCharacterProgression);
router.get('/character/progression-stats', AuthMiddleware.requireCharacterAuth, ExperienceController.getProgressionStats);
router.post('/character/experience/spend', AuthMiddleware.requireCharacterAuth, ExperienceController.spendExperiencePoints);

// Master experience granting routes (require master role)
router.post('/experience/grant', AuthMiddleware.requireCharacterAuth, ExperienceController.grantExperience);

export default router;