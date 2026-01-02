import { Request, Response } from 'express';
import { Character, Location, Corporation, Occupation } from '../../../../packages/database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { CharacterVisibilityFilter } from '../../../../packages/shared/utils/characterVisibility';
import { FinancialUtils } from '../utils/financialUtils';
import { CharacterCreationConfigService } from '../../../../packages/shared/src/services/CharacterCreationConfigService';
import {
  calculateAvailableSkillPoints,
  applyOccupationBonuses,
  validateCharacterSubmission,
  checkOccupationPrerequisites
} from '../utils/characterCreationUtils';
import { GET, POST, PUT, DELETE } from '../../../../packages/shared/src/decorators/ApiDoc';
import jwt from 'jsonwebtoken';

// Helper function to get JWT_SECRET with validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export class CharacterController {
  /**
   * POST /game/characters/create
   * Create new character
   */
  @POST('/characters/create', 'Create new character', 'game-backend', {
    authentication: 'required',
    tags: ['Characters'],
    parameters: [
      { name: 'concept', type: 'body', dataType: 'string', required: true, description: 'Character concept' },
      { name: 'preferredOccupation', type: 'body', dataType: 'string', required: false, description: 'Preferred occupation' }
    ],
    responses: [
      { status: 201, description: 'Character created successfully' },
      { status: 400, description: 'Invalid input data' },
      { status: 401, description: 'Authentication required' }
    ]
  })
  static async createCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { concept, preferredOccupation, preferredBackground, preferredSocialClass } = req.body;
      const userId = req.user!.userId;

      // Create a basic character structure
      const character = new Character({
        userId,
        name: 'New Character',
        status: 'DRAFT',
        concept,
        preferredOccupation,
        preferredBackground,
        preferredSocialClass,
        stats: {
          strength: 50,
          dexterity: 50,
          intelligence: 50,
          constitution: 50,
          appearance: 50,
          power: 50,
          size: 50,
          education: 50
        },
        skills: {},
        gameplayRoles: ['personaggio'],
        isActive: false
      });

      await character.save();

      logger.info('Character created', {
        characterId: character.id,
        userId,
        concept
      });

      const response: ApiResponse = {
        success: true,
        data: {
          character: {
            id: character.id,
            name: character.name,
            status: character.status,
            stats: character.stats,
            skills: character.skills,
            occupation: character.occupation,
            background: character.background,
            description: character.description
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(201).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character creation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile creare il personaggio',
        code: 'CHARACTER_CREATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/characters/my
   * Get user's characters
   */
  static async getMyCharacters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const characters = await (Character.find({ 
        userId,
        status: { $ne: 'DELETED' }
      }) as any)
        .select('id name status occupation isActive currentLocation gameplayRoles submittedAt lastActive')
        .sort({ createdAt: -1 });

      const response: ApiResponse = {
        success: true,
        data: {
          characters: characters.map((char: any) => ({
            id: char.id,
            name: char.name,
            status: char.status,
            occupation: char.occupation,
            isActive: char.isActive,
            currentLocation: char.currentLocation,
            gameplayRoles: char.gameplayRoles,
            submittedAt: char.submittedAt,
            lastActive: char.lastActive
          }))
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get characters error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i personaggi',
        code: 'GET_CHARACTERS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/characters/:characterId
   * Get character details (with ownership check)
   */
  static async getCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      logger.info('Getting character', { characterId, userId });

      // Determina se l'utente è un master (controlla i ruoli dal token)
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('gestore') || false;

      logger.info('User roles check', { isMaster, gameplayRoles: req.character?.gameplayRoles });

      const character = await (Character.findOne({
        _id: characterId,
        status: { $ne: 'DELETED' }
      }) as any);

      logger.info('Character found', { found: !!character, characterName: character?.name });

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Determina se è il proprietario del personaggio
      const isOwner = character.userId.toString() === userId;

      logger.info('Ownership check', { isOwner, characterUserId: character.userId.toString(), requestUserId: userId });

      // Converti il documento Mongoose in JSON per eliminare i metadati
      const characterJson = character.toJSON();

      // Aggiungi il nome dell'occupazione e professional skills se presente
      if (character.occupation) {
        const { Occupation, Skill } = require('../../../../packages/database/models');
        let occupation = null;
        
        // Verifica se l'occupazione è un ObjectId valido o una stringa
        try {
          // Prima prova a cercare per ID
          occupation = await Occupation.findById(character.occupation);
        } catch (error: any) {
          logger.warn('Failed to find occupation by ID, trying by name:', { occupation: character.occupation, error: error.message });
          // Se fallisce, prova a cercare per nome
          if (typeof character.occupation === 'string') {
            occupation = await Occupation.findOne({ name: character.occupation });
            if (occupation) {
              logger.info('Found occupation by name, updating character with correct ObjectId', { 
                characterId: character._id, 
                oldOccupation: character.occupation, 
                newOccupationId: occupation._id 
              });
              // Aggiorna il personaggio con l'ObjectId corretto
              character.occupation = occupation._id;
              await character.save();
            }
          }
        }
        
        if (occupation) {
          characterJson.occupationName = occupation.name;
          characterJson.occupationData = occupation.toJSON(); // Include all occupation data for the wizard
          
          // Converti professional skills da ID a nomi per evidenziazione frontend
          if (occupation.benefits && occupation.benefits.professionalSkills) {
            const skillIds = occupation.benefits.professionalSkills;
            const skills = await Skill.find({ _id: { $in: skillIds } });
            characterJson.professionalSkillNames = skills.map(skill => skill.name);
          }
        } else {
          logger.warn('Occupation not found for character', { characterId: character._id, occupation: character.occupation });
        }
      }

      // Popula gli oggetti dell'equipaggiamento con i dettagli completi
      if (characterJson.equipment && characterJson.equipment.length > 0) {
        const { Item } = require('../../../../packages/database/models');
        const equipmentItems = await Item.find({ _id: { $in: characterJson.equipment } });
        
        // Sostituisce gli ID con gli oggetti completi
        characterJson.equipment = equipmentItems.map(item => ({
          id: item._id.toString(),
          itemId: item._id.toString(),
          name: item.name,
          description: item.description,
          category: item.category,
          rarity: item.rarity,
          quantity: 1 // Default quantity
        }));

        logger.info('Equipment populated', { 
          characterId, 
          equipmentCount: characterJson.equipment.length,
          items: characterJson.equipment.map(item => item.name)
        });
      }

      // Applica le regole di visibilità
      let filteredCharacter;
      try {
        if (isOwner) {
          // Il proprietario può vedere tutti i dati - restituisci tutto il JSON
          logger.info('Returning full character data for owner');
          filteredCharacter = characterJson;
        } else {
          // Altri utenti vedono solo quello che sono autorizzati a vedere
          logger.info('Filtering character for other user', { isMaster });
          filteredCharacter = CharacterVisibilityFilter.filterCharacter(
            characterJson, 
            userId, 
            isMaster
          );
        }
        logger.info('Character filtering completed');
      } catch (filterError) {
        logger.error('Character filtering error', { 
          error: (filterError as Error).message,
          stack: (filterError as Error).stack,
          name: (filterError as Error).name,
          characterId: req.character?.characterId,
          params: req.params,
          query: req.query
        });
        throw filterError;
      }

      const response: ApiResponse = {
        success: true,
        data: {
          character: {
            ...filteredCharacter,
            isOwnCharacter: isOwner
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character error:', { 
        message: err.message, 
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare il personaggio',
        code: 'GET_CHARACTER_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/characters/public/:characterId
   * Get character public profile (with visibility rules)
   */
  static async getPublicCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      
      // Determina se l'utente è un master (controlla i ruoli dal token)
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('gestore') || false;

      const character = await (Character.findOne({
        _id: characterId,
        status: { $ne: 'DELETED' } // Exclude only deleted characters
      }) as any);

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Determina se è il proprietario del personaggio
      const isOwner = character.userId.toString() === userId;

      // Converti il documento Mongoose in JSON per eliminare i metadati
      const characterJson = character.toJSON();

      // Applica le regole di visibilità
      let filteredCharacter;
      if (isOwner) {
        // Il proprietario può vedere tutti i dati - restituisci tutto il JSON
        filteredCharacter = characterJson;
      } else {
        // Altri utenti vedono solo quello che sono autorizzati a vedere
        filteredCharacter = CharacterVisibilityFilter.filterCharacter(
          characterJson, 
          userId, 
          isMaster
        );
      }

      const response: ApiResponse = {
        success: true,
        data: {
          character: filteredCharacter
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get public character error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare il personaggio',
        code: 'GET_PUBLIC_CHARACTER_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * PUT /game/characters/:characterId
   * Update character (only if DRAFT status)
   */
  static async updateCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      const updates = req.body;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: { $ne: 'DELETED' }
      }) as any);

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Filter updates based on character status
      let filteredUpdates = updates;
      const limitedEditableFields = ['avatar', 'profileImage', 'prestavolto', 'audioTheme'];
      
      if (character.status !== 'DRAFT') {
        // For non-DRAFT characters, only allow limited editable fields
        filteredUpdates = {};
        limitedEditableFields.forEach(field => {
          if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
          }
        });
        
        logger.info('Filtered updates for non-DRAFT character', {
          characterId,
          characterStatus: character.status,
          originalFields: Object.keys(updates),
          filteredFields: Object.keys(filteredUpdates)
        });
      }

      // Handle field name mapping from frontend to backend (only for DRAFT)
      if (character.status === 'DRAFT') {
        if (filteredUpdates.firstName !== undefined) {
          character.name = filteredUpdates.firstName;
        }
        if (filteredUpdates.lastName !== undefined) {
          character.surname = filteredUpdates.lastName;
        }
      }

      // Update allowed fields based on character status
      let allowedFields: string[];
      if (character.status === 'DRAFT') {
        // DRAFT characters can update all fields
        allowedFields = [
          'name', 'surname', 'age', 'apparentAge', 'gender', 'birthPlace',
          'physicalDescription', 'publicDescription', 'privateDescription', 'nationality', 
          'description', 'stats', 'skills', 'derived', 'occupation', 'avatar', 'profileImage',
          'prestavolto', 'guidedBackground', 'motivations', 'fears', 'audioTheme'
        ];
      } else {
        // Non-DRAFT characters can only update limited fields
        allowedFields = limitedEditableFields;
      }
      
      allowedFields.forEach((field: string) => {
        if (filteredUpdates[field] !== undefined) {
          character[field] = filteredUpdates[field];
        }
      });

      // Handle background JSON parsing - estrai motivations e fears dal JSON (only for DRAFT)
      if (character.status === 'DRAFT' && filteredUpdates.background !== undefined) {
        try {
          // Se background è una stringa JSON, parsala ed estrai motivations e fears
          if (typeof filteredUpdates.background === 'string') {
            const parsedBackground = JSON.parse(filteredUpdates.background);
            if (parsedBackground.motivations) {
              character.motivations = parsedBackground.motivations;
            }
            if (parsedBackground.fears) {
              character.fears = parsedBackground.fears;
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse background JSON', { 
            background: filteredUpdates.background, 
            error: (parseError as Error).message 
          });
        }
      }

      // AUTO-INITIALIZE CHARACTER FINANCES FROM FINANZA SKILL (only for DRAFT characters)
      if (character.status === 'DRAFT' && filteredUpdates.skills && filteredUpdates.skills['Finanza']) {
        try {
          const finanzaValue = filteredUpdates.skills['Finanza'];
          const socialClass = await FinancialUtils.calculateSocialClass(finanzaValue);
          
          if (socialClass) {
            // Initialize/update character finances based on social class from FINANZA skill
            await FinancialUtils.initializeCharacterFinances(characterId, socialClass);
            
            logger.info('Character finances initialized from FINANZA skill', {
              characterId,
              finanzaValue,
              socialClassName: socialClass.name,
              weeklyCredit: socialClass.weeklyCredit
            });
          } else {
            logger.warn('Could not determine social class from FINANZA skill', {
              characterId,
              finanzaValue
            });
          }
        } catch (error: any) {
          logger.error('Error initializing character finances from FINANZA skill', {
            characterId,
            error: (error as Error).message
          });
        }
      }

      await character.save();

      logger.info('Character updated', {
        characterId: character.id,
        userId,
        characterStatus: character.status,
        originalFields: Object.keys(updates),
        appliedFields: Object.keys(filteredUpdates)
      });

      const response: ApiResponse = {
        success: true,
        data: {
          character: {
            id: character.id,
            name: character.name,
            surname: character.surname,
            age: character.age,
            apparentAge: character.apparentAge,
            gender: character.gender,
            birthPlace: character.birthPlace,
            status: character.status,
            stats: character.stats,
            derived: character.derived,
            skills: character.skills,
            occupation: character.occupation,
            physicalDescription: character.physicalDescription,
            publicDescription: character.publicDescription,
            privateDescription: character.privateDescription,
            motivations: character.motivations,
            fears: character.fears,
            description: character.description,
            avatar: character.avatar,
            prestavolto: character.prestavolto
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character update error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId,
        updates: Object.keys(req.body || {})
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare il personaggio',
        code: 'CHARACTER_UPDATE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /game/characters/:characterId/submit
   * Submit character for approval
   */
  static async submitCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: 'DRAFT'
      }) as any);

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato o già sottomesso',
          code: 'CHARACTER_NOT_SUBMITTABLE',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

        const response: ApiResponse = {
          success: false,
          error: 'Validazione del personaggio fallita',
          code: 'CHARACTER_VALIDATION_FAILED',
          details: {
            errors: validationResult.errors,
            warnings: validationResult.warnings
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validation passed - submit character
      character.status = 'PENDING_APPROVAL';
      character.submittedAt = new Date();
      await character.save();

      // TODO: Publish Redis event for approval queue
      // redis.publish('character:submitted_for_approval', { characterId, userId });

      logger.info('Character submitted for approval', {
        characterId: character.id,
        userId,
        name: character.name,
        warnings: validationResult.warnings
      });

      const response: ApiResponse = {
        success: true,
        message: 'Personaggio sottomesso per approvazione',
        data: {
          character: {
            id: character.id,
            status: character.status,
            submittedAt: character.submittedAt
          },
          warnings: validationResult.warnings
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character submit error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile sottomettere il personaggio',
        code: 'CHARACTER_SUBMIT_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /game/characters/:characterId/select
   * Select character as active (generates character_context cookie)
   */
  static async selectCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: 'APPROVED'
      }) as any);

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato o non approvato',
          code: 'CHARACTER_NOT_SELECTABLE',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
          gameplayRoles: character.gameplayRoles || ['personaggio']
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

      const response: ApiResponse = {
        success: true,
        message: 'Personaggio selezionato con successo',
        data: {
          character: {
            id: character.id,
            name: character.name,
            status: character.status,
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
          },
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character select error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile selezionare il personaggio',
        code: 'CHARACTER_SELECT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * DELETE /game/characters/:characterId
   * Delete character (only if DRAFT)
   */
  static async deleteCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: 'DRAFT'
      }) as any);

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato o non può essere eliminato',
          code: 'CHARACTER_NOT_DELETABLE',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      await (Character.deleteOne({ _id: characterId }) as any);

      logger.info('Character deleted', {
        characterId,
        userId,
        name: character.name
      });

      const response: ApiResponse = {
        success: true,
        message: 'Personaggio eliminato con successo',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character delete error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile eliminare il personaggio',
        code: 'CHARACTER_DELETE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /characters/public-list
   * Get list of all characters (including isOwnCharacter flag for filtering)
   */
  static async getPublicCharactersList(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = req.user!.userId;

      // Get all characters that are not deleted (include all users' characters)
      const characters = await (Character.find({
        status: { $ne: 'DELETED' } // Exclude only deleted characters
      })
      .select('_id name surname avatar status userId lastActive')
      .sort({ name: 1 })
      .limit(200) as any); // Increased limit for complete list
      
      // Activity timeout: 5 minutes (same as global presence logic)
      const activityTimeout = 5 * 60 * 1000; // 5 minutes in milliseconds
      const cutoffTime = new Date(Date.now() - activityTimeout);

      // Transform for frontend
      const charactersList = characters.map(character => {
        const isOnline = character.lastActive && character.lastActive >= cutoffTime;
        
        return {
          id: character._id.toString(),
          name: character.name,
          surname: character.surname,
          avatar: character.avatar,
          status: character.status,
          isOwnCharacter: character.userId.toString() === currentUserId,
          isOnline: Boolean(isOnline)
        };
      });

      logger.info('Public characters list requested', {
        requesterId: currentUserId,
        charactersFound: charactersList.length
      });

      const response: ApiResponse = {
        success: true,
        data: {
          characters: charactersList
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get public characters list error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare la lista dei personaggi',
        code: 'GET_CHARACTERS_LIST_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * POST /characters/set-location
   * Update character's current location
   */
  static async setCharacterLocation(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.body;
      const characterId = req.character!.characterId;
      
      // locationId is required in the request body (empty string = London)
      if (locationId === undefined || locationId === null) {
        const response: ApiResponse = {
          success: false,
          error: 'ID location obbligatorio (usa stringa vuota per Londra)',
          code: 'MISSING_LOCATION_ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Get character
      const character = await (Character.findById(characterId) as any);
      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
          const response: ApiResponse = {
            success: false,
            error: 'Location non trovata',
            code: 'LOCATION_NOT_FOUND',
            timestamp: new Date().toISOString()
          };
          res.status(404).json(response);
          return;
        }
      }

      // Update character location
      const oldLocation = character.currentLocation;
      character.currentLocation = locationId === '' ? null : locationId;
      character.lastActive = new Date();
      
      await character.save();

      const response: ApiResponse = {
        success: true,
        data: {
          characterId,
          currentLocation: character.currentLocation,
          locationName: location.name,
          previousLocation: oldLocation,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      console.error('Set character location error:', err);
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile impostare la location del personaggio',
        code: 'SET_LOCATION_ERROR',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /characters/:characterId/corporations
   * Get corporations associated with a character
   */
  @GET('/characters/:characterId/corporations', 'Get character corporations', 'game-backend', {
    authentication: 'required',
    tags: ['Characters'],
    parameters: [
      { name: 'characterId', type: 'path', dataType: 'string', required: true, description: 'Character ID' }
    ],
    responses: [
      { status: 200, description: 'Character corporations retrieved successfully' },
      { status: 404, description: 'Character not found' },
      { status: 401, description: 'Authentication required' }
    ]
  })
  static async getCharacterCorporations(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      // Verify character exists and belongs to user
      const character = await Character.findOne({
        _id: characterId,
        userId: userId,
        status: { $ne: 'DELETED' }
      });

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Find corporations where this character is a member
      const corporations = await Corporation.find({
        'members.characterId': characterId
      }).select('name description type membershipType isRecruiting members');

      // Extract character's membership info for each corporation
      const characterCorporations = corporations.map(corp => {
        const membership = corp.members.find(
          (member: any) => member.characterId.toString() === characterId
        );

        return {
          _id: corp._id,
          name: corp.name,
          description: corp.description,
          type: corp.type,
          membership: {
            roleId: membership?.roleId,
            joinedAt: membership?.joinedAt,
            membershipType: membership?.membershipType,
            isActive: membership?.isActive
          }
        };
      });

      const response: ApiResponse = {
        success: true,
        data: {
          characterId,
          characterName: `${character.name} ${character.surname}`,
          corporations: characterCorporations
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character corporations error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le corporazioni del personaggio',
        code: 'GET_CHARACTER_CORPORATIONS_ERROR',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/characters/:characterId/skill-points
   * Calculate available skill points for a character
   */
  @GET('/characters/:characterId/skill-points', 'Get available skill points', 'game-backend', {
    authentication: 'required',
    tags: ['Characters', 'Character Creation'],
    parameters: [
      { name: 'characterId', type: 'path', dataType: 'string', required: true, description: 'Character ID' }
    ],
    responses: [
      { status: 200, description: 'Skill points calculated successfully' },
      { status: 404, description: 'Character not found' },
      { status: 401, description: 'Authentication required' }
    ]
  })
  static async getSkillPoints(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await Character.findOne({
        _id: characterId,
        userId: userId
      });

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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

      const response: ApiResponse = {
        success: true,
        data: {
          skillPoints
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get skill points error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile calcolare i punti abilità',
        code: 'SKILL_POINTS_ERROR',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  /**
   * POST /game/characters/:characterId/apply-occupation-bonuses
   * Apply occupation bonuses to character skills
   */
  @POST('/characters/:characterId/apply-occupation-bonuses', 'Apply occupation bonuses', 'game-backend', {
    authentication: 'required',
    tags: ['Characters', 'Character Creation'],
    parameters: [
      { name: 'characterId', type: 'path', dataType: 'string', required: true, description: 'Character ID' },
      { name: 'occupationId', type: 'body', dataType: 'string', required: true, description: 'Occupation ID' },
      { name: 'selectedAlternatives', type: 'body', dataType: 'object', required: false, description: 'Map of requirement ID to selected alternative skill ID' }
    ],
    responses: [
      { status: 200, description: 'Bonuses applied successfully' },
      { status: 400, description: 'Invalid occupation or bonuses already applied' },
      { status: 404, description: 'Character or occupation not found' },
      { status: 401, description: 'Authentication required' }
    ]
  })
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
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato o non in stato bozza',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check if bonuses already applied
      if (character.occupationBonusesApplied) {
        const response: ApiResponse = {
          success: false,
          error: 'I bonus occupazione sono già stati applicati',
          code: 'BONUSES_ALREADY_APPLIED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const occupation = await Occupation.findById(occupationId).populate('bonusSkills.skillId');

      if (!occupation) {
        const response: ApiResponse = {
          success: false,
          error: 'Occupazione non trovata',
          code: 'OCCUPATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check prerequisites
      const prereqCheck = await checkOccupationPrerequisites(character, occupation);
      if (!prereqCheck.canAccess) {
        const response: ApiResponse = {
          success: false,
          error: 'Il personaggio non soddisfa i prerequisiti dell\'occupazione',
          code: 'PREREQUISITES_NOT_MET',
          details: {
            issues: prereqCheck.issues
          },
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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

      const response: ApiResponse = {
        success: true,
        message: 'Bonus occupazione applicati con successo',
        data: {
          result,
          character: {
            id: character.id,
            skills: character.skills,
            occupation: character.occupation,
            occupationBonusesApplied: character.occupationBonusesApplied
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Apply occupation bonuses error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile applicare i bonus occupazione',
        code: 'APPLY_BONUSES_ERROR',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/occupations/:occupationId/check-prerequisites
   * Check if character meets occupation prerequisites
   */
  @GET('/occupations/:occupationId/check-prerequisites', 'Check occupation prerequisites', 'game-backend', {
    authentication: 'required',
    tags: ['Characters', 'Occupations'],
    parameters: [
      { name: 'occupationId', type: 'path', dataType: 'string', required: true, description: 'Occupation ID' },
      { name: 'characterId', type: 'query', dataType: 'string', required: true, description: 'Character ID' }
    ],
    responses: [
      { status: 200, description: 'Prerequisites checked successfully' },
      { status: 404, description: 'Character or occupation not found' },
      { status: 401, description: 'Authentication required' }
    ]
  })
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
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const occupation = await Occupation.findById(occupationId);

      if (!occupation) {
        const response: ApiResponse = {
          success: false,
          error: 'Occupazione non trovata',
          code: 'OCCUPATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const prereqCheck = await checkOccupationPrerequisites(character, occupation);

      logger.info('Occupation prerequisites checked', {
        characterId,
        userId,
        occupationId,
        canAccess: prereqCheck.canAccess
      });

      const response: ApiResponse = {
        success: true,
        data: {
          canAccess: prereqCheck.canAccess,
          issues: prereqCheck.issues,
          occupation: {
            id: occupation.id,
            name: occupation.name,
            allowedGenders: occupation.allowedGenders
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Check occupation prerequisites error:', {
        message: err.message,
        stack: err.stack,
        occupationId: req.params.occupationId
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile verificare i prerequisiti',
        code: 'CHECK_PREREQUISITES_ERROR',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}