import { Request, Response, NextFunction } from 'express';
import { AuditLog, IAuditLogActor, IAuditLogTarget } from '@database/models/AuditLog';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

/**
 * AUDIT MIDDLEWARE
 *
 * Automatic outcome tracking middleware that wraps res.json()
 * to automatically log success/failure of administrative actions
 *
 * Usage:
 * router.post('/:userId/ban',
 *   logAdminAction('user.ban', 'user_management'),
 *   autoLogOutcome,  // <-- AUTO-LOG
 *   UserManagementController.banUser
 * );
 *
 * Benefits:
 * - Zero controller modifications needed
 * - Consistent outcome tracking across ALL endpoints
 * - Performance tracking (duration)
 * - Error message capture
 */

// Extend Request interface for audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        action: string;
        actionDescription?: string;
        category: string;
        target?: IAuditLogTarget;
        startTime: number;
      };
    }
  }
}

/**
 * Helper: Extract actor information from request
 */
function extractActorFromRequest(req: Request): IAuditLogActor {
  // Extract character name from character_context cookie
  let characterName = req.user?.username; // Fallback
  const characterContextToken = req.cookies?.character_context;

  if (characterContextToken) {
    try {
      const { AuthUtils } = require('../utils/auth');
      const characterContext = AuthUtils.decodeCharacterContext(characterContextToken);
      if (characterContext?.characterName) {
        characterName = characterContext.characterName;
      }
    } catch (error) {
      // Ignore error, use fallback
    }
  }

  return {
    userId: new Types.ObjectId(req.user?.userId),
    username: req.user?.username || 'Unknown',
    characterName,
    userRoles: req.user?.userRoles || [],
    characterRoles: req.user?.characterRoles || []
  };
}

/**
 * Middleware: Automatic outcome logging
 *
 * Wraps res.json() to automatically save audit log to MongoDB
 * when the response is sent.
 *
 * Must be used AFTER logAdminAction() middleware which sets req.adminAction
 */
export function autoLogOutcome(req: Request, res: Response, next: NextFunction): void {
  // Store start time for performance tracking
  const startTime = Date.now();

  // Store original res.json
  const originalJson = res.json.bind(res);

  // Wrap res.json to intercept response
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;

    // Extract error message from response body if failed
    let errorMessage: string | undefined;
    if (!success && body) {
      errorMessage = body.message || body.error || `HTTP ${res.statusCode}`;
    }

    // Extract audit context from req.adminAction (set by logAdminAction middleware)
    const action = req.adminAction?.action;
    const category = req.adminAction?.category;

    if (!action || !category) {
      logger.warn('autoLogOutcome: Missing adminAction context', {
        path: req.path,
        method: req.method
      });
      return originalJson(body);
    }

    // Generate human-readable action description
    const actionDescription = generateActionDescription(action, req, body);

    // Extract target information from request/response
    const target = extractTarget(req, body);

    // Save audit log to MongoDB (async, don't block response)
    AuditLog.create({
      actor: extractActorFromRequest(req),
      action,
      actionDescription,
      category,
      target,
      success,
      errorMessage,
      details: extractDetails(req, body, success),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'Unknown',
      duration,
      timestamp: new Date()
    })
      .then((log: any) => {
        logger.info('Audit log saved', {
          logId: log._id,
          action,
          success,
          duration: `${duration}ms`
        });
      })
      .catch((error: Error) => {
        logger.error('Failed to save audit log', {
          error: error instanceof Error ? error.message : String(error),
          action,
          category
        });
      });

    // Send original response
    return originalJson(body);
  };

  next();
}

/**
 * Generate human-readable action description
 */
function generateActionDescription(action: string, req: Request, body: any): string {
  const descriptions: { [key: string]: string } = {
    // User Management
    'user.ban': 'Ban user',
    'user.unban': 'Unban user',
    'user.deactivate': 'Deactivate user',
    'user.activate': 'Activate user',
    'user.update': 'Update user',
    'user.update_ban': 'Update ban',
    'user.delete': 'Delete user',
    'user.change_permissions': 'Change user permissions',
    'user.role.grant': 'Grant user role',
    'user.role.revoke': 'Revoke user role',
    'user.bulk_ban': 'Bulk ban users',
    'user.bulk_unban': 'Bulk unban users',
    'user.bulk_activate': 'Bulk activate users',
    'user.bulk_deactivate': 'Bulk deactivate users',

    // Character Management
    'character.approve': 'Approve character',
    'character.reject': 'Reject character',
    'character.update': 'Update character',
    'character.update_priority': 'Update review priority',
    'character.delete': 'Delete character',
    'character.role.grant': 'Grant character role',
    'character.role.revoke': 'Revoke character role',
    'character.permission.grant': 'Grant character permission',
    'character.permission.revoke': 'Revoke character permission',
    'character.bulk_approve': 'Bulk approve characters',
    'character.bulk_reject': 'Bulk reject characters',
    'character.bulk_delete': 'Bulk delete characters',

    // Location Management
    'location.create': 'Create location',
    'location.update': 'Update location',
    'location.delete': 'Delete location',

    // Document Management
    'document.create': 'Create document',
    'document.update': 'Update document',
    'document.delete': 'Delete document',
    'document.toggle_visibility': 'Toggle document visibility',
    'document.toggle_draft': 'Toggle document draft status',
    'document.regenerate_chunks': 'Regenerate document chunks',

    // Skill Management
    'skill.create': 'Create skill',
    'skill.update': 'Update skill',
    'skill.delete': 'Delete skill',

    // Item Management
    'item.create': 'Create item',
    'item.update': 'Update item',
    'item.delete': 'Delete item',

    // Session Management
    'session.terminate': 'Terminate session',
    'session.terminate_all': 'Terminate all sessions',

    // System Configuration
    'system.config.update': 'Update system configuration',
    'system.maintenance_mode': 'Set maintenance mode',
    'system.broadcast': 'Broadcast message',
    'system.cache.invalidate': 'Invalidate cache',
    'system.character_config.update': 'Update character creation config'
  };

  return descriptions[action] || action;
}

/**
 * Extract target information from request/response
 */
function extractTarget(req: Request, body: any): IAuditLogTarget | undefined {
  // Helper to convert param to string
  const toStr = (val: any): string | undefined => Array.isArray(val) ? val[0] : val;

  // Try to extract target from URL params
  const userId = toStr(req.params.userId || req.params.id);
  const characterId = toStr(req.params.characterId);
  const locationId = toStr(req.params.locationId);
  const documentId = toStr(req.params.documentId);
  const skillId = toStr(req.params.skillId);
  const itemId = toStr(req.params.itemId);
  const sessionId = toStr(req.params.sessionId);

  // Try to extract target name from response body
  let targetName = 'Unknown';
  if (body?.data?.username) targetName = body.data.username;
  else if (body?.data?.name) targetName = body.data.name;
  else if (body?.data?.title) targetName = body.data.title;

  // Determine target type and ID
  if (userId) {
    return {
      type: 'user',
      id: userId,
      name: targetName
    };
  } else if (characterId) {
    return {
      type: 'character',
      id: characterId,
      name: targetName
    };
  } else if (locationId) {
    return {
      type: 'location',
      id: locationId,
      name: targetName
    };
  } else if (documentId) {
    return {
      type: 'document',
      id: documentId,
      name: targetName
    };
  } else if (skillId) {
    return {
      type: 'skill',
      id: skillId,
      name: targetName
    };
  } else if (itemId) {
    return {
      type: 'item',
      id: itemId,
      name: targetName
    };
  } else if (sessionId) {
    return {
      type: 'session',
      id: sessionId,
      name: targetName
    };
  }

  return undefined;
}

/**
 * Extract relevant details from request/response
 */
function extractDetails(req: Request, body: any, success: boolean): any {
  const details: any = {};

  // Include request body for context (excluding sensitive fields)
  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields
    delete sanitizedBody.password;
    delete sanitizedBody.newPassword;
    delete sanitizedBody.currentPassword;
    details.requestBody = sanitizedBody;
  }

  // Include response data if available (only on success, to avoid bloat)
  if (success && body?.data) {
    // Store minimal response info to avoid bloat
    if (body.data._id) details.targetId = body.data._id;
    if (body.data.username) details.targetUsername = body.data.username;
    if (body.data.name) details.targetName = body.data.name;
    if (body.data.title) details.targetTitle = body.data.title;
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

/**
 * Middleware factory: Set audit context for specific action
 *
 * This is an alternative to logAdminAction() that works with autoLogOutcome
 * Use this for new routes or when refactoring existing routes
 *
 * @param action - Action identifier (dot notation: 'user.ban')
 * @param category - Category identifier: 'user_management', 'character_management', etc.
 */
export function setAuditAction(action: string, category: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store action context for autoLogOutcome middleware
    req.adminAction = {
      action,
      category,
      timestamp: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    };

    logger.info('Audit action set', {
      action,
      category,
      adminId: req.user?.userId,
      adminUsername: req.user?.username,
      endpoint: req.originalUrl,
      method: req.method
    });

    next();
  };
}
