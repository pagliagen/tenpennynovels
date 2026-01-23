import { Request, Response } from 'express';
import { Character, Location, LocationAction } from '../../../database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { LocationService } from '../services/LocationService';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class LocationController {
  /**
   * GET /game/locations
   * Get flat list of accessible locations for character
   * Security: Only returns locations the character can see/access
   */
  static async getAccessibleLocations(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get flat list of accessible locations using centralized service
      const locations = await LocationService.getAccessibleLocations(characterId);

      res.json(successResponse(
        {
          locations: locations
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get accessible locations error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le location accessibili',
        'GET_LOCATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/locations/tree
   * Get location tree filtered by character access permissions
   * Security: Only returns locations the character can see/access
   */
  static async getLocationTree(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get hierarchical location tree using centralized service
      const locationTree = await LocationService.getLocationTree(characterId);

      res.json(successResponse(
        { locationTree },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location tree error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare l\'albero delle location',
        'LOCATION_TREE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/locations/:locationId
   * Get location details with access control
   * Security: Returns 404 if character doesn't have access
   */
  static async getLocation(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;

      // Get character for permission checks
      const character = await (Character.findById(characterId) as any);

      if (!character) {
        // Return 404 to prevent information disclosure
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get location
      const location = await (Location.findById(locationId) as any);

      if (!location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check access permissions
      const hasAccess = await LocationController.checkLocationAccess(location, character);
      
      if (!hasAccess) {
        // Return 404 instead of 403 to prevent information disclosure
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Filter shop items by character permissions
      // TODO: Implement shop items when Shop system is properly integrated
      const availableItems: any[] = [];

      // Get chat history for the location
      const chatHistory = await (LocationAction.getLocationHistory(locationId, characterId, 50) as any);

      res.json(successResponse(
        {
          location: {
            id: location.id,
            name: location.name,
            description: location.description,
            district: location.district,
            accessible: true,
            hasShop: location.settings.shop || false,
            private: location.settings.private || false,
            occupants: location.occupants?.map((occupant: any) => ({
              characterId: occupant.characterId,
              characterName: occupant.characterName,
              enteredAt: occupant.enteredAt,
              lastSeen: occupant.lastSeen
            })) || [],
            availableItems,
            npcs: location.npcs?.map((npc: any) => ({
              id: npc.id,
              name: npc.name,
              isActive: npc.isActive || false
            })) || []
          },
          chatHistory: chatHistory.map((action: any) => ({
            id: action._id,
            actionType: action.actionType,
            characterId: action.characterId,
            characterName: action.characterName,
            content: action.content,
            timestamp: action.timestamp.toISOString(),
            visibility: action.visibility,
            diceResult: action.diceResult,
            itemEffect: action.itemEffect,
            targetCharacters: action.targetCharacters
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      // Return 404 for any error to prevent information disclosure
      res.status(404).json(errorResponse(
        'Location non trovata',
        'LOCATION_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/locations/:locationId/enter
   * Enter a location
   * Security: 404 if not accessible, 403 if exists but access denied
   */
  static async enterLocation(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;

      // Get character and location
      const [character, location] = await Promise.all([
        Character.findById(characterId),
        Location.findById(locationId)
      ]) as any[];

      if (!character || !location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check access permissions
      const hasAccess = await LocationController.checkLocationAccess(location, character);
      
      if (!hasAccess) {
        res.status(403).json(errorResponse(
          'Accesso negato',
          'LOCATION_ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Update character location
      character.currentLocation = locationId;
      await character.save();

      // Add to location occupants
      await LocationController.addOccupant(location, character);

      // TODO: Publish Redis event for WebSocket
      // redis.publish('location:character_entered', { locationId, characterId, characterName });

      logger.info('Character entered location', {
        characterId,
        characterName: character.name,
        locationId,
        locationName: location.name
      });

      // Reload location to get updated occupants list
      const updatedLocation = await (Location.findById(location.id) as any);
      const activeOccupants = updatedLocation?.occupants?.filter((o: any) => o.isActive) || [];

      res.json(successResponse(
        {
          location: {
            id: location.id,
            name: location.name,
            description: location.description,
            occupants: activeOccupants.length,
            occupantsList: activeOccupants.map((o: any) => ({
              characterId: o.characterId,
              characterName: o.characterName,
              enteredAt: o.enteredAt,
              lastSeen: o.lastSeen
            })),
            hasShop: location.settings?.shop || false,
            private: location.settings?.private || false
          }
        },
        `Entered ${location.name}`,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Enter location error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile entrare nella location',
        'ENTER_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/locations/:locationId/access
   * Check access permissions for a location
   * Security: Returns 404 if location doesn't exist OR character has no access
   */
  static async checkAccess(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;

      const [character, location] = await Promise.all([
        Character.findById(characterId),
        Location.findById(locationId)
      ]) as any[];

      if (!character || !location) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const accessInfo = await LocationController.getAccessInfo(location, character);
      
      if (!accessInfo.hasAccess) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      res.json(successResponse(
        accessInfo,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Check access error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(404).json(errorResponse(
        'Location non trovata',
        'LOCATION_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /game/locations/:locationId/grant-access
   * Grant access to private location (owner only)
   * Security: 404 if location doesn't exist OR character is not owner
   */
  static async grantAccess(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const { targetCharacterId, permissions, duration } = req.body;
      const characterId = req.character!.characterId;

      const [character, location, targetCharacter] = await Promise.all([
        Character.findById(characterId),
        Location.findById(locationId),
        Character.findById(targetCharacterId)
      ]) as any[];

      if (!character || !location || !targetCharacter) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if character is the owner
      if (location.ownerId?.toString() !== characterId) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Grant access
      if (!location.access) {
        location.access = { characterAccess: [], corporationAccess: [] };
      }
      
      // Check if character already has access
      const existingAccess = location.access.characterAccess.find(
        (access: any) => access.characterId.toString() === targetCharacterId
      );
      
      if (existingAccess) {
        // Update existing access
        existingAccess.permissions = permissions || ['view', 'chat'];
        existingAccess.duration = duration || 'permanent';
        existingAccess.grantedAt = new Date();
        existingAccess.grantedBy = characterId;
      } else {
        // Add new access
        location.access.characterAccess.push({
          characterId: targetCharacterId,
          permissions: permissions || ['view', 'chat'],
          grantedBy: characterId,
          grantedAt: new Date(),
          duration: duration || 'permanent',
          ...(duration === 'temporary' && { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }) // 24 hours default
        });
      }
      
      await location.save();

      logger.info('Location access granted', {
        locationId,
        ownerId: characterId,
        targetCharacterId,
        permissions
      });

      res.json(successResponse(
        undefined,
        `Access granted to ${targetCharacter.name}`,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Grant access error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile concedere l\'accesso',
        'GRANT_ACCESS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper Methods

  private static async filterItemsByAccess(items: any[], character: any): Promise<any[]> {
    return items.filter((item: any) => {
      // Only show visible items
      if (!item.visible) return false;

      // Check requirements
      if (item.requirements) {
        // Skill requirements
        if (item.requirements.skills) {
          for (const skillReq of item.requirements.skills as any[]) {
            if (!character.skills[skillReq.skill] || 
                character.skills[skillReq.skill] < skillReq.minimum) {
              return false;
            }
          }
        }

        // Occupation requirements
        if (item.requirements.occupations && item.requirements.occupations.length > 0) {
          if (!item.requirements.occupations.includes(character.occupation)) {
            return false;
          }
        }

        // Corporation requirements - disabled until corporations are implemented
        if (item.requirements.corporations && item.requirements.corporations.length > 0) {
          // TODO: Implement corporation membership check when Character.corporations field is added
          // For now, assume no corporation access
          return false;
        }
      }

      return true;
    });
  }

  private static async addOccupant(location: any, character: any): Promise<void> {
    // Remove character from all other locations first
    await (Location.updateMany(
      { 'occupants.characterId': character.id },
      { $pull: { occupants: { characterId: character.id } } }
    ) as any);

    // Add to current location with new structure
    const occupant = {
      characterId: character.id,
      characterName: character.name,
      enteredAt: new Date(),
      lastSeen: new Date(),
      isActive: true
    };

    await (Location.updateOne(
      { _id: location.id },
      { $addToSet: { occupants: occupant } }
    ) as any);
  }

  /**
   * Check if character has access to location
   */
  private static async checkLocationAccess(location: any, character: any): Promise<boolean> {
    // Location must be visible first
    if (!location.settings.visible) {
      return false;
    }

    // Public locations are accessible to all
    if (!location.settings.private) {
      return true;
    }

    // Private locations access control
    if (location.settings.private) {
      // Check if character is the owner
      if (location.access?.ownerId?.toString() === character.id) {
        return true;
      }
      
      // Check character-specific access
      if (location.access?.characterAccess) {
        const access = location.access.characterAccess.find((a: any) => a.characterId.toString() === character.id);
        if (access) {
          // Check if access is expired
          if (access.duration === 'temporary' && access.expiresAt && new Date() > access.expiresAt) {
            return false;
          }
          return access.permissions.includes('view');
        }
      }
      
      // Check corporation access - disabled until corporations are implemented
      if (location.access?.corporationAccess) {
        // TODO: Implement corporation membership check when Character.corporations field is added
        // For now, skip corporation access checks
      }
    }

    return false;
  }

  /**
   * Get detailed access information for a location
   */
  private static async getAccessInfo(location: any, character: any): Promise<any> {
    const hasAccess = await LocationController.checkLocationAccess(location, character);
    
    if (!hasAccess) {
      return { hasAccess: false };
    }

    // Determine access type and permissions
    let accessType = 'public';
    let permissions = ['view', 'chat'];

    if (location.access?.ownerId?.toString() === character.id) {
      accessType = 'owner';
      permissions = ['view', 'chat', 'shop', 'manage'];
    } else if (location.settings.private) {
      // Check character-specific access
      if (location.access?.characterAccess) {
        const access = location.access.characterAccess.find((a: any) => a.characterId.toString() === character.id);
        if (access) {
          accessType = 'granted';
          permissions = access.permissions || ['view', 'chat'];
        }
      }
      
      // Check corporation access - disabled until corporations are implemented
      if (location.access?.corporationAccess) {
        // TODO: Implement corporation membership check when Character.corporations field is added
        // For now, skip corporation access checks
      }
    }

    return {
      hasAccess: true,
      accessType,
      permissions,
      canChat: location.settings.chat && permissions.includes('chat'),
      canShop: location.settings.shop && permissions.includes('shop'),
      canManage: permissions.includes('manage')
    };
  }
}