import { Router } from 'express';
import characterRoutes from './characters';
import characterDiaryRoutes from './characterDiary';
import characterMasterNotesRoutes from './characterMasterNotes';
import chatScenesRoutes from './chatScenes';
import characterInventoryActionsRoutes from './characterInventoryActions';
import locationRoutes from './locations';
import gameRoutes from './game';
import economyRoutes from './economy';
import messageRoutes from './messages';
import chatRoutes from './chats';
import offGameChatRoutes from './offGameChats';
import onGameMessagesRoutes from './onGameMessages';
import offGameMessagesRoutes from './offGameMessages';
// import forumRoutes from './forum';
// import documentRoutes from './documents';  // REMOVED: Moved to modules/documents
import chatModerationRoutes from './chatModerationRoutes';
import characterRelationRoutes from './characterRelations';
import occupationRoutes from './occupations';
import skillRoutes from './skills';
import itemRoutes from './items';
import sessionRoutes from './sessions';
import { locationPropertyRoutes } from './locationPropertyRoutes';
import websocketEventRoutes from './websocketEvents';
import characterCreationRoutes from './characterCreation';
import characterGenConfigRoutes from './characterGenConfig';
import webhookRoutes from './webhooks';
import apiDocsRoute from '@shared/routes/ApiDocsRoute';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'game-backend',
    timestamp: new Date().toISOString() 
  });
});

// Mount all route modules with correct prefixes
router.use('/', characterRoutes);
router.use('/', characterDiaryRoutes);
router.use('/', characterMasterNotesRoutes);
router.use('/', chatScenesRoutes);
router.use('/', characterInventoryActionsRoutes);
router.use('/', locationRoutes);
router.use('/', gameRoutes);
router.use('/', economyRoutes);
router.use('/', messageRoutes);
router.use('/', offGameChatRoutes); // OffGame chat system
router.use('/', onGameMessagesRoutes); // On-game postal system
router.use('/', offGameMessagesRoutes); // Off-game messaging system
router.use('/chats', chatRoutes); // Location chats (renamed from location actions)
router.use('/housing', locationPropertyRoutes);
// router.use('/forum', forumRoutes);
// router.use('/documents', documentRoutes);  // REMOVED: Moved to modules/documents (mount: /documents)
router.use('/', chatModerationRoutes);
router.use('/relationships', characterRelationRoutes);
router.use('/occupations', occupationRoutes);
router.use('/skills', skillRoutes);
router.use('/items', itemRoutes);
router.use('/sessions', sessionRoutes);
router.use('/character-creation-config', characterCreationRoutes); // Public character creation config
router.use('/character-gen', characterGenConfigRoutes); // Character generation service config (no auth)
router.use('/', websocketEventRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/', apiDocsRoute);

export default router;