import { Request, Response } from 'express';
import { Character } from '@database/models/Character';
import { CharacterProgression, ICharacterProgression } from '@database/models/CharacterProgression';
import { Skill } from '@database/models/Skill';
import { logger } from '../logger';
import { successResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';

function calculateSkillBaseValue(skill: any, character: any): number {
  if (typeof skill.baseValue === 'number') {
    return skill.baseValue;
  }
  if (typeof skill.baseValue === 'string') {
    if (skill.baseValue.startsWith('VALUE:')) {
      return parseInt(skill.baseValue.replace('VALUE:', '')) || 0;
    }
    if (skill.baseValue.startsWith('FORMULA:')) {
      const characteristic = skill.baseValue.replace('FORMULA:', '');
      return character.stats?.[characteristic.toLowerCase()] || character.currentStats?.[characteristic.toLowerCase()] || 0;
    }
  }
  return 0;
}

async function getOrCreateProgression(characterId: string): Promise<ICharacterProgression> {
  let progression = await CharacterProgression.findOne({ characterId });
  if (!progression) {
    progression = await CharacterProgression.create({
      characterId,
      availableExperiencePoints: 0,
      availableSkillPoints: 0,
      totalExperienceEarned: 0,
      totalSkillPointsEarned: 0,
      totalExperienceSpent: 0,
      totalSkillPointsSpent: 0,
      statsImproved: [],
      skillsImproved: [],
      milestones: [],
      activityMetrics: {
        daysActive: 0,
        messagesThisWeek: 0,
        sessionsParticipated: 0,
        consecutiveActiveDays: 0,
        longestActiveStreak: 0
      },
      recentSpending: [],
      settings: {
        autoSpendEnabled: false,
        preferredSkillCategories: [],
        spendingNotifications: true
      },
      lastUpdated: new Date()
    });
  }
  return progression;
}

export class CharacterProgressionController {
  /**
   * GET /characters/:characterId/progression
   * Punti esperienza/skill disponibili e storico spese, per il tab Statistiche della scheda.
   */
  static async getProgression(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const progression = await getOrCreateProgression(characterId);

      res.json(successResponse({
        availableExperiencePoints: progression.availableExperiencePoints,
        availableSkillPoints: progression.availableSkillPoints,
        totalExperienceEarned: progression.totalExperienceEarned,
        totalSkillPointsEarned: progression.totalSkillPointsEarned,
        totalExperienceSpent: progression.totalExperienceSpent,
        totalSkillPointsSpent: progression.totalSkillPointsSpent,
        skillsImproved: progression.skillsImproved,
        recentSpending: progression.recentSpending.slice(-20).reverse()
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error retrieving character progression:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/progression/skills/:skillId/improve
   * Spende px disponibili per aumentare manualPoints di una skill.
   * Le skill lockedForPlayer (es. Occultismo) sono bloccate per i giocatori: crescono solo per mano del master.
   */
  static async improveSkill(req: Request<{ characterId: string; skillId: string }>, res: Response): Promise<void> {
    try {
      const { characterId, skillId } = req.params;
      const points = Number(req.body?.points);
      const userId = req.user!.userId;

      if (!Number.isInteger(points) || points <= 0) {
        res.status(400).json(errorResponse('Il numero di punti deve essere un intero positivo', 'INVALID_POINTS', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse('Accesso negato', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const skill = await Skill.findById(skillId);
      if (!skill || !skill.visible) {
        res.status(404).json(errorResponse('Abilità non trovata', 'SKILL_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      if (skill.lockedForPlayer && !isMaster) {
        res.status(403).json(errorResponse(
          `"${skill.name}" può essere modificata solo dal master`,
          'SKILL_LOCKED_FOR_PLAYER',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const progression = await getOrCreateProgression(characterId);

      // Il master può forzare l'assegnazione anche senza px disponibili (correzioni/errori);
      // il giocatore deve avere punti sufficienti.
      if (!isMaster && progression.availableSkillPoints < points) {
        res.status(400).json(errorResponse(
          `Punti abilità insufficienti (disponibili: ${progression.availableSkillPoints}, richiesti: ${points})`,
          'INSUFFICIENT_SKILL_POINTS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const baseValue = calculateSkillBaseValue(skill, character);
      const existing = character.skills.get(skillId) as any;
      const breakdown = existing && typeof existing === 'object'
        ? { ...existing }
        : { total: baseValue, base: baseValue, requiredBonus: 0, manualPoints: 0, occupationBonus: 0, category: skill.category };

      breakdown.manualPoints = (breakdown.manualPoints || 0) + points;
      breakdown.total = (breakdown.base || baseValue) + (breakdown.requiredBonus || 0) + breakdown.manualPoints + (breakdown.occupationBonus || 0);

      character.skills.set(skillId, breakdown);
      character.markModified('skills');
      await character.save();

      progression.availableSkillPoints = Math.max(0, progression.availableSkillPoints - points);
      progression.totalSkillPointsSpent += points;

      const improvedEntry = progression.skillsImproved.find((s) => s.skill === skill.name);
      if (improvedEntry) {
        improvedEntry.timesImproved += 1;
        improvedEntry.totalPointsSpent += points;
        improvedEntry.currentValue = breakdown.total;
        improvedEntry.lastImprovedAt = new Date();
      } else {
        progression.skillsImproved.push({
          skill: skill.name,
          timesImproved: 1,
          totalPointsSpent: points,
          currentValue: breakdown.total,
          startingValue: baseValue,
          lastImprovedAt: new Date()
        });
      }

      progression.recentSpending.push({
        spentAt: new Date(),
        type: 'skill',
        target: skill.name,
        pointsSpent: points,
        resultValue: breakdown.total
      });

      progression.lastUpdated = new Date();
      await progression.save();

      logger.info('Skill improved', { characterId, skillId, skillName: skill.name, points, isMaster, newTotal: breakdown.total });

      res.json(successResponse({
        skillId,
        skillName: skill.name,
        breakdown,
        availableSkillPoints: progression.availableSkillPoints
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error improving skill:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/progression/grant
   * Solo master: assegna px/punti abilità (premio sessione, correzione, ecc.).
   */
  static async grantPoints(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const isMaster = req.character?.gameplayRoles?.includes('master') || req.character?.isGestore || false;
      if (!isMaster) {
        res.status(403).json(errorResponse('Solo il master può assegnare punti', 'ACCESS_DENIED', undefined, 403, getRequestId(req)));
        return;
      }

      const experiencePoints = Number(req.body?.experiencePoints) || 0;
      const skillPoints = Number(req.body?.skillPoints) || 0;
      if (experiencePoints <= 0 && skillPoints <= 0) {
        res.status(400).json(errorResponse('Specificare almeno un valore positivo tra experiencePoints e skillPoints', 'INVALID_GRANT', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Personaggio non trovato', 'CHARACTER_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const progression = await getOrCreateProgression(characterId);
      progression.availableExperiencePoints += experiencePoints;
      progression.totalExperienceEarned += experiencePoints;
      progression.availableSkillPoints += skillPoints;
      progression.totalSkillPointsEarned += skillPoints;
      progression.lastUpdated = new Date();
      await progression.save();

      logger.info('Progression points granted', { characterId, experiencePoints, skillPoints, grantedBy: req.character?.characterId });

      res.json(successResponse({
        availableExperiencePoints: progression.availableExperiencePoints,
        availableSkillPoints: progression.availableSkillPoints
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Error granting progression points:', error);
      res.status(500).json(errorResponse('Errore interno del server', 'INTERNAL_SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
