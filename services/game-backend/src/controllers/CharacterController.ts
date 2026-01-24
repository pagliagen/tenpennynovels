import { Request, Response } from 'express';
import { Character, Location, Corporation, Occupation, Skill } from '../../../database/models';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { CharacterVisibilityFilter } from '../../../shared/utils/characterVisibility';
import { FinancialUtils } from '../utils/financialUtils';
import { CharacterCreationConfigService } from '../../../shared/src/services/CharacterCreationConfigService';
import {
  calculateAvailableSkillPoints,
  applyOccupationBonuses,
  validateCharacterSubmission,
  checkOccupationPrerequisites
} from '../utils/characterCreationUtils';
import { GET, POST, PUT, DELETE } from '../../../shared/src/decorators/ApiDoc';
import jwt from 'jsonwebtoken';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

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

      res.status(201).json(createResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character creation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile creare il personaggio',
        'CHARACTER_CREATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get characters error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i personaggi',
        'GET_CHARACTERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Determina se è il proprietario del personaggio
      const isOwner = character.userId.toString() === userId;

      logger.info('Ownership check', { isOwner, characterUserId: character.userId.toString(), requestUserId: userId });

      // Converti il documento Mongoose in JSON per eliminare i metadati
      const characterJson = character.toJSON();
      
      // Converti skills Map in oggetto JavaScript se necessario (Mongoose Map non viene serializzata automaticamente)
      if (character.skills && character.skills instanceof Map) {
        const skillsObj: any = {};
        character.skills.forEach((value, key) => {
          skillsObj[key] = value;
        });
        characterJson.skills = skillsObj;
      } else if (!characterJson.skills || Object.keys(characterJson.skills).length === 0) {
        // Se skills è vuoto o non esiste, inizializzalo come oggetto vuoto
        characterJson.skills = {};
      }

      // Aggiungi il nome dell'occupazione e professional skills se presente
      if (character.occupation) {
        const { Occupation, Skill } = require('../../../database/models');
        let occupation = null;
        
        // Verifica se l'occupazione è un ObjectId valido o una stringa
        // Nota: skillId nello schema è String, non ObjectId ref, quindi non serve populate
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
          characterJson.occupationData = occupation.toJSON(); // Include all occupation data for the wizard (with populated skills)
          
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
        const { Item } = require('../../../database/models');
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

      res.json(successResponse(
        {
          character: {
            ...filteredCharacter,
            isOwnCharacter: isOwner
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character error:', { 
        message: err.message, 
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare il personaggio',
        'GET_CHARACTER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        {
          character: filteredCharacter
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get public character error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare il personaggio',
        'GET_PUBLIC_CHARACTER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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
          'name', 'surname', 'age', 'apparentAge', 'gender', 'birthDate', 'birthPlace',
          'physicalDescription', 'publicDescription', 'privateDescription', 'nationality', 
          'description', 'stats', 'skills', 'derived', 'occupation', 'avatar', 'profileImage',
          'prestavolto', 'guidedBackground', 'motivations', 'fears', 'audioTheme',
          // Anagrafica completa
          'height', 'weight', 'eyeColor', 'hairColor', 'visibleMarks', 'hiddenMarks',
          'maritalStatus', 'illnesses', 'educationTitle', 'criminalRecord', 'currentOccupation',
          // Background strutturato
          'background'
        ];
      } else {
        // Non-DRAFT characters can only update limited fields
        allowedFields = limitedEditableFields;
      }
      
      // Handle skills separately (needs async/await for database query)
      if (filteredUpdates.skills && allowedFields.includes('skills')) {
        // Solo per personaggi DRAFT: salvare tutte le skills, non solo quelle modificate
        if (character.status === 'DRAFT') {
          // Recupera tutte le base skills dal database
          const baseSkills = await Skill.find({ visible: true })
            .sort({ sortOrder: 1, name: 1 })
            .lean();
          
          // Helper per calcolare il base value di una skill
          const calculateSkillBaseValue = (skill: any): number => {
            if (typeof skill.baseValue === 'number') {
              return skill.baseValue;
            }
            if (typeof skill.baseValue === 'string') {
              if (skill.baseValue.startsWith('VALUE:')) {
                return parseInt(skill.baseValue.replace('VALUE:', '')) || 0;
              }
              if (skill.baseValue.startsWith('FORMULA:')) {
                const formula = skill.baseValue.replace('FORMULA:', '');
                const statValue = character.stats?.[formula.toLowerCase()] || 0;
                return statValue;
              }
            }
            return 0;
          };
          
          // Converti skills esistenti del character in oggetto
          const existingSkillsObj: any = {};
          if (character.skills && character.skills instanceof Map) {
            character.skills.forEach((value, key) => {
              existingSkillsObj[key] = value;
            });
          } else if (character.skills) {
            Object.assign(existingSkillsObj, character.skills);
          }
          
          // Crea un oggetto completo con tutte le skills
          const allSkillsToSave: Record<string, any> = {};
          
          // Per ogni base skill, crea un SkillBreakdown completo
          baseSkills.forEach((baseSkill: any) => {
                const skillName = baseSkill.name;
                const updatedSkillValue = filteredUpdates.skills[skillName];
                const existingSkillValue = existingSkillsObj[skillName];
                const baseValue = calculateSkillBaseValue(baseSkill);
                
                let breakdown: any;
                
                if (updatedSkillValue !== undefined) {
                  // Skill modificata nel payload - usa quella
                  if (updatedSkillValue && typeof updatedSkillValue === 'object' && 'total' in updatedSkillValue) {
                    // È già un SkillBreakdown - assicurati che abbia la categoria
                    breakdown = { ...updatedSkillValue, category: baseSkill.category };
                  } else if (typeof updatedSkillValue === 'number') {
                    // È un numero semplice - migra a SkillBreakdown
                    breakdown = {
                      total: updatedSkillValue,
                      base: baseValue,
                      requiredBonus: 0,
                      manualPoints: updatedSkillValue - baseValue,
                      occupationBonus: 0,
                      category: baseSkill.category
                    };
                  } else {
                    breakdown = {
                      total: baseValue,
                      base: baseValue,
                      requiredBonus: 0,
                      manualPoints: 0,
                      occupationBonus: 0,
                      category: baseSkill.category
                    };
                  }
                } else if (existingSkillValue !== undefined) {
                  // Skill esistente ma non modificata - preserva quella esistente
                  if (existingSkillValue && typeof existingSkillValue === 'object' && 'total' in existingSkillValue) {
                    // È già un SkillBreakdown - assicurati che abbia la categoria
                    breakdown = { ...existingSkillValue, category: baseSkill.category };
                  } else if (typeof existingSkillValue === 'number') {
                    // È un numero semplice - migra a SkillBreakdown
                    breakdown = {
                      total: existingSkillValue,
                      base: baseValue,
                      requiredBonus: 0,
                      manualPoints: existingSkillValue - baseValue,
                      occupationBonus: 0,
                      category: baseSkill.category
                    };
                  } else {
                    breakdown = {
                      total: baseValue,
                      base: baseValue,
                      requiredBonus: 0,
                      manualPoints: 0,
                      occupationBonus: 0,
                      category: baseSkill.category
                    };
                  }
                } else {
                  // Nuova skill - crea SkillBreakdown di default
                  breakdown = {
                    total: baseValue,
                    base: baseValue,
                    requiredBonus: 0,
                    manualPoints: 0,
                    occupationBonus: 0,
                    category: baseSkill.category
                  };
                }
                
            allSkillsToSave[skillName] = breakdown;
          });
          
          // Aggiungi dynamic skills: prima quelle esistenti nel character, poi quelle dal payload (che sovrascrivono)
          if (character.dynamicSkills && Array.isArray(character.dynamicSkills)) {
            character.dynamicSkills.forEach((dynamicSkill: any) => {
              // Aggiungi solo se non è già presente (potrebbe essere sovrascritta dal payload)
              if (!allSkillsToSave[dynamicSkill.skillName]) {
                allSkillsToSave[dynamicSkill.skillName] = {
                  total: dynamicSkill.value || 0,
                  base: 0,
                  requiredBonus: 0,
                  manualPoints: dynamicSkill.value || 0,
                  occupationBonus: 0,
                  category: dynamicSkill.category || 'general'
                };
              }
            });
          }
          
          // Aggiungi/aggiorna dynamic skills dal payload (sovrascrivono quelle esistenti)
          if (filteredUpdates.dynamicSkills && Array.isArray(filteredUpdates.dynamicSkills)) {
            filteredUpdates.dynamicSkills.forEach((dynamicSkill: any) => {
              allSkillsToSave[dynamicSkill.skillName] = {
                total: dynamicSkill.value || 0,
                base: 0,
                requiredBonus: 0,
                manualPoints: dynamicSkill.value || 0,
                occupationBonus: 0,
                category: dynamicSkill.category || 'general'
              };
            });
          }
          
          // Salva tutte le skills
            character.skills.clear();
          Object.entries(allSkillsToSave).forEach(([skillName, skillValue]) => {
              character.skills.set(skillName, skillValue);
            });
            character.markModified('skills');
          
          logger.info('All skills saved (DRAFT character)', {
            characterId: character._id,
            totalSkillsSaved: Object.keys(allSkillsToSave).length,
            modifiedSkillsCount: Object.keys(filteredUpdates.skills).length,
            sampleSkills: Object.keys(allSkillsToSave).slice(0, 5)
          });
          } else {
          // Per personaggi non-DRAFT, comportamento originale (solo skills modificate)
          character.skills.clear();
          const skillsToSave = Object.entries(filteredUpdates.skills);
          skillsToSave.forEach(([skillName, skillValue]) => {
            if (skillValue && typeof skillValue === 'object' && 'total' in skillValue) {
              character.skills.set(skillName, skillValue);
            } else {
              character.skills.set(skillName, skillValue);
            }
          });
          character.markModified('skills');
          
          logger.info('Skills updated (non-DRAFT character)', {
            characterId: character._id,
            totalSkillsToSave: skillsToSave.length
          });
        }
      }
      
      // Handle other fields
      allowedFields.forEach((field: string) => {
        if (filteredUpdates[field] !== undefined && field !== 'skills') {
            // Log per currentOccupation per debugging
            if (field === 'currentOccupation') {
              logger.info('Setting currentOccupation', {
                field,
                value: filteredUpdates[field],
                valueType: typeof filteredUpdates[field],
                before: character.currentOccupation
              });
            }
            character[field] = filteredUpdates[field];
            // Assicurati che Mongoose riconosca il cambiamento per campi opzionali
            if (field === 'currentOccupation') {
              character.markModified('currentOccupation');
              logger.info('currentOccupation set and marked as modified', {
                after: character.currentOccupation,
                hasValue: character.currentOccupation !== undefined
              });
          }
        }
      });

      // Handle background - support both object and JSON string (only for DRAFT)
      if (character.status === 'DRAFT' && filteredUpdates.background !== undefined) {
        try {
          let backgroundData = filteredUpdates.background;
          
          // Se background è una stringa JSON, parsala
          if (typeof backgroundData === 'string') {
            backgroundData = JSON.parse(backgroundData);
          }
          
          // Se è un oggetto, aggiorna direttamente il campo background
          if (typeof backgroundData === 'object' && backgroundData !== null) {
            // Inizializza background se non esiste
            if (!character.background) {
              character.background = {};
            }
            
            // Aggiorna tutti i campi del background
            Object.assign(character.background, backgroundData);
            
            // Mantieni compatibilità con campi deprecati motivations e fears
            if (backgroundData.motivations) {
              character.motivations = backgroundData.motivations;
            }
            if (backgroundData.fears) {
              character.fears = backgroundData.fears;
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse background', { 
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

      // Log currentOccupation dopo il salvataggio per verificare se è stato salvato
      logger.info('Character saved - checking currentOccupation', {
        characterId: character.id,
        currentOccupation: character.currentOccupation,
        currentOccupationType: typeof character.currentOccupation,
        hasCurrentOccupation: 'currentOccupation' in character,
        currentOccupationValue: character.get('currentOccupation')
      });

      // Log skills per debugging
      if (filteredUpdates.skills) {
        const skillsObj: any = {};
        character.skills.forEach((value, key) => {
          skillsObj[key] = value;
        });
        logger.info('Character skills after save', {
          characterId: character.id,
          skillsCount: character.skills.size,
          skills: skillsObj
        });
      }

      logger.info('Character updated', {
        characterId: character.id,
        userId,
        characterStatus: character.status,
        originalFields: Object.keys(updates),
        appliedFields: Object.keys(filteredUpdates)
      });

      res.json(updateResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character update error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId,
        updates: Object.keys(req.body || {})
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare il personaggio',
        'CHARACTER_UPDATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      res.json(successResponse(
        {
          character: {
            id: character.id,
            status: character.status,
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non approvato',
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

      res.json(successResponse(
        {
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
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non può essere eliminato',
          'CHARACTER_NOT_DELETABLE',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      await (Character.deleteOne({ _id: characterId }) as any);

      logger.info('Character deleted', {
        characterId,
        userId,
        name: character.name
      });

      res.json(deleteResponse(
        'Personaggio eliminato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character delete error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile eliminare il personaggio',
        'CHARACTER_DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      res.json(successResponse(
        {
          characters: charactersList
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get public characters list error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la lista dei personaggi',
        'GET_CHARACTERS_LIST_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      // Update character location
      const oldLocation = character.currentLocation;
      character.currentLocation = locationId === '' ? null : locationId;
      character.lastActive = new Date();
      
      await character.save();

      // If entering a specific location (not empty), add character to location occupants
      if (locationId && locationId !== '') {
        try {
          const location = await Location.findById(locationId);
          if (location) {
            // Check if character is already in occupants
            const existingOccupant = location.occupants.find((occ: any) => 
              occ.characterId.toString() === characterId.toString()
            );
            
            if (!existingOccupant) {
              // Add character to occupants
              await location.addOccupant(character._id, character.name);
              logger.info(`Character ${character.name} added to location ${location.name} occupants via setCharacterLocation`);
            } else {
              // Update last seen
              await location.updateOccupantLastSeen(character._id);
            }
          }
        } catch (error) {
          // Don't fail the request if occupant update fails
          logger.error('Failed to update location occupants:', error);
        }
      }

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
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        {
          characterId,
          characterName: `${character.name} ${character.surname}`,
          corporations: characterCorporations
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character corporations error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le corporazioni del personaggio',
        'GET_CHARACTER_CORPORATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      const occupation = await Occupation.findById(occupationId).populate('bonusSkills.skillId');

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
            name: occupation.name,
            allowedGenders: occupation.allowedGenders
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