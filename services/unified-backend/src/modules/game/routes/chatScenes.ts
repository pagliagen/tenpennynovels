import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { ChatSceneController } from '../controllers/ChatSceneController';

const router = Router();

// Solo lettura — stesso stile read limiter di characterMasterNotes.ts/characterDiary.ts.
const chatScenesReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'CHAT_SCENES_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

router.get('/characters/:characterId/chat-scenes', chatScenesReadLimiter, AuthMiddleware.requireCharacterAuth, ChatSceneController.listScenes);
router.get('/characters/:characterId/chat-scenes/:sceneId/transcript', chatScenesReadLimiter, AuthMiddleware.requireCharacterAuth, ChatSceneController.downloadTranscript);

export default router;
