import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterDiaryController } from '../controllers/CharacterDiaryController';

const router = Router();

// Diario classico
router.get('/characters/:characterId/diary-entries', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.listDiaryEntries);
router.post('/characters/:characterId/diary-entries', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.createDiaryEntry);
router.put('/characters/:characterId/diary-entries/:entryId', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.updateDiaryEntry);
router.delete('/characters/:characterId/diary-entries/:entryId', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.deleteDiaryEntry);

// Personaggi incontrati
router.get('/characters/:characterId/encounters', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.listEncounters);
router.post('/characters/:characterId/encounters', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.createEncounter);
router.put('/characters/:characterId/encounters/:encounterId', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.updateEncounter);
router.delete('/characters/:characterId/encounters/:encounterId', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.deleteEncounter);

// Role (sessioni di gioco)
router.get('/characters/:characterId/sessions', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.listSessions);
router.get('/characters/:characterId/sessions/:sessionId/transcript', AuthMiddleware.requireCharacterAuth, CharacterDiaryController.downloadTranscript);

export default router;
