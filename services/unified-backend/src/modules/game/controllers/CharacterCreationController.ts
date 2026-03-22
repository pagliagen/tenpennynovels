/**
 * Character Creation Controller
 *
 * Endpoints for character creation configuration.
 * Provides occupations, skills, and creation rules with user authentication.
 *
 * @module modules/game/controllers/CharacterCreationController
 * @since 2.0.0
 */

import { Request, Response } from 'express';
import { CharacterCreationConfigService } from '@shared/services/CharacterCreationConfigService';
import { Occupation } from '@database/models/Occupation';
import { Skill } from '@database/models/Skill';
import { logger } from '@shared/utils/logger';

export class CharacterCreationController {
  /**
   * GET /game/character-creation-config
   * Get complete character creation configuration (rules + occupations + skills)
   * Requires user authentication (no character required)
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      // Load configuration rules from JSON file
      const configService = CharacterCreationConfigService.getInstance();
      const rulesConfig = await configService.loadConfig();

      // Fetch occupations from database with populated skill refs
      const occupations = await Occupation.find({ isActive: true })
        .select('name description category contacts earnings image requiredSkillSlots bonusSkills')
        .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType baseValue')
        .populate('bonusSkills.skillId', 'name category')
        .sort({ name: 1 })
        .lean();

      // Fetch skills from database
      const skills = await Skill.find({ visible: true, defaultSkill: true })
        .select('name baseValue category description isPlaceholder placeholderType')
        .sort({ name: 1 })
        .lean();

      // Parse skill total points formula (e.g. "constant:200" → 200)
      const parseSkillTotalPoints = (formula: string): number => {
        if (formula?.startsWith('constant:')) {
          return parseInt(formula.replace('constant:', ''), 10) || 200;
        }
        return 200;
      };

      // Format complete configuration for frontend
      const completeConfig = {
        occupations: occupations.map((occ: any) => ({
          id: occ._id.toString(),
          name: occ.name,
          description: occ.description,
          category: occ.category,
          contacts: occ.contacts || '',
          earnings: occ.earnings || '',
          image: occ.image || null,
          requiredSkillSlots: (occ.requiredSkillSlots || []).map((slot: any) => ({
            options: (slot.options || []).map((skill: any) => ({
              skillId: skill._id.toString(),
              name: skill.name,
              category: skill.category,
              isPlaceholder: skill.isPlaceholder || false,
              placeholderType: skill.placeholderType,
            })),
          })),
          bonusSkills: (occ.bonusSkills || []).map((bs: any) => ({
            skillId: bs.skillId?._id?.toString() || bs.skillId?.toString() || '',
            name: bs.skillId?.name || '',
            bonusValue: bs.bonusValue,
          })),
        })),
        skills: skills.map((skill: any) => ({
          id: skill._id.toString(),
          name: skill.name,
          description: skill.description,
          category: skill.category,
          baseValue: typeof skill.baseValue === 'number' ? skill.baseValue : 0,
          isPlaceholder: skill.isPlaceholder || false,
          placeholderType: skill.placeholderType,
        })),
        limits: rulesConfig.limits,
        derivedStats: rulesConfig.formulas.derived,
        // Creation rules (used by wizard for budget/cap validation)
        statsConfig: {
          totalPoints: rulesConfig.stats.totalPoints,
          minValue: rulesConfig.stats.basePoints,
          maxStatsAbove80: rulesConfig.stats.maxStatsAbove80,
          creationCap: rulesConfig.stats.creationCap,
          gameplayCap: rulesConfig.stats.gameplayCap,
        },
        skillsConfig: {
          totalPoints: parseSkillTotalPoints(rulesConfig.skills.totalPointsFormula),
          creationCap: rulesConfig.skills.creationCap,
          creationCapWithOccupation: rulesConfig.skills.creationCapWithOccupation,
        },
        socialClasses: rulesConfig.socialClasses,
        occupation: rulesConfig.occupation,
        formulas: rulesConfig.formulas,
      };

      logger.info('[CharacterCreationController] Complete character creation config requested', {
        occupationsCount: occupations.length,
        skillsCount: skills.length,
      });

      res.json({
        result: true,
        data: { config: completeConfig },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      // Include error details directly in log message (metadata objects not printed by logger)
      logger.error(`[CharacterCreationController] Error fetching character creation config: ${errorMessage}\n${errorStack || 'No stack trace'}`);

      res.status(500).json({
        result: false,
        error: 'Impossibile caricare la configurazione di creazione personaggio',
        code: 'CONFIG_LOAD_ERROR',
        details: errorMessage, // Include error details in response for debugging
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /game/character-creation-config/occupations
   * Get all available occupations for character creation
   * Requires user authentication (no character required)
   */
  static async getOccupations(req: Request, res: Response): Promise<void> {
    try {
      // Fetch all active occupations from database with populated skill refs
      const occupations = await Occupation.find({ isActive: true })
        .select('name description category contacts earnings image requiredSkillSlots bonusSkills')
        .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType baseValue')
        .populate('bonusSkills.skillId', 'name category')
        .sort({ name: 1 })
        .lean();

      // Transform to frontend format
      const formattedOccupations = occupations.map((occ: any) => ({
        id: occ._id.toString(),
        name: occ.name,
        description: occ.description,
        category: occ.category,
        contacts: occ.contacts || '',
        earnings: occ.earnings || '',
        image: occ.image || null,
        requiredSkillSlots: (occ.requiredSkillSlots || []).map((slot: any) => ({
          options: (slot.options || []).map((skill: any) => ({
            skillId: skill._id.toString(),
            name: skill.name,
            category: skill.category,
            isPlaceholder: skill.isPlaceholder || false,
            placeholderType: skill.placeholderType,
          })),
        })),
        bonusSkills: (occ.bonusSkills || []).map((bs: any) => ({
          skillId: bs.skillId?._id?.toString() || bs.skillId?.toString() || '',
          name: bs.skillId?.name || '',
          bonusValue: bs.bonusValue,
        })),
      }));

      logger.info('[CharacterCreationController] Occupations list requested', {
        count: formattedOccupations.length,
      });

      res.json({
        result: true,
        data: { occupations: formattedOccupations },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[CharacterCreationController] Error fetching occupations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        result: false,
        error: 'Impossibile caricare le occupazioni',
        code: 'OCCUPATIONS_LOAD_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /game/character-creation-config/skills
   * Get all available skills for character creation
   * Requires user authentication (no character required)
   */
  static async getSkills(req: Request, res: Response): Promise<void> {
    try {
      // Fetch all visible default skills from database
      const skills = await Skill.find({ visible: true, defaultSkill: true })
        .select('name baseValue category description isPlaceholder placeholderType')
        .sort({ sortOrder: 1, name: 1 })
        .lean();

      // Transform to frontend format
      const formattedSkills = skills.map((skill: any) => {
        let resolvedBase: number;
        let baseFormula: string | null = null;

        if (typeof skill.baseValue === 'number') {
          resolvedBase = skill.baseValue;
        } else if (typeof skill.baseValue === 'string') {
          if (skill.baseValue.startsWith('VALUE:')) {
            resolvedBase = parseInt(skill.baseValue.replace('VALUE:', '')) || 0;
          } else if (skill.baseValue.startsWith('FORMULA:')) {
            baseFormula = skill.baseValue;
            resolvedBase = 0;
          } else {
            resolvedBase = parseInt(skill.baseValue) || 0;
          }
        } else {
          resolvedBase = 0;
        }

        return {
          id: skill._id.toString(),
          name: skill.name,
          description: skill.description,
          category: skill.category,
          baseValue: resolvedBase,
          baseFormula,
          isPlaceholder: skill.isPlaceholder || false,
          placeholderType: skill.placeholderType,
        };
      });

      logger.info('[CharacterCreationController] Skills list requested', {
        count: formattedSkills.length,
      });

      res.json({
        result: true,
        data: { skills: formattedSkills },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[CharacterCreationController] Error fetching skills:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        result: false,
        error: 'Impossibile caricare le skill',
        code: 'SKILLS_LOAD_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
