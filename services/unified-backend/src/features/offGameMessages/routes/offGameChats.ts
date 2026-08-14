import { Router, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';
import { OffGameChatController } from '../controllers/OffGameChatController';
import { OffGameChat } from '../models/OffGameChat';
import { OffGameChatParticipant } from '../models/OffGameChatParticipant';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { errorResponse, successResponse } from '@shared/utils/apiResponse';

const router = Router();

// CodeQL (js/missing-rate-limiting): limiter generico prima ancora
// dell'auth check, per proteggere anche quest'ultimo da un flood.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

// Get user's chats
router.get('/offgame-chats',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:offgame-chat:list'),
  OffGameChatController.getChats
);

// Create new chat (direct or group)
router.post('/offgame-chats',
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(),
  requireGamePermission('game:offgame-chat:create'),
  OffGameChatController.createChat
);

// Get chat messages
router.get('/offgame-chats/:id/messages',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:offgame-chat:read'),
  OffGameChatController.getChatMessages
);

// Send message to chat
router.post('/offgame-chats/:id/messages',
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(),
  requireGamePermission('game:offgame-chat:send'),
  OffGameChatController.sendMessage
);

// Update chat name (group chats only)
router.patch('/offgame-chats/:id/name',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:offgame-chat:edit'),
  OffGameChatController.updateChatName
);

// Leave chat
router.post('/offgame-chats/:id/leave',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:offgame-chat:leave'),
  OffGameChatController.leaveChat
);

// Typing indicator endpoint
router.post('/offgame-chats/:id/typing',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:offgame-chat:typing'),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const chatId = req.params.id;
      const characterId = req.character!.characterId;
      const { isTyping } = req.body;

      // Verify chat exists and user is participant
      const chat = await OffGameChat.findOne({
        _id: chatId,
        participants: characterId,
        isActive: true
      });

      if (!chat) {
        res.status(404).json(errorResponse('Chat non trovata'));
        return;
      }

      // Emit WebSocket event to all participants except sender
      const io = req.app.get('io');
      if (io) {
        const participants = await OffGameChatParticipant.find({
          chatId,
          isActive: true
        }).select('characterId');

        for (const participant of participants) {
          if (participant.characterId.toString() !== characterId) {
            io.to(`character_${participant.characterId}`).emit('offgame_typing_indicator', {
              chatId,
              characterId,
              characterName: req.character!.characterName,
              isTyping,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      res.json(successResponse(undefined, 'Indicatore di digitazione inviato'));
    } catch (error: any) {
      res.status(500).json(errorResponse('Impossibile inviare l\'indicatore di digitazione'));
    }
  }
);

export default router;
