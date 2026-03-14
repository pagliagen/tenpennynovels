import { Request, Response } from 'express';
import { Skill } from '@database/models/Skill';
import { Character } from '@database/models/Character';
import { logger } from '../logger';
import {
  translateCategory,
  getCategoryDescription,
  getAllCategoriesItalian
} from '@shared/translations/skillCategories';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class SkillController {

  /**
   * GET /game/skills/character/:characterId
   * Get all skills for a specific character (for DiceCommandsModal)
   * Returns all skills with their values and categories
   */
  static async getCharacterSkillsForDice(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      // Check authentication
      if (!req.user) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'AUTHENTICATION_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { characterId } = req.params;
      if (!characterId) {
        res.status(400).json(errorResponse(
          'Character ID is required',
          'CHARACTER_ID_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get character from database
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

      // Verify ownership or master access
      const userId = req.user.userId;
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.isGestore || false;
      
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse(
          'Access denied',
          'ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get all visible skills
      const skills = await Skill.find({ visible: true }).sort({ sortOrder: 1, name: 1 });

      // Build skills map with values and categories
      const skillsMap: Record<string, { value: number; category: string }> = {};

      // Convert skills Map to object if needed
      let characterSkillsObj: any = {};
      if (character.skills && character.skills instanceof Map) {
        character.skills.forEach((value: any, key: string) => {
          // Preserve the value as-is (could be number or SkillBreakdown object)
          characterSkillsObj[key] = value;
        });
      } else if (character.skills) {
        characterSkillsObj = character.skills;
      }
      
      // Log for debugging - show first few skills
      const sampleSkills = Object.keys(characterSkillsObj).slice(0, 5);
      logger.info('Character skills from DB', {
        characterId: character._id,
        totalSkillsInDB: Object.keys(characterSkillsObj).length,
        sampleSkills: sampleSkills.map(name => ({
          name,
          value: characterSkillsObj[name],
          type: typeof characterSkillsObj[name],
          isObject: typeof characterSkillsObj[name] === 'object' && characterSkillsObj[name] !== null
        }))
      });
      
      skills.forEach(skill => {
        const characterSkillValue = characterSkillsObj[skill.name];
        let numericValue: number;
        
        if (characterSkillValue !== undefined && characterSkillValue !== null) {
          // Character has this skill - extract the total value
          if (typeof characterSkillValue === 'number') {
            // Simple number value
            numericValue = characterSkillValue;
          } else if (characterSkillValue && typeof characterSkillValue === 'object') {
            // SkillBreakdown object - extract total
            if ('total' in characterSkillValue) {
              numericValue = (characterSkillValue as any).total;
            } else {
              // Fallback: try to use the value directly if it's a number-like object
              numericValue = typeof (characterSkillValue as any).value === 'number' 
                ? (characterSkillValue as any).value 
                : 0;
            }
          } else {
            numericValue = 0;
          }
        } else {
          // Character doesn't have this skill - use base value
          numericValue = calculateSkillBaseValue(skill, character);
        }
        
        skillsMap[skill.name] = {
          value: numericValue,
          category: skill.category
        };
      });

      // Add dynamic skills
      if (character.dynamicSkills && Array.isArray(character.dynamicSkills)) {
        character.dynamicSkills.forEach((dynamicSkill: any) => {
          skillsMap[dynamicSkill.skillName] = {
            value: dynamicSkill.value || 0,
            category: dynamicSkill.category || 'general'
          };
        });
      }

      res.json(successResponse(
        {
          skills: skillsMap,
          skillTemplates: skills.map(skill => ({
            name: skill.name,
            baseValue: skill.baseValue,
            category: skill.category,
            description: skill.description,
            canRollWithoutPoints: skill.canRollWithoutPoints !== undefined ? skill.canRollWithoutPoints : true,
            isPlaceholder: skill.isPlaceholder || false
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving character skills for dice:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getCharacterSkills(req: Request, res: Response): Promise<void> {
    try {
      // Check authentication - character should be set by middleware
      if (!req.character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Get full character from database to access skills
      const character = await Character.findById(req.character.characterId);
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
      const { category, includePlaceholders } = req.query;

      // Build filter for skills
      const skillFilter: any = { visible: true };
      
      if (category) {
        skillFilter.category = category;
      }

      // Include/exclude placeholder skills
      if (includePlaceholders !== 'true') {
        skillFilter.isPlaceholder = { $ne: true };
      }

      // Get all visible skills
      const skills = await Skill.find(skillFilter).sort({ sortOrder: 1, name: 1 });

      // Calculate character's skill values
      const characterSkills = skills.map(skill => {
        const characterSkillValue = character.skills?.[skill.name] || null;
        const baseValue = calculateSkillBaseValue(skill, character);
        const currentValue = characterSkillValue !== null ? characterSkillValue : baseValue;
        const pointsAssigned = characterSkillValue !== null ? (characterSkillValue - baseValue) : 0;

        return {
          id: skill._id,
          name: skill.name,
          description: skill.description,
          category: translateCategory(skill.category as any),
          categoryKey: skill.category, // Keep original English key for internal use
          baseValue: baseValue,
          pointsAssigned: Math.max(0, pointsAssigned),
          currentValue: currentValue,
          canRollWithoutPoints: skill.canRollWithoutPoints,
          isPlaceholder: skill.isPlaceholder || false,
          placeholderType: skill.placeholderType,
          isDefault: skill.defaultSkill || false,
          hasRollRestriction: !skill.canRollWithoutPoints && currentValue === 0
        };
      });

      // Group skills by category for better organization
      const skillsByCategory = characterSkills.reduce((acc, skill) => {
        if (!acc[skill.category]) {
          acc[skill.category] = [];
        }
        acc[skill.category].push(skill);
        return acc;
      }, {} as Record<string, typeof characterSkills>);

      // Calculate total points used and available
      const totalPointsUsed = characterSkills.reduce((sum, skill) => sum + skill.pointsAssigned, 0);
      const skillPointsAvailable = character.skillPointsAvailable || 0;

      logger.info('Character skills retrieved', {
        characterId: character._id,
        skillsCount: characterSkills.length,
        totalPointsUsed,
        skillPointsAvailable
      });

      res.json(successResponse(
        {
          skills: characterSkills,
          skillsByCategory,
          totalPointsUsed,
          skillPointsAvailable,
          skillPointsRemaining: Math.max(0, skillPointsAvailable - totalPointsUsed),
          categories: Object.keys(skillsByCategory)
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving character skills:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getSkillDetails(req: Request<{ skillId: string }>, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { skillId } = req.params;
      const character = await Character.findById(req.character.characterId);
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

      const skill = await Skill.findById(skillId);
      if (!skill || !skill.visible) {
        res.status(404).json(errorResponse(
          'Abilità non trovata',
          'SKILL_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Calculate character's value for this skill
      const characterSkillValue = character.skills?.[skill.name] || null;
      const baseValue = calculateSkillBaseValue(skill, character);
      const currentValue = characterSkillValue !== null ? characterSkillValue : baseValue;
      const pointsAssigned = characterSkillValue !== null ? (characterSkillValue - baseValue) : 0;

      const skillDetails = {
        id: skill._id,
        name: skill.name,
        description: skill.description,
        category: translateCategory(skill.category as any),
        categoryKey: skill.category, // Keep original English key for internal use
        baseValue: baseValue,
        baseValueFormula: skill.baseValue, // Show the original formula
        isDefault: skill.defaultSkill || false,
        isPlaceholder: skill.isPlaceholder || false,
        placeholderType: skill.placeholderType,
        canRollWithoutPoints: skill.canRollWithoutPoints,
        sortOrder: skill.sortOrder,

        // Character-specific data
        characterValue: {
          pointsAssigned: Math.max(0, pointsAssigned),
          currentValue: currentValue,
          hasRollRestriction: !skill.canRollWithoutPoints && currentValue === 0
        },
        
        // Usage information
        usageGuidelines: {
          canAttemptUnskilled: skill.canRollWithoutPoints,
          baseSuccessChance: `${currentValue}%`,
          difficultyModifiers: {
            easy: Math.floor(currentValue * 2),
            hard: Math.floor(currentValue / 2),
            extreme: Math.floor(currentValue / 5)
          }
        }
      };

      logger.info('Skill details retrieved', {
        skillId: skill._id,
        characterId: character._id,
        currentValue
      });

      res.json(successResponse(
        {
          skill: skillDetails
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving skill details:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getSkillCategories(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'AUTHENTICATION_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Aggregate skills by category
      const categories = await Skill.aggregate([
        { 
          $match: { visible: true, isPlaceholder: { $ne: true } } 
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            hasDefaultSkills: { $sum: { $cond: ['$defaultSkill', 1, 0] } },
            hasAcademicSkills: { $sum: { $cond: ['$canRollWithoutPoints', 0, 1] } }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            hasDefaultSkills: { $gt: ['$hasDefaultSkills', 0] },
            hasAcademicSkills: { $gt: ['$hasAcademicSkills', 0] }
          }
        },
        {
          $sort: { category: 1 }
        }
      ]);

      const formattedCategories = categories.map(cat => ({
        category: translateCategory(cat.category as any),
        categoryKey: cat.category, // Keep original English key for filtering
        count: cat.count,
        hasDefaultSkills: cat.hasDefaultSkills,
        hasAcademicSkills: cat.hasAcademicSkills,
        description: getCategoryDescription(cat.category as any)
      }));

      res.json(successResponse(
        {
          categories: formattedCategories,
          totalCategories: categories.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving skill categories:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getPlaceholderSkills(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'AUTHENTICATION_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { placeholderType } = req.query;

      // Build filter for placeholder skills
      const placeholderFilter: any = { 
        visible: true, 
        isPlaceholder: true 
      };
      
      if (placeholderType) {
        placeholderFilter.placeholderType = placeholderType;
      }

      const placeholderSkills = await Skill.find(placeholderFilter).sort({ name: 1 });

      const formattedPlaceholders = placeholderSkills.map(skill => ({
        id: skill._id,
        name: skill.name,
        description: skill.description,
        category: translateCategory(skill.category as any),
        categoryKey: skill.category, // Keep original English key for internal use
        placeholderType: skill.placeholderType,
        baseValue: skill.baseValue,
        canRollWithoutPoints: skill.canRollWithoutPoints,
        examples: getPlaceholderExamples(skill.placeholderType)
      }));

      // Group by placeholder type
      const placeholdersByType = formattedPlaceholders.reduce((acc, placeholder) => {
        const type = placeholder.placeholderType || 'other';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(placeholder);
        return acc;
      }, {} as Record<string, typeof formattedPlaceholders>);

      res.json(successResponse(
        {
          placeholders: formattedPlaceholders,
          placeholdersByType,
          availableTypes: Object.keys(placeholdersByType)
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving placeholder skills:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async calculateSkillProbabilities(req: Request<{ skillId: string }>, res: Response): Promise<void> {
    try {
      if (!req.character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { skillId } = req.params;
      const character = await Character.findById(req.character.characterId);
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

      const skill = await Skill.findById(skillId);
      if (!skill || !skill.visible) {
        res.status(404).json(errorResponse(
          'Abilità non trovata',
          'SKILL_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const characterSkillValue = character.skills?.[skill.name] || null;
      const baseValue = calculateSkillBaseValue(skill, character);
      const currentValue = characterSkillValue !== null ? characterSkillValue : baseValue;

      // Calculate success probabilities at different difficulty levels
      const probabilities = {
        regular: {
          target: currentValue,
          probability: Math.min(currentValue, 95), // Cap at 95%
          canAttempt: currentValue > 0 || skill.canRollWithoutPoints
        },
        hard: {
          target: Math.floor(currentValue / 2),
          probability: Math.min(Math.floor(currentValue / 2), 95),
          canAttempt: currentValue > 0 || skill.canRollWithoutPoints
        },
        extreme: {
          target: Math.floor(currentValue / 5),
          probability: Math.min(Math.floor(currentValue / 5), 95),
          canAttempt: currentValue > 0 || skill.canRollWithoutPoints
        },
        easy: {
          target: Math.min(currentValue * 2, 95),
          probability: Math.min(currentValue * 2, 95),
          canAttempt: currentValue > 0 || skill.canRollWithoutPoints
        }
      };

      // Calculate critical success and fumble chances
      const criticalSuccess = Math.min(5, Math.floor(currentValue / 10));
      const fumbleChance = currentValue >= 50 ? 1 : 5; // Fumble on 96-00 if skill ≥50%, otherwise 96-00

      const skillProbabilities = {
        skill: {
          id: skill._id,
          name: skill.name,
          currentValue
        },
        probabilities,
        specialResults: {
          criticalSuccess: {
            range: `01-${criticalSuccess.toString().padStart(2, '0')}`,
            probability: criticalSuccess
          },
          fumble: {
            range: fumbleChance === 1 ? '00' : '96-00',
            probability: fumbleChance
          }
        },
        rollAdvice: {
          bestDifficulty: getBestDifficultyAdvice(currentValue),
          skillLevel: getSkillLevelDescription(currentValue),
          canUseUnskilled: skill.canRollWithoutPoints
        }
      };

      res.json(successResponse(
        skillProbabilities,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error calculating skill probabilities:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}

// Helper function to calculate skill base value from formula
function calculateSkillBaseValue(skill: any, character: any): number {
  if (typeof skill.baseValue === 'number') {
    return skill.baseValue;
  }

  if (typeof skill.baseValue === 'string') {
    if (skill.baseValue.startsWith('VALUE:')) {
      return parseInt(skill.baseValue.replace('VALUE:', ''));
    }
    
    if (skill.baseValue.startsWith('FORMULA:')) {
      const characteristic = skill.baseValue.replace('FORMULA:', '');
      const charValue = character.stats?.[characteristic.toLowerCase()] || character.currentStats?.[characteristic.toLowerCase()] || 0;
      return charValue;
    }
  }

  return 0; // Default fallback
}

// Note: Skill category descriptions now use centralized translation system
// from packages/shared/translations/skillCategories.ts

// Helper function to get placeholder examples
function getPlaceholderExamples(placeholderType: string | undefined): string[] {
  const examples: { [key: string]: string[] } = {
    'lingua': ['English', 'French', 'German', 'Italian', 'Spanish', 'Latin', 'Greek'],
    'arte': ['Painting', 'Sculpture', 'Music', 'Literature', 'Drama', 'Photography'],
    'mestiere': ['Carpentry', 'Blacksmithing', 'Tailoring', 'Cooking', 'Brewing'],
    'scienza': ['Chemistry', 'Physics', 'Biology', 'Geology', 'Astronomy']
  };

  return examples[placeholderType || ''] || [];
}

// Helper function to get best difficulty advice
function getBestDifficultyAdvice(skillValue: number): string {
  if (skillValue >= 80) return 'Tenta sfide Difficili o Estreme per ricompense migliori';
  if (skillValue >= 50) return 'Difficoltà Regolare consigliata, sfide Difficili possibili';
  if (skillValue >= 25) return 'Solo difficoltà Regolare, evita sfide Difficili';
  return 'Bassa probabilità di successo - considera difficoltà Facile o miglioramento abilità';
}

// Helper function to get skill level description
function getSkillLevelDescription(skillValue: number): string {
  if (skillValue >= 90) return 'Maestro';
  if (skillValue >= 75) return 'Esperto';
  if (skillValue >= 50) return 'Professionista';
  if (skillValue >= 25) return 'Competente';
  if (skillValue >= 10) return 'Novizio';
  return 'Non addestrato';
}