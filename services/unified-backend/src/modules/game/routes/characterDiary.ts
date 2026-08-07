import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterDiaryController } from '../controllers/CharacterDiaryController';

const router = Router();

// Rate limiters — same style as locations.ts/economy.ts (read vs write split).
const diaryReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'DIARY_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const diaryWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'DIARY_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Diario classico
router.get('/characters/:characterId/diary-entries', diaryReadLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.listDiaryEntries);
router.post('/characters/:characterId/diary-entries', diaryWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.createDiaryEntry);
router.put('/characters/:characterId/diary-entries/:entryId', diaryWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.updateDiaryEntry);
router.delete('/characters/:characterId/diary-entries/:entryId', diaryWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.deleteDiaryEntry);

// Personaggi incontrati
router.get('/characters/:characterId/encounters', diaryReadLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.listEncounters);
router.post('/characters/:characterId/encounters', diaryWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.createEncounter);
router.put('/characters/:characterId/encounters/:encounterId', diaryWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.updateEncounter);
router.delete('/characters/:characterId/encounters/:encounterId', diaryWriteLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.deleteEncounter);

// Role (sessioni di gioco)
router.get('/characters/:characterId/sessions', diaryReadLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.listSessions);
router.get('/characters/:characterId/sessions/:sessionId/transcript', diaryReadLimiter, AuthMiddleware.requireCharacterAuth, CharacterDiaryController.downloadTranscript);

export default router;
