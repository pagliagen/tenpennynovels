import { Router } from 'express';
import characterRoutes from './characters';
import locationRoutes from './locations';
import gameRoutes from './game';
import economyRoutes from './economy';
import messageRoutes from './messages';
import chatRoutes from './chats';
import corporationRoutes from './corporations';
import forumRoutes from './forum';
import documentRoutes from './documents';
import ticketRoutes from './tickets';
import financeRoutes from './finances';
import experienceRoutes from './experienceRoutes';
import sessionManagementRoutes from './sessionManagementRoutes';
import chatModerationRoutes from './chatModerationRoutes';
import relationshipRoutes from './relationships';
import occupationRoutes from './occupations';
import skillRoutes from './skills';
import itemRoutes from './items';
import sessionRoutes from './sessions';
import { housingRoutes } from './housing-simple';
import apiDocsRoute from '../../../shared/src/routes/ApiDocsRoute';

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
router.use('/', chatRoutes);
router.use('/', corporationRoutes);
router.use('/housing', housingRoutes);
router.use('/forum', forumRoutes);
router.use('/documents', documentRoutes);
router.use('/', ticketRoutes);
router.use('/', financeRoutes);
router.use('/', experienceRoutes);
router.use('/', sessionManagementRoutes);
router.use('/', chatModerationRoutes);
router.use('/relationships', relationshipRoutes);
router.use('/occupations', occupationRoutes);
router.use('/skills', skillRoutes);
router.use('/items', itemRoutes);
router.use('/sessions', sessionRoutes);
router.use('/', apiDocsRoute);

export default router;