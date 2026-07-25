import { Request, Response } from 'express';
import { Character, Location, Chat } from '@database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../logger';
import { LocationService } from '../services/LocationService';
import { redis } from '@config/runtime/redis';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

import { smartTransaction } from '../utils/transactions'; // ✅ SPRINT 4: MongoDB Transactions

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

    } catch (error: unknown) {
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

    } catch (error: unknown) {
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
   * GET /game/locations/root
   * Get the root location (London): excluded from getAccessibleLocations
   * but needed by the frontend topbar as the default "no currentLocation" state.
   */
  static async getRootLocation(req: Request, res: Response): Promise<void> {
    try {
      const rootLocation = await LocationService.getRootLocation();

      if (!rootLocation) {
        res.status(404).json(errorResponse(
          'Location radice non trovata',
          'ROOT_LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      res.json(successResponse(
        { rootLocation },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get root location error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare la location radice',
        'GET_ROOT_LOCATION_ERROR',
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
  static async getLocation(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;

      // Get character for permission checks
      const character = await Character.findById(characterId);

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
      const location = await Location.findById(locationId);

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

      // Shop items - feature not yet implemented
      const availableItems: any[] = [];

      // Get chat history for the location, filtered by current session
      const sessionId = location.activeSession?.sessionId?.toString();
      const isMaster = character.gameplayRoles?.some((r: string) => ['master', 'moderatore', 'gestore'].includes(r)) || false;
      const chatHistory = await Chat.getLocationHistory(locationId, characterId, 50, sessionId, isMaster);

      // Get occupants from location, or populate from characters with currentLocation if empty
      let occupants = location.occupants?.map((occupant: any) => ({
        characterId: occupant.characterId,
        characterName: occupant.characterName,
        enteredAt: occupant.enteredAt,
        lastSeen: occupant.lastSeen,
        currentTag: occupant.currentTag || null
      })) || [];

      // Ensure current character is in occupants list if they're in this location
      const currentCharacterInLocation = character.currentLocation?.toString() === locationId;
      if (currentCharacterInLocation) {
        const isAlreadyInOccupants = occupants.some((occ: any) => 
          occ.characterId.toString() === characterId.toString()
        );
        if (!isAlreadyInOccupants) {
          occupants.push({
            characterId: character._id,
            characterName: character.name,
            enteredAt: new Date(),
            lastSeen: new Date(),
            currentTag: null
          });
        }
      }

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
            occupants: occupants,
            availableItems,
            npcs: location.npcs?.map((npc: any) => ({
              id: npc.id,
              name: npc.name,
              isActive: npc.isActive || false
            })) || []
          },
          chatHistory: chatHistory.map((action: any) => {
            const mappedAction: any = {
              id: action._id,
              actionType: action.actionType,
              characterId: action.characterId,
              characterName: action.characterName,
              content: action.content,
              timestamp: action.timestamp.toISOString(),
              visibility: action.visibility,
              diceResult: action.diceResult,
              itemEffect: action.itemEffect,
              targetCharacters: action.targetCharacters,
              tags: action.tags || []
            };
            
            // Filter socialConflict data based on visibility rules
            if (action.socialConflict) {
              const socialConflict = action.socialConflict;
              
              // If socialConflict is visible only to defender
              if (socialConflict.visibleToDefenderOnly) {
                const isAttacker = action.characterId === characterId;
                const isDefender = action.targetCharacters?.includes(characterId);
                
                // Attacker should NEVER see socialConflict data for Raggirare
                if (isAttacker) {
                  // Don't include socialConflict
                }
                // Defender can see it only if they detected something (result !== 'victory')
                else if (isDefender && socialConflict.result !== 'victory') {
                  mappedAction.socialConflict = socialConflict;
                }
                // Other users should never see it
                // (already handled by not including it)
              } else {
                // For non-hidden social conflicts, everyone can see them
                mappedAction.socialConflict = socialConflict;
              }
            }
            
            return mappedAction;
          })
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
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
  static async enterLocation(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const { currentTag } = req.body; // Optional tag from request body
      const characterId = req.character!.characterId;

      // Get character and location
      const [character, location] = await Promise.all([
        Character.findById(characterId),
        Location.findById(locationId)
      ]);

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
      await LocationController.addOccupant(location, character, currentTag);

      // Publish Redis event for real-time WebSocket updates
      await redis.publish('location:events', JSON.stringify({
        type: 'character_entered',
        locationId: locationId.toString(),
        characterId: character._id.toString(),
        characterName: character.name,
        timestamp: new Date().toISOString()
      }));

      logger.info('Character entered location', {
        characterId,
        characterName: character.name,
        locationId,
        locationName: location.name
      });

      // Reload location to get updated occupants list
      const updatedLocation = await Location.findById(location.id);
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

    } catch (error: unknown) {
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
   * POST /game/locations/leave
   * Leave current location and return to parking (London)
   * Cleans up occupants list and emits WebSocket events
   */
  static async leaveLocation(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get character
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const oldLocationId = character.currentLocation;

      // If not in any location, nothing to do
      if (!oldLocationId) {
        res.json(successResponse(
          {
            characterId,
            currentLocation: null,
            locationName: 'London',
            previousLocation: null,
            timestamp: new Date().toISOString()
          },
          'Already at parking',
          getRequestId(req)
        ));
        return;
      }

      // ✅ SPRINT 4: Use MongoDB transactions for atomic bidirectional updates
      await smartTransaction(async (session) => {
        // 1. Remove from old location occupants
        const oldLocation = await Location.findById(oldLocationId).session(session);
        if (oldLocation) {
          // Manually remove occupant (within transaction)
          oldLocation.occupants = oldLocation.occupants.filter((occ: any) =>
            occ.characterId.toString() !== character._id.toString()
          );
          await oldLocation.save({ session });

          logger.info(`[Transaction] Character ${character.name} removed from location ${oldLocation.name} occupants`);
        }

        // 2. Update character to parking (null location)
        character.currentLocation = null;
        await character.save({ session });

        logger.info(`[Transaction] Character ${character.name} returned to parking (London)`, {
          characterId: character._id,
          previousLocationId: oldLocationId
        });
      });

      // Publish Redis event for real-time WebSocket updates
      await redis.publish('location:events', JSON.stringify({
        type: 'character_left',
        locationId: oldLocationId.toString(),
        characterId: character._id.toString(),
        characterName: character.name,
        timestamp: new Date().toISOString()
      }));

      logger.info('Character left location', {
        characterId,
        characterName: character.name,
        previousLocationId: oldLocationId
      });

      res.json(successResponse(
        {
          characterId,
          currentLocation: null,
          locationName: 'London',
          previousLocation: oldLocationId,
          timestamp: new Date().toISOString()
        },
        'Left location successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Leave location error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile lasciare la location',
        'LEAVE_LOCATION_ERROR',
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
  static async checkAccess(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;

      const [character, location] = await Promise.all([
        Character.findById(characterId),
        Location.findById(locationId)
      ]);

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

    } catch (error: unknown) {
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
  static async grantAccess(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const { targetCharacterId, permissions, duration } = req.body;
      const characterId = req.character!.characterId;

      const [character, location, targetCharacter] = await Promise.all([
        Character.findById(characterId),
        Location.findById(locationId),
        Character.findById(targetCharacterId)
      ]);

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

    } catch (error: unknown) {
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
          for (const skillReq of item.requirements.skills) {
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

        // Corporation requirements - feature not yet implemented
        if (item.requirements.corporations && item.requirements.corporations.length > 0) {
          return false;
        }
      }

      return true;
    });
  }

  private static async addOccupant(location: any, character: any, currentTag?: string): Promise<void> {
    // Remove character from all other locations first
    await Location.updateMany(
      { 'occupants.characterId': character.id },
      { $pull: { occupants: { characterId: character.id } } }
    );

    // Check if occupant already exists in this location to preserve tag
    const existingOccupant = location.occupants?.find((o: any) => o.characterId.equals(character.id));
    const tagToUse = currentTag !== undefined ? currentTag : existingOccupant?.currentTag;

    // Add to current location with new structure
    const occupant = {
      characterId: character.id,
      characterName: character.name,
      enteredAt: new Date(),
      lastSeen: new Date(),
      isActive: true,
      currentTag: tagToUse
    };

    await Location.updateOne(
      { _id: location.id },
      { $addToSet: { occupants: occupant } }
    );
  }

  /**
   * GET /game/locations/:locationId/occupants
   * Get list of occupants for a location
   */
  static async getLocationOccupants(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;

      const location = await Location.findById(locationId);
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

      // Get occupants from location, or populate from characters with currentLocation if empty
      let occupants = location.occupants?.map((occupant: any) => ({
        characterId: occupant.characterId,
        characterName: occupant.characterName,
        enteredAt: occupant.enteredAt,
        lastSeen: occupant.lastSeen,
        currentTag: occupant.currentTag || null
      })) || [];

      // Ensure current character is in occupants list if they're in this location
      const character = await Character.findById(characterId);
      const currentCharacterInLocation = character?.currentLocation?.toString() === locationId;
      if (currentCharacterInLocation) {
        const isAlreadyInOccupants = occupants.some((occ: any) => 
          occ.characterId.toString() === characterId.toString()
        );
        if (!isAlreadyInOccupants) {
          occupants.push({
            characterId: character._id,
            characterName: character.name,
            enteredAt: new Date(),
            lastSeen: new Date(),
            currentTag: null
          });
        }
      }

      res.json(successResponse(
        { occupants },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get location occupants error:', {
        message: err.message,
        stack: err.stack
      });
      
      res.status(500).json(errorResponse(
        'Errore nel recupero degli occupants',
        'GET_OCCUPANTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PATCH /game/locations/:locationId/occupant-tag
   * Update current tag for occupant in location
   */
  static async updateOccupantTag(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const { currentTag } = req.body;
      const characterId = req.character!.characterId;

      const location = await Location.findById(locationId);
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

      // Update occupant tag using schema method
      await location.updateOccupantTag(characterId, currentTag || undefined);

      logger.info('Occupant tag updated', {
        characterId,
        locationId,
        currentTag
      });

      res.json(successResponse(
        { currentTag },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Update occupant tag error:', {
        message: err.message,
        stack: err.stack
      });
      
      res.status(500).json(errorResponse(
        'Errore nell\'aggiornamento del tag',
        'UPDATE_TAG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /game/locations/:locationId/bot-details
   * Get location details for bot (bot API only - no JWT required)
   */
  static async getBotLocationDetails(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;

      const location = await Location.findById(locationId)
        .select('name description district locationLevel settings bot_enabled');

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

      res.json(successResponse({
        _id: location._id,
        name: location.name,
        description: location.description,
        district: location.district,
        locationLevel: location.locationLevel,
        bot_enabled: location.bot_enabled
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[LocationController] Error fetching bot location details:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch location details',
        'FETCH_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PATCH /game/locations/:locationId/bot-enabled
   * Enable/disable bot for location (bot API only - no JWT required)
   */
  static async updateBotEnabled(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const { bot_enabled } = req.body;

      if (typeof bot_enabled !== 'boolean') {
        res.status(400).json(errorResponse(
          'bot_enabled must be a boolean',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const location = await Location.findByIdAndUpdate(
        locationId,
        { bot_enabled },
        { returnDocument: 'after' }
      );

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

      logger.info(`[LocationController] Updated bot_enabled=${bot_enabled} for location ${location.name}`);

      res.json(successResponse({
        locationId: location._id,
        bot_enabled: location.bot_enabled
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[LocationController] Error updating bot_enabled:', error);
      res.status(500).json(errorResponse(
        'Failed to update bot_enabled',
        'UPDATE_BOT_ENABLED_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
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
      
      // Corporation access - feature not yet implemented
      if (location.access?.corporationAccess) {
        // Skipped until corporations feature is developed
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
      
      // Corporation access - feature not yet implemented
      if (location.access?.corporationAccess) {
        // Skipped until corporations feature is developed
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