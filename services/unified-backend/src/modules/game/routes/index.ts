import { Router } from 'express';
import characterRoutes from './characters';
import locationRoutes from './locations';
import gameRoutes from './game';
import economyRoutes from './economy';
import messageRoutes from './messages';
import chatRoutes from './chats';
import offGameChatRoutes from './offGameChats';
import corporationRoutes from './corporations';
// import forumRoutes from './forum';
// import documentRoutes from './documents';  // REMOVED: Moved to modules/documents
// import ticketRoutes from './tickets';
import experienceRoutes from './experienceRoutes';
import chatModerationRoutes from './chatModerationRoutes';
import relationshipRoutes from './relationships';
import occupationRoutes from './occupations';
import skillRoutes from './skills';
import itemRoutes from './items';
import sessionRoutes from './sessions';
import { housingRoutes } from './housing';
import websocketEventRoutes from './websocketEvents';
import characterCreationRoutes from './characterCreation';
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
router.use('/', locationRoutes);
router.use('/', gameRoutes);
router.use('/', economyRoutes);
router.use('/', messageRoutes);
router.use('/', offGameChatRoutes); // OffGame chat system
router.use('/chats', chatRoutes); // Location chats (renamed from location actions)
router.use('/', corporationRoutes);
router.use('/housing', housingRoutes);
// router.use('/forum', forumRoutes);
// router.use('/documents', documentRoutes);  // REMOVED: Moved to modules/documents (mount: /documents)
// router.use('/', ticketRoutes);
router.use('/', experienceRoutes);
router.use('/', chatModerationRoutes);
router.use('/relationships', relationshipRoutes);
router.use('/occupations', occupationRoutes);
router.use('/skills', skillRoutes);
router.use('/items', itemRoutes);
router.use('/sessions', sessionRoutes);
router.use('/character-creation-config', characterCreationRoutes); // Public character creation config
router.use('/', websocketEventRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/', apiDocsRoute);

export default router;