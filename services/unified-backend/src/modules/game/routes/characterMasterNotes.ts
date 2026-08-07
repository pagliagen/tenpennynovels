import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterMasterNoteController } from '../controllers/CharacterMasterNoteController';

const router = Router();

router.get('/characters/:characterId/master-notes', AuthMiddleware.requireCharacterAuth, CharacterMasterNoteController.listNotes);
router.post('/characters/:characterId/master-notes', AuthMiddleware.requireCharacterAuth, CharacterMasterNoteController.createNote);

export default router;
