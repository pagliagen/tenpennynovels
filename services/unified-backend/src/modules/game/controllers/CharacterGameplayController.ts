import { Request, Response } from 'express';
import { Character, Occupation, Location } from '@database/models';
import { redis } from '@config/runtime/redis';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';
import { CharacterCreationConfigService } from '@shared/services/CharacterCreationConfigService';
import {
  validateCharacterSubmission,
  calculateAvailableSkillPoints,
  applyOccupationBonuses,
  checkOccupationPrerequisites
} from '../utils/characterCreationUtils';
import { smartTransaction } from '../utils/transactions';
import jwt from 'jsonwebtoken';

// Helper function to get JWT_SECRET with validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

/**
 * CharacterGameplayController
 *
 * ✅ SPRINT 2 REFACTORING: Consolidates character gameplay mechanics
 * Merged from:
 * - CharacterLifecycleController (submit, select)
 * - CharacterLocationController (setCharacterLocation)
 * - CharacterSkillsController (skills, occupation bonuses)
 *
 * Handles character lifecycle, location management, and skill/occupation endpoints.
 */
export class CharacterGameplayController {
  // ========================================================================
  // LIFECYCLE MANAGEMENT
  // ========================================================================

  /**
   * POST /characters/:characterId/submit
   * Submit character for approval
   */
  static async submitCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        playerStatus: 'draft'
      }) as any);

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato o già sottomesso',
          'CHARACTER_NOT_SUBMITTABLE',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Load character creation config
      const configService = CharacterCreationConfigService.getInstance();
      const characterConfig = await configService.loadConfig();

      // Comprehensive validation using new system
      const validationResult = await validateCharacterSubmission(character, characterConfig);

      if (!validationResult.isValid) {
        logger.warn('Character submission failed validation', {
          characterId,
          userId,
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });

        res.status(400).json(errorResponse(
          'Validazione del personaggio fallita',
          'CHARACTER_VALIDATION_FAILED',
          {
            errors: validationResult.errors,
            warnings: validationResult.warnings
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validation passed - submit character
      character.playerStatus = 'pending';
      character.submittedAt = new Date();
      await character.save();

      try {
        await redis.getClient().publish('character:events', JSON.stringify({
          type: 'character_created',
          characterId: character.id,
          characterName: character.name,
          userId,
          username: req.user!.username,
          timestamp: new Date().toISOString()
        }));
      } catch (publishError) {
        logger.warn('Failed to publish character submission event', { characterId: character.id, error: publishError });
      }

      logger.info('Character submitted for approval', {
        characterId: character.id,
        userId,
        name: character.name,
        warnings: validationResult.warnings
      });

      res.json(successResponse(
        {
          character: {
            id: character.id,
            playerStatus: character.playerStatus,
            submittedAt: character.submittedAt
          },
          warnings: validationResult.warnings
        },
        'Personaggio sottomesso per approvazione',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character submit error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile sottomettere il personaggio',
        'CHARACTER_SUBMIT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /characters/:characterId/select
   * Select character as active (generates character_context cookie)
   */
  static async selectCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      // Allow all statuses except DELETED (DRAFT characters can be selected too)
      const character = await (Character.findOne({
        _id: characterId,
        userId: userId
      }) as any);

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_SELECTABLE',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Deactivate other characters for this user
      await (Character.updateMany(
        { userId: userId, _id: { $ne: characterId } },
        { isActive: false }
      ) as any);

      // Activate selected character
      character.isActive = true;
      character.lastActive = new Date();
      await character.save();

      // Generate character context token
      const characterToken = jwt.sign(
        {
          characterId: character.id,
          characterName: character.name,
          userId: userId,
          gameplayRoles: character.gameplayRoles || [],
          isGestore: character.isGestore || false,
          playerStatus: character.playerStatus || 'DRAFT',
          characterPermissions: character.characterPermissions || []
        },
        getJwtSecret(),
        { expiresIn: '24h' }
      );

      // Set character context cookie
      res.cookie('character_context', characterToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.tenpennynovels.com' : 'localhost',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      logger.info('Character selected', {
        characterId: character.id,
        userId,
        name: character.name
      });

      res.json(successResponse(
        {
          character: {
            id: character.id,
            name: character.name,
            playerStatus: character.playerStatus,
            occupation: character.occupation,
            currentLocation: character.currentLocation,
            gameplayRoles: character.gameplayRoles,
            lastActive: character.lastActive
          },
          gameAccess: {
            canAccessGame: true,
            canAccessLocations: true,
            canSendMessages: true,
            canUseItems: true
          }
        },
        'Personaggio selezionato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character select error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile selezionare il personaggio',
        'CHARACTER_SELECT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // ========================================================================
  // LOCATION MANAGEMENT
  // ========================================================================

  /**
   * POST /characters/set-location
   * Set character's current location
   */
  static async setCharacterLocation(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.body;
      const characterId = req.character!.characterId;

      // locationId is required in the request body (empty string = London)
      if (locationId === undefined || locationId === null) {
        res.status(400).json(errorResponse(
          'ID location obbligatorio (usa stringa vuota per Londra)',
          'MISSING_LOCATION_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get character
      const character = await (Character.findById(characterId) as any);
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

      // Get location info for response
      let location: any = null;

      // Handle empty locationId (parked at London/root)
      if (locationId === '') {
        location = { name: 'London' }; // Mock location for London/root
      } else {
        // Get location and verify access for specific locations
        location = await (Location.findById(locationId) as any);
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
      }

      // ✅ SPRINT 4: Use MongoDB transactions for atomic bidirectional updates
      // Prevents data inconsistency if one operation succeeds but another fails
      const oldLocation = character.currentLocation;
      const newLocation = locationId === '' ? null : locationId;

      await smartTransaction(async (session) => {
        // 1. Update character location
        character.currentLocation = newLocation;
        character.lastActive = new Date();
        await character.save({ session });

        logger.info(`[Transaction] Character location updated: ${character.name} → ${newLocation || 'London'}`, {
          characterId: character._id,
          oldLocation,
          newLocation
        });

        // 2. Remove from old location occupants if changing location
        if (oldLocation && oldLocation !== '' && oldLocation !== newLocation) {
          const oldLoc = await Location.findById(oldLocation).session(session);
          if (oldLoc) {
            // Manually remove occupant (within transaction)
            oldLoc.occupants = oldLoc.occupants.filter((occ: any) =>
              occ.characterId.toString() !== character._id.toString()
            );
            await oldLoc.save({ session });

            logger.info(`[Transaction] Character removed from old location occupants: ${oldLoc.name}`, {
              characterId: character._id,
              locationId: oldLocation
            });
          }
        }

        // 3. If entering a specific location (not empty), add character to location occupants
        if (newLocation && newLocation !== '') {
          const loc = await Location.findById(newLocation).session(session);
          if (loc) {
            // Check if character is already in occupants
            const existingOccupant = loc.occupants.find((occ: any) =>
              occ.characterId.toString() === character._id.toString()
            );

            if (!existingOccupant) {
              // Add character to occupants
              loc.occupants.push({
                characterId: character._id,
                characterName: character.name,
                enteredAt: new Date(),
                lastSeen: new Date(),
                isActive: true
              } as any);

              await loc.save({ session });

              logger.info(`[Transaction] Character added to location occupants: ${loc.name}`, {
                characterId: character._id,
                locationId: newLocation
              });
            } else {
              // Update last seen
              existingOccupant.lastSeen = new Date();
              await loc.save({ session });

              logger.info(`[Transaction] Character lastSeen updated in location: ${loc.name}`, {
                characterId: character._id,
                locationId: newLocation
              });
            }
          }
        }
      });

      res.json(successResponse(
        {
          characterId,
          currentLocation: character.currentLocation,
          locationName: location.name,
          previousLocation: oldLocation,
          timestamp: new Date().toISOString()
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      console.error('Set character location error:', err);
      res.status(500).json(errorResponse(
        'Impossibile impostare la location del personaggio',
        'SET_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // ========================================================================
  // SKILLS & OCCUPATION MANAGEMENT
  // ========================================================================

  /**
   * GET /characters/:characterId/skill-points
   * Calculate available skill points for a character
   */
  static async getSkillPoints(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await Character.findOne({
        _id: characterId,
        userId: userId
      });

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

      // Load character creation config
      const configService = CharacterCreationConfigService.getInstance();
      const characterConfig = await configService.loadConfig();

      const skillPoints = calculateAvailableSkillPoints(character, characterConfig);

      logger.info('Skill points calculated', {
        characterId,
        userId,
        totalAvailable: skillPoints.totalAvailable
      });

      res.json(successResponse(
        {
          skillPoints
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get skill points error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      res.status(500).json(errorResponse(
        'Impossibile calcolare i punti abilità',
        'SKILL_POINTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /characters/:characterId/apply-occupation-bonuses
   * Apply occupation bonuses to character skills
   */
  static async applyOccupationBonusesEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { occupationId, selectedAlternatives } = req.body;
      const userId = req.user!.userId;

      const character = await Character.findOne({
        _id: characterId,
        userId: userId,
        status: 'DRAFT'
      });

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non in stato bozza',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if bonuses already applied
      if (character.occupationBonusesApplied) {
        res.status(400).json(errorResponse(
          'I bonus occupazione sono già stati applicati',
          'BONUSES_ALREADY_APPLIED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const occupation = await Occupation.findById(occupationId)
        .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType')
        .populate('bonusSkills.skillId', 'name category');

      if (!occupation) {
        res.status(404).json(errorResponse(
          'Occupazione non trovata',
          'OCCUPATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check prerequisites
      const prereqCheck = await checkOccupationPrerequisites(character, occupation);
      if (!prereqCheck.canAccess) {
        res.status(400).json(errorResponse(
          'Il personaggio non soddisfa i prerequisiti dell\'occupazione',
          'PREREQUISITES_NOT_MET',
          {
            issues: prereqCheck.issues
          },
          400,
          getRequestId(req)
        ));
        return;
      }

      // Load character creation config
      const configService = CharacterCreationConfigService.getInstance();
      const characterConfig = await configService.loadConfig();

      // Apply bonuses
      const result = await applyOccupationBonuses(character, occupation, characterConfig, selectedAlternatives);

      // Update character occupation
      character.occupation = occupation._id;

      // Save character
      await character.save();

      logger.info('Occupation bonuses applied', {
        characterId,
        userId,
        occupationId,
        bonusesApplied: result.bonusesApplied.length
      });

      res.json(successResponse(
        {
          result,
          character: {
            id: character.id,
            skills: character.skills,
            occupation: character.occupation,
            occupationBonusesApplied: character.occupationBonusesApplied
          }
        },
        'Bonus occupazione applicati con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Apply occupation bonuses error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      res.status(500).json(errorResponse(
        'Impossibile applicare i bonus occupazione',
        'APPLY_BONUSES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /occupations/:occupationId/check-prerequisites
   * Check if character meets occupation prerequisites
   */
  static async checkOccupationPrerequisitesEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const { occupationId } = req.params;
      const { characterId } = req.query;
      const userId = req.user!.userId;

      const character = await Character.findOne({
        _id: characterId,
        userId: userId
      });

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

      const occupation = await Occupation.findById(occupationId);

      if (!occupation) {
        res.status(404).json(errorResponse(
          'Occupazione non trovata',
          'OCCUPATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const prereqCheck = await checkOccupationPrerequisites(character, occupation);

      logger.info('Occupation prerequisites checked', {
        characterId,
        userId,
        occupationId,
        canAccess: prereqCheck.canAccess
      });

      res.json(successResponse(
        {
          canAccess: prereqCheck.canAccess,
          issues: prereqCheck.issues,
          occupation: {
            id: occupation.id,
            name: occupation.name
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Check occupation prerequisites error:', {
        message: err.message,
        stack: err.stack,
        occupationId: req.params.occupationId
      });

      res.status(500).json(errorResponse(
        'Impossibile verificare i prerequisiti',
        'CHECK_PREREQUISITES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
