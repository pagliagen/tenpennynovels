import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterMasterNoteController } from '../controllers/CharacterMasterNoteController';

const router = Router();

// Rate limiters — same style as locations.ts/economy.ts (read vs write split).
const masterNotesReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'MASTER_NOTES_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const masterNotesWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'MASTER_NOTES_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

router.get('/characters/:characterId/master-notes', masterNotesReadLimiter, AuthMiddleware.requireCharacterAuth, CharacterMasterNoteController.listNotes);
router.post('/characters/:characterId/master-notes', masterNotesWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterMasterNoteController.createNote);

export default router;
