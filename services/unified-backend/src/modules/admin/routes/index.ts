import { Router, Request, Response } from 'express';
import { characterRoutes } from './characterRoutes';
import { userRoutes } from './userRoutes';
import { locationRoutes } from './locationRoutes';
import { systemRoutes } from './systemRoutes';
import analyticsRoutes from './analytics';
import ticketManagementRoutes from './ticketManagementRoutes';
import { documentRoutes } from './documentRoutes';
import { subtypeRoutes } from './subtypeRoutes';
import corporationRoutes from './corporationRoutes';
import { locationPropertyManagementRoutes } from './locationPropertyManagementRoutes';
import occupationManagementRoutes from './occupationManagementRoutes';
import { chatMonitoringRoutes } from './chatMonitoringRoutes';
import itemManagementRoutes from './itemManagementRoutes';
import forumManagementRoutes from './forumManagementRoutes';
import messagingSystemRoutes from './messagingSystemRoutes';
import skillManagementRoutes from './skillManagementRoutes';
import characterRelationManagementRoutes from './characterRelationManagementRoutes';
import socialClassManagementRoutes from './socialClassManagementRoutes';
import sessionManagementRoutes from './sessionManagementRoutes';
import chatModerationRoutes from './chatModerationRoutes';
import characterSessionRoutes from './characterSessionRoutes';
import chatManagementRoutes from './chatManagementRoutes';
import deletedRecordsRoutes from './deletedRecordsRoutes';
import imageGenerationRoutes from './imageGenerationRoutes';
import { cdnRoutes } from './cdnRoutes';
import { getVisibleDashboardBadges, getUserPermissions, getVisibleMenuStructure, haveAccessTo, debugPermissions } from '../utils/permissions';
import { auditLogger } from '../utils/auditLogger';
import { AuthUtils } from '../utils/auth';
import { User, Character, Location, db } from '@database/models';
import { logger } from '../utils/logger';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

const router = Router();

// Authentication endpoint - Get current admin user info
router.get('/me', 
  AdminAuthMiddleware.requireAdminAccess,
  async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('📍 /admin/me endpoint hit', {
      cookies: Object.keys(req.cookies || {}),
      queryParams: req.query
    });
    
    // Extract cookies
    const authToken = req.cookies?.auth_token;
    const characterContext = req.cookies?.character_context;
    const requestedCharacterId = req.query?.characterId as string;
    
    if (!authToken) {
      res.status(401).json({
        result: false,
        error: 'No authentication token provided'
      });
      return;
    }

    // Decode and validate JWT token
    const decodedToken = AuthUtils.decodeAuthToken(authToken);
    logger.info('🎯 Decoded auth token:', {
      userId: decodedToken.userId,
      username: decodedToken.username,
      canAccessAdminPanel: decodedToken.canAccessAdminPanel,
      requestedCharacterId
    });

    // Fetch user from database
    const user = await User.findById(decodedToken.userId).select('-passwordHash -emailVerificationToken -passwordResetToken');
    if (!user) {
      res.status(404).json({
        result: false,
        error: 'User not found'
      });
      return;
    }

    // Fetch user's characters
    const allCharacters = await Character.find({ userId: user._id }).sort({ createdAt: -1 });

    // Filter characters based on multipleCharactersAllowed setting
    const availableCharacters = AuthUtils.getAvailableCharacters(
      allCharacters,
      user.multipleCharactersAllowed
    );

    logger.info('📝 Character filtering:', {
      totalCharacters: allCharacters.length,
      availableCharacters: availableCharacters.length,
      multipleAllowed: user.multipleCharactersAllowed
    });

    // Decode character context if provided
    let characterContextData: { characterId: string; characterRoles: string[] } | undefined = undefined;
    if (characterContext) {
      characterContextData = AuthUtils.decodeCharacterContext(characterContext) || undefined;
    }

    // Determine active character
    const selectedCharacter = AuthUtils.determineActiveCharacter(
      availableCharacters,
      requestedCharacterId,
      characterContextData
    );

    const characterRoles = selectedCharacter?.gameplayRoles || [];
    const characterPermissions = selectedCharacter?.adminPermissions || [];
    const canAccessManagement = selectedCharacter?.canAccessAdminPanel === true || selectedCharacter?.isGestore === true;

    logger.info('🔒 Management panel access check:', {
      userId: user._id,
      characterRoles,
      canAccessAdminPanel: selectedCharacter?.canAccessAdminPanel,
      canAccessManagement
    });

    if (!canAccessManagement) {
      logger.warn('❌ Access denied to management panel', {
        userId: user._id,
        username: user.username,
        reason: 'Character does not have canAccessAdminPanel or isGestore'
      });
      res.status(403).json({
        result: false,
        error: 'Access denied to management panel',
        action: 'ACCESS_DENIED'
      });
      return;
    }

    const effectivePermissions = getUserPermissions(user.userRoles, characterRoles, characterPermissions);
    const visibleBadges = getVisibleDashboardBadges(user.userRoles, characterRoles, characterPermissions, selectedCharacter?.isGestore || false);
    const visibleMenu = getVisibleMenuStructure(user.userRoles, characterRoles, characterPermissions, selectedCharacter?.isGestore || false);

    debugPermissions(user.userRoles, characterRoles, characterPermissions);

    // Create safe user object
    const safeUser = {
      ...AuthUtils.createSafeUserObject(user, selectedCharacter),
      characterRoles,
      effectivePermissions,
      visibleBadges,
      visibleMenu
    };

    // Create safe character object
    const safeCharacter = AuthUtils.createSafeCharacterObject(selectedCharacter);

    // Create safe available characters list
    const safeAvailableCharacters = availableCharacters.map(char => 
      AuthUtils.createSafeCharacterObject(char)
    );

    const authContext = {
      isAuthenticated: true,
      user: safeUser,
      character: safeCharacter,
      availableCharacters: safeAvailableCharacters
    };

    logger.info('✅ Auth context created:', {
      userId: user._id,
      selectedCharacter: selectedCharacter?.name || 'none',
      availableCharactersCount: safeAvailableCharacters.length
    });

    res.json({
      result: true,
      data: authContext
    });
    
  } catch (error: any) {
    logger.error('❌ Error in /admin/me:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      result: false,
      error: 'Internal server error'
    });
  }
});

// Endpoint per ottenere tutti i personaggi dell'utente autenticato
router.get('/my-characters', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('👥 /admin/my-characters endpoint hit');
    
    const authToken = req.cookies?.auth_token;
    if (!authToken) {
      res.status(401).json({
        result: false,
        error: 'No authentication token provided'
      });
      return;
    }

    // Decode and validate JWT token
    const decodedToken = AuthUtils.decodeAuthToken(authToken);
    
    // Fetch user to get settings
    const user = await User.findById(decodedToken.userId).select('multipleCharactersAllowed');
    if (!user) {
      res.status(404).json({
        result: false,
        error: 'User not found'
      });
      return;
    }

    // Fetch user's characters (all non-deleted characters)
    const allCharacters = await Character.find({ userId: user._id })
    .populate('userId', 'username')
    .populate('approvedBy', 'username')
    .sort({ createdAt: -1 });

    // Filter characters based on multipleCharactersAllowed setting
    const filteredCharacters = AuthUtils.getAvailableCharacters(
      allCharacters,
      user.multipleCharactersAllowed
    );

    // Create safe character objects
    const safeCharacters = filteredCharacters.map(character => ({
      id: character._id.toString(),
      name: character.name,
      surname: character.surname,
      playerStatus: character.playerStatus,
      gameplayRoles: character.gameplayRoles || [],
      userId: character.userId._id.toString(),
      createdAt: character.createdAt,
      approvedAt: character.approvedAt,
      approvedBy: character.approvedBy?.username || null,
      avatarUrl: character.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(character.name + (character.surname ? ' ' + character.surname : ''))}&background=d4af37&color=1a1a1a&size=128&font-size=0.6`
    }));

    logger.info('✅ Returning character list:', {
      userId: user._id,
      totalCharacters: allCharacters.length,
      filteredCharacters: filteredCharacters.length,
      multipleAllowed: user.multipleCharactersAllowed
    });

    res.json({
      result: true,
      data: {
        characters: safeCharacters
      }
    });
    
  } catch (error: any) {
    logger.error('❌ Error in /admin/my-characters:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      result: false,
      error: 'Internal server error'
    });
  }
});


// API routes
router.use('/characters', characterRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/system', systemRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/tickets', ticketManagementRoutes);
router.use('/documents', documentRoutes);
router.use('/subtypes', subtypeRoutes);
router.use('/corporations', corporationRoutes);
router.use('/housing', locationPropertyManagementRoutes);
router.use('/occupations', occupationManagementRoutes);
router.use('/chat', chatMonitoringRoutes);
router.use('/items', itemManagementRoutes);
router.use('/forum', forumManagementRoutes);
router.use('/messaging', messagingSystemRoutes);
router.use('/skills', skillManagementRoutes);
router.use('/relationships', characterRelationManagementRoutes);
router.use('/social-classes', socialClassManagementRoutes);
router.use('/', sessionManagementRoutes);
router.use('/', chatModerationRoutes);
router.use('/character-sessions', characterSessionRoutes);
router.use('/chat-logs', chatManagementRoutes);
router.use('/deleted-records', deletedRecordsRoutes);
router.use('/image-gen', imageGenerationRoutes);
router.use('/cdn', cdnRoutes);

export { router as apiRoutes };
export default router;