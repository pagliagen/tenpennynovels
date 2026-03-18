import { Request, Response } from 'express';
import { Occupation } from '@database/models/Occupation';
import { Character } from '@database/models/Character';
import { Corporation } from '@database/models/Corporation';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';


export class OccupationController {

  static async getAvailableOccupations(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { category } = req.query;

      // Get character for eligibility checks
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

      // Build filter for basic occupation criteria
      const occupationFilter: any = { isActive: true };
      
      if (category) {
        occupationFilter.category = category;
      }
      
      // Get all potentially available occupations with populated skill refs
      let occupations = await Occupation.find(occupationFilter)
        .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType')
        .populate('bonusSkills.skillId', 'name category')
        .sort({ name: 1 });

      // Filter based on character's prerequisites
      const availableOccupations = [];
      
      for (const occupation of occupations) {
        const meetsPrerequisites = await checkOccupationPrerequisites(character, occupation);
        
        if (meetsPrerequisites.eligible) {
          availableOccupations.push({
            id: occupation._id,
            name: occupation.name,
            description: occupation.description,
            category: occupation.category,
            contacts: occupation.contacts,
            earnings: occupation.earnings,
            requiredSkillSlots: occupation.requiredSkillSlots || [],
            bonusSkills: occupation.bonusSkills || [],
          });
        }
      }

      // Get character's current occupation if any
      let currentOccupation = null;
      if (character.occupation) {
        const currentOcc = await Occupation.findById(character.occupation);
        if (currentOcc) {
          currentOccupation = {
            id: currentOcc._id,
            name: currentOcc.name,
            description: currentOcc.description,
            category: currentOcc.category,
            dailySalary: currentOcc.dailySalary,
            socialRespectability: currentOcc.socialRespectability
          };
        }
      }

      logger.info('Available occupations retrieved', {
        characterId: character._id,
        availableCount: availableOccupations.length,
        totalCount: occupations.length,
        filters: { category }
      });

      res.json(successResponse(
        {
          availableOccupations,
          currentOccupation,
          totalAvailable: availableOccupations.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving available occupations:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getOccupationDetails(req: Request<{ occupationId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { occupationId } = req.params;

      // Get character for eligibility checks
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

      // Check if character meets prerequisites
      const prerequisiteCheck = await checkOccupationPrerequisites(character, occupation);

      const occupationDetails = {
        id: occupation._id,
        name: occupation.name,
        description: occupation.description,
        category: occupation.category,
        contacts: occupation.contacts,
        earnings: occupation.earnings,
        requiredSkillSlots: occupation.requiredSkillSlots || [],
        bonusSkills: occupation.bonusSkills || [],
        characterEligible: prerequisiteCheck.eligible,
        eligibilityReasons: prerequisiteCheck.reasons,
        isCurrentOccupation: character.occupation?.toString() === occupationId,
      };

      logger.info('Occupation details retrieved', {
        occupationId: occupation._id,
        characterId: character._id,
        eligible: prerequisiteCheck.eligible
      });

      res.json(successResponse(
        {
          occupation: occupationDetails
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error retrieving occupation details:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getOccupationCategories(req: Request, res: Response): Promise<void> {
    try {
      // Aggregate occupations by category
      const categories = await Occupation.aggregate([
        { 
          $match: { isActive: true } 
        },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgSalary: { $avg: '$dailySalary' },
            avgRespectability: { $avg: '$socialRespectability' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            avgDailySalary: { $round: ['$avgSalary', 0] },
            avgSocialRespectability: { $round: ['$avgRespectability', 1] }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const formattedCategories = categories.map(cat => ({
        category: cat.category,
        count: cat.count,
        avgDailySalary: cat.avgDailySalary,
        avgSocialRespectability: cat.avgSocialRespectability,
        description: getCategoryDescription(cat.category)
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
      logger.error('Error retrieving occupation categories:', error);
      res.status(500).json(errorResponse(
        'Errore interno del server',
        'INTERNAL_SERVER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async checkOccupationEligibility(req: Request<{ occupationId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const { occupationId } = req.params;

      // Get character for eligibility checks
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

      const eligibilityCheck = await checkOccupationPrerequisites(character, occupation);

      logger.info('Occupation eligibility checked', {
        occupationId: occupation._id,
        characterId: character._id,
        eligible: eligibilityCheck.eligible
      });

      res.json(successResponse(
        {
          occupation: {
            id: occupation._id,
            name: occupation.name
          },
          eligible: eligibilityCheck.eligible,
          reasons: eligibilityCheck.reasons,
          missingRequirements: eligibilityCheck.missingRequirements
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error checking occupation eligibility:', error);
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

// Helper function to check if character meets occupation prerequisites
async function checkOccupationPrerequisites(character: any, occupation: any): Promise<{
  eligible: boolean;
  reasons: string[];
  missingRequirements?: any[];
}> {
  const reasons: string[] = [];
  const missingRequirements: any[] = [];

  // If no prerequisites, character is eligible
  if (!occupation.prerequisites) {
    return { eligible: true, reasons: ['Nessun prerequisito specifico richiesto'] };
  }

  const prereqs = occupation.prerequisites;

  // Check minimum stats
  if (prereqs.minimumStats) {
    for (const [statName, minValue] of Object.entries(prereqs.minimumStats)) {
      const characterStat = character.currentStats?.[statName] || character.stats?.[statName] || 0;
      if (characterStat < (minValue as number)) {
        reasons.push(`Richiede ${statName} di almeno ${minValue} (hai ${characterStat})`);
        missingRequirements.push({
          type: 'stat',
          name: statName,
          required: minValue,
          current: characterStat
        });
      }
    }
  }

  // Check minimum skills
  if (prereqs.minimumSkills) {
    for (const [skillName, minValue] of Object.entries(prereqs.minimumSkills)) {
      const characterSkill = character.skills?.[skillName] || 0;
      if (characterSkill < (minValue as number)) {
        reasons.push(`Richiede abilità ${skillName} di almeno ${minValue}% (hai ${characterSkill}%)`);
        missingRequirements.push({
          type: 'skill',
          name: skillName,
          required: minValue,
          current: characterSkill
        });
      }
    }
  }

  // Check required items (would need to implement character inventory system)
  if (prereqs.requiredItems && prereqs.requiredItems.length > 0) {
    reasons.push(`Richiede oggetti: ${prereqs.requiredItems.join(', ')}`);
    missingRequirements.push({
      type: 'items',
      required: prereqs.requiredItems
    });
  }

  // If any missing requirements, not eligible
  if (missingRequirements.length > 0) {
    return { eligible: false, reasons, missingRequirements };
  }

  return { 
    eligible: true, 
    reasons: ['Il personaggio soddisfa tutti i prerequisiti per questa occupazione'] 
  };
}

// Helper function to get category descriptions
function getCategoryDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'medical': 'Professioni sanitarie e mediche',
    'legal': 'Professioni legali e giudiziarie',
    'clergy': 'Ruoli religiosi ed ecclesiastici',
    'military': 'Forze armate e difesa',
    'education': 'Insegnamento e posizioni accademiche',
    'domestic_service': 'Personale domestico e di servizio',
    'trades': 'Artigiani e mestieri specializzati',
    'commerce': 'Occupazioni commerciali e di scambio',
    'entertainment': 'Spettacolo e intrattenimento',
    'criminal': 'Attività illecite e clandestine',
    'nobility': 'Titoli aristocratici e nobiliari',
    'professional': 'Servizi professionali e specializzati',
    'industrial': 'Lavoro industriale e manifatturiero',
    'transportation': 'Trasporti e logistica',
    'agricultural': 'Occupazioni agricole e rurali'
  };

  return descriptions[category] || 'Categoria occupazionale specializzata';
}