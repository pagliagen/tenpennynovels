import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { 
  ExperienceGrant, 
  CharacterProgression, 
  Character, 
  GamingSession,
  OnGameMessage,
  OffGameChatMessage
} from '../../../../packages/database/models';
import { logger } from '../utils/logger';

export class ExperienceController {
  
  /**
   * Get character progression summary
   * GET /game/character/experience
   */
  static async getCharacterProgression(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;
    
    try {
      // Get or create progression record
      let progression = await CharacterProgression.findOne({ characterId });
      
      if (!progression) {
        // Initialize progression for existing character
        const character = await Character.findById(characterId);
        if (!character) {
          return res.status(404).json({
            success: false,
            error: 'Personaggio non trovato',
            code: 'CHARACTER_NOT_FOUND'
          });
        }
        
        progression = await this.initializeProgression(character);
      }
      
      // Get recent grants (last 30 days)
      const recentGrants = await ExperienceGrant.find({
        characterId,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        isVisible: true
      }).sort({ createdAt: -1 });
      
      // Get available spending opportunities
      const spendingOptions = await this.getSpendingOptions(characterId, progression);
      
      res.json({
        success: true,
        data: {
          progression,
          recentGrants,
          spendingOptions
        }
      });
      
    } catch (error: any) {
      logger.error('Failed to get character progression:', {
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare i dati di progressione',
        code: 'PROGRESSION_FETCH_ERROR'
      });
    }
  }

  /**
   * Spend experience points to improve character
   * POST /game/character/experience/spend
   */
  static async spendExperiencePoints(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;
    const { spendingType, target, pointsToSpend } = req.body; // spendingType: 'skill' | 'stat'
    
    try {
      // Start transaction
      const session = await mongoose.startSession();
      
      const result = await session.withTransaction(async () => {
        // Get current character and progression
        const [character, progression] = await Promise.all([
          Character.findById(characterId).session(session),
          CharacterProgression.findOne({ characterId }).session(session)
        ]);
        
        if (!character || !progression) {
          throw new Error('Personaggio o progressione non trovati');
        }
        
        // Validate spending
        const validation = await this.validateSpending(
          character, 
          progression, 
          spendingType, 
          target, 
          pointsToSpend
        );
        
        if (!validation.valid) {
          throw new Error(validation.reason);
        }
        
        // Calculate costs and improvements
        const spendingResult = await this.calculateImprovement(
          character,
          spendingType,
          target,
          pointsToSpend
        );
        
        // Check if character has enough points
        const requiredPoints = spendingType === 'skill' 
          ? progression.availableSkillPoints 
          : progression.availableExperiencePoints;
          
        if (requiredPoints < spendingResult.totalCost) {
          throw new Error('Punti disponibili insufficienti');
        }
        
        // Apply improvements to character
        if (spendingType === 'skill') {
          const currentSkillValue = character.skills.get(target) || 0;
          character.skills.set(target, spendingResult.newValue);
          progression.availableSkillPoints -= spendingResult.totalCost;
          progression.totalSkillPointsSpent += spendingResult.totalCost;
        } else {
          // Stat improvement
          (character.stats as any)[target] = spendingResult.newValue;
          progression.availableExperiencePoints -= spendingResult.totalCost;
          progression.totalExperienceSpent += spendingResult.totalCost;
        }
        
        // Update progression tracking
        await this.updateProgressionTracking(
          progression,
          spendingType,
          target,
          spendingResult,
          session
        );
        
        // Check for milestones
        const milestones = await this.checkMilestones(character, progression);
        if (milestones.length > 0) {
          await this.grantMilestoneRewards(characterId, milestones, session);
        }
        
        // Save changes
        await character.save({ session });
        await progression.save({ session });
        
        // Create spending record in grants
        const spendingGrant = new ExperienceGrant({
          characterId,
          grantedBy: characterId,
          grantedByType: 'system',
          grantedByName: 'Character Improvement',
          grantType: 'manual_master', // Will be updated to 'spending_record'
          category: 'special',
          experiencePoints: spendingType === 'stat' ? -spendingResult.totalCost : 0,
          skillPoints: spendingType === 'skill' ? -spendingResult.totalCost : 0,
          reason: `Improved ${target} from ${spendingResult.previousValue} to ${spendingResult.newValue}`,
          isSpent: true,
          spentAt: new Date(),
          spentOn: {
            type: spendingType,
            target,
            previousValue: spendingResult.previousValue,
            newValue: spendingResult.newValue,
            spentAmount: spendingResult.totalCost
          }
        });
        
        await spendingGrant.save({ session });
        
        return spendingResult;
      });
      
      session.endSession();
      
      logger.info('Character improvement completed', {
        characterId,
        spendingType,
        target,
        pointsSpent: pointsToSpend
      });
      
      res.json({
        success: true,
        message: `${target} migliorato con successo`,
        data: {
          spendingType,
          target,
          pointsSpent: pointsToSpend,
          newValue: result.newValue
        }
      });
      
    } catch (error: any) {
      logger.error('Character improvement failed', {
        characterId,
        spendingType,
        target,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Improvement failed',
        code: 'IMPROVEMENT_ERROR'
      });
    }
  }

  /**
   * Grant experience points (Master only)
   * POST /game/experience/grant
   */
  static async grantExperience(req: Request, res: Response): Promise<void> {
    const masterId = req.character!.characterId;
    const masterName = req.character!.characterName;
    const { 
      targetCharacterIds, 
      experiencePoints, 
      skillPoints, 
      reason, 
      comment,
      category,
      sessionId 
    } = req.body;
    
    try {
      // Verify master permissions
      const master = await Character.findById(masterId);
      if (!master || !master.gameplayRoles.includes('master')) {
        return res.status(403).json({
          success: false,
          error: 'Permessi di Master richiesti',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Validate inputs
      if (!targetCharacterIds || targetCharacterIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Almeno un personaggio destinatario richiesto',
          code: 'INVALID_INPUT'
        });
      }
      
      const results = [];
      
      // Grant experience to each target character
      for (const targetCharacterId of targetCharacterIds) {
        try {
          const grant = await this.createExperienceGrant({
            characterId: targetCharacterId,
            grantedBy: masterId,
            grantedByType: 'master',
            grantedByName: masterName,
            grantType: 'manual_master',
            category: category || 'roleplay',
            experiencePoints: experiencePoints || 0,
            skillPoints: skillPoints || 0,
            reason,
            masterComment: comment,
            sessionId
          });
          
          // Update character progression
          await this.updateCharacterProgression(targetCharacterId, experiencePoints, skillPoints);
          
          results.push({
            characterId: targetCharacterId,
            grantId: grant._id,
            success: true
          });
          
        } catch (error: any) {
          results.push({
            characterId: targetCharacterId,
            success: false,
            error: error instanceof Error ? error.message : 'Grant failed'
          });
        }
      }
      
      // Send notifications to characters
      await this.sendExperienceNotifications(targetCharacterIds, experiencePoints, skillPoints, reason);
      
      logger.info('Experience granted by master', {
        masterId,
        masterName,
        targetCharacterIds,
        experiencePoints,
        skillPoints,
        reason
      });
      
      res.json({
        success: true,
        message: 'Concessioni di esperienza elaborate',
        data: { results }
      });
      
    } catch (error: any) {
      logger.error('Experience grant failed', {
        masterId,
        targetCharacterIds,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json({
        success: false,
        error: 'Impossibile concedere l\'esperienza',
        code: 'GRANT_EXPERIENCE_ERROR'
      });
    }
  }

  /**
   * Get progression statistics for character
   * GET /game/character/progression-stats
   */
  static async getProgressionStats(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;
    
    try {
      const [progression, grants, sessions] = await Promise.all([
        CharacterProgression.findOne({ characterId }),
        ExperienceGrant.find({ characterId, isVisible: true }).sort({ createdAt: -1 }).limit(20),
        GamingSession.find({ 
          'participants.characterId': characterId,
          status: 'completed'
        }).sort({ sessionDate: -1 }).limit(10)
      ]);
      
      if (!progression) {
        return res.status(404).json({
          success: false,
          error: 'Dati di progressione non trovati',
          code: 'PROGRESSION_NOT_FOUND'
        });
      }
      
      // Calculate statistics
      const stats = {
        overview: {
          availableXP: progression.availableExperiencePoints,
          availableSkillPoints: progression.availableSkillPoints,
          totalEarned: progression.totalExperienceEarned + progression.totalSkillPointsEarned,
          totalSpent: progression.totalExperienceSpent + progression.totalSkillPointsSpent,
          efficiency: this.calculateEfficiency(progression)
        },
        activity: {
          sessionsParticipated: progression.activityMetrics.sessionsParticipated,
          consecutiveActiveDays: progression.activityMetrics.consecutiveActiveDays,
          longestStreak: progression.activityMetrics.longestActiveStreak
        },
        achievements: progression.milestones,
        recentGrants: grants,
        recentSessions: sessions
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le statistiche di progressione',
        code: 'STATS_ERROR'
      });
    }
  }

  // Helper Methods

  private static async initializeProgression(character: any): Promise<any> {
    const progression = new CharacterProgression({
      characterId: character._id,
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
        lastDailyGrant: null,
        lastActivityCheck: new Date(),
        consecutiveActiveDays: 0,
        longestActiveStreak: 0
      },
      recentSpending: [],
      settings: {
        autoSpendEnabled: false,
        preferredSkillCategories: [],
        spendingNotifications: true
      }
    });
    
    await progression.save();
    return progression;
  }

  private static async validateSpending(
    character: any, 
    progression: any, 
    type: string, 
    target: string, 
    points: number
  ): Promise<{ valid: boolean; reason?: string }> {
    
    if (type === 'skill') {
      const currentValue = character.skills.get(target) || 0;
      const maxValue = 100; // Call of Cthulhu skill maximum
      
      if (currentValue >= maxValue) {
        return { valid: false, reason: 'Abilità già al valore massimo' };
      }
      
      if (progression.availableSkillPoints < points) {
        return { valid: false, reason: 'Punti abilità insufficienti' };
      }
      
    } else if (type === 'stat') {
      const currentValue = (character.stats as any)[target];
      const maxValue = 100; // Call of Cthulhu stat maximum
      
      if (currentValue >= maxValue) {
        return { valid: false, reason: 'Caratteristica già al valore massimo' };
      }
      
      if (progression.availableExperiencePoints < points) {
        return { valid: false, reason: 'Punti esperienza insufficienti' };
      }
    }
    
    return { valid: true };
  }

  private static async calculateImprovement(
    character: any,
    type: string,
    target: string,
    pointsToSpend: number
  ): Promise<{
    previousValue: number;
    newValue: number;
    totalCost: number;
    improvements: { from: number; to: number; cost: number }[];
  }> {
    
    const currentValue = type === 'skill' 
      ? character.skills.get(target) || 0
      : (character.stats as any)[target];
    
    // Call of Cthulhu improvement costs (escalating)
    let remainingPoints = pointsToSpend;
    let currentVal = currentValue;
    const improvements = [];
    let totalCost = 0;
    
    while (remainingPoints > 0 && currentVal < 100) {
      const costForNextPoint = this.getImprovementCost(currentVal, type);
      
      if (remainingPoints >= costForNextPoint) {
        improvements.push({
          from: currentVal,
          to: currentVal + 1,
          cost: costForNextPoint
        });
        
        remainingPoints -= costForNextPoint;
        totalCost += costForNextPoint;
        currentVal++;
      } else {
        break;
      }
    }
    
    return {
      previousValue: currentValue,
      newValue: currentVal,
      totalCost,
      improvements
    };
  }

  private static getImprovementCost(currentValue: number, type: string): number {
    // Call of Cthulhu progression costs
    if (type === 'skill') {
      if (currentValue < 50) return 1; // Easy improvement
      if (currentValue < 75) return 2; // Moderate improvement  
      return 3; // Difficult improvement
    } else {
      // Stats are more expensive
      if (currentValue < 60) return 3;
      if (currentValue < 80) return 5;
      return 8; // Very expensive at high levels
    }
  }

  private static async createExperienceGrant(grantData: any): Promise<any> {
    const grant = new ExperienceGrant(grantData);
    await grant.save();
    return grant;
  }

  private static async updateCharacterProgression(
    characterId: string,
    experiencePoints: number,
    skillPoints: number
  ): Promise<void> {
    const progression = await CharacterProgression.findOne({ characterId });
    
    if (progression) {
      progression.availableExperiencePoints += experiencePoints;
      progression.availableSkillPoints += skillPoints;
      progression.totalExperienceEarned += experiencePoints;
      progression.totalSkillPointsEarned += skillPoints;
      progression.lastUpdated = new Date();
      
      await progression.save();
    }
  }

  private static async sendExperienceNotifications(
    characterIds: string[],
    experiencePoints: number,
    skillPoints: number,
    reason: string
  ): Promise<void> {
    // Send OnGame messages or Redis events to notify characters
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();
    
    for (const characterId of characterIds) {
      await redis.publish('character:experience_granted', JSON.stringify({
        characterId,
        experiencePoints,
        skillPoints,
        reason,
        timestamp: new Date().toISOString()
      }));
    }
  }

  private static calculateEfficiency(progression: any): number {
    const totalEarned = progression.totalExperienceEarned + progression.totalSkillPointsEarned;
    const totalSpent = progression.totalExperienceSpent + progression.totalSkillPointsSpent;
    
    if (totalEarned === 0) return 0;
    return (totalSpent / totalEarned) * 100;
  }

  private static async getSpendingOptions(characterId: string, progression: any): Promise<any> {
    const character = await Character.findById(characterId);
    if (!character) return { skills: [], stats: [] };
    
    const skillOptions = [];
    const statOptions = [];
    
    // Generate skill spending options
    for (const [skillName, currentValue] of character.skills) {
      if (currentValue < 100) {
        const cost = this.getImprovementCost(currentValue, 'skill');
        if (progression.availableSkillPoints >= cost) {
          skillOptions.push({
            name: skillName,
            currentValue,
            nextLevelCost: cost,
            canAfford: true
          });
        }
      }
    }
    
    // Generate stat spending options
    for (const [statName, currentValue] of Object.entries(character.stats)) {
      if (currentValue < 100) {
        const cost = this.getImprovementCost(currentValue as number, 'stat');
        if (progression.availableExperiencePoints >= cost) {
          statOptions.push({
            name: statName,
            currentValue,
            nextLevelCost: cost,
            canAfford: true
          });
        }
      }
    }
    
    return {
      skills: skillOptions.slice(0, 10), // Top 10 most affordable
      stats: statOptions
    };
  }

  private static async updateProgressionTracking(
    progression: any,
    type: string,
    target: string,
    result: any,
    session: any
  ): Promise<void> {
    // Update improvement tracking
    if (type === 'skill') {
      const existingSkill = progression.skillsImproved.find((s: any) => s.skill === target);
      if (existingSkill) {
        existingSkill.timesImproved++;
        existingSkill.totalPointsSpent += result.totalCost;
        existingSkill.currentValue = result.newValue;
        existingSkill.lastImprovedAt = new Date();
      } else {
        progression.skillsImproved.push({
          skill: target,
          timesImproved: 1,
          totalPointsSpent: result.totalCost,
          currentValue: result.newValue,
          startingValue: result.previousValue,
          lastImprovedAt: new Date()
        });
      }
    } else {
      const existingStat = progression.statsImproved.find((s: any) => s.stat === target);
      if (existingStat) {
        existingStat.timesImproved++;
        existingStat.totalPointsSpent += result.totalCost;
        existingStat.currentValue = result.newValue;
      } else {
        progression.statsImproved.push({
          stat: target,
          timesImproved: 1,
          totalPointsSpent: result.totalCost,
          currentValue: result.newValue,
          startingValue: result.previousValue
        });
      }
    }
    
    // Add to recent spending
    progression.recentSpending.unshift({
      spentAt: new Date(),
      type,
      target,
      pointsSpent: result.totalCost,
      resultValue: result.newValue
    });
    
    // Keep only last 20 spending records
    if (progression.recentSpending.length > 20) {
      progression.recentSpending = progression.recentSpending.slice(0, 20);
    }
    
    progression.lastUpdated = new Date();
  }

  private static async checkMilestones(character: any, progression: any): Promise<any[]> {
    const milestones = [];
    
    // Check skill milestones (e.g., first skill to 80, 90, etc.)
    for (const [skillName, value] of character.skills) {
      if (value >= 80 && !progression.milestones.some((m: any) => 
        m.type === 'skill_milestone' && m.achievement === `${skillName}_80`)) {
        milestones.push({
          type: 'skill_milestone',
          achievement: `${skillName}_80`,
          description: `Achieved 80+ in ${skillName}`,
          rewardGranted: {
            skillPoints: 5,
            specialReward: 'Skill Mastery Badge'
          }
        });
      }
    }
    
    // Check stat milestones
    for (const [statName, value] of Object.entries(character.stats)) {
      if (value >= 90 && !progression.milestones.some((m: any) => 
        m.type === 'stat_milestone' && m.achievement === `${statName}_90`)) {
        milestones.push({
          type: 'stat_milestone',
          achievement: `${statName}_90`,
          description: `Achieved 90+ in ${statName}`,
          rewardGranted: {
            experiencePoints: 10,
            specialReward: 'Exceptional Ability Recognition'
          }
        });
      }
    }
    
    return milestones;
  }

  private static async grantMilestoneRewards(
    characterId: string,
    milestones: any[],
    session: any
  ): Promise<void> {
    for (const milestone of milestones) {
      if (milestone.rewardGranted) {
        const grant = new ExperienceGrant({
          characterId,
          grantedBy: characterId,
          grantedByType: 'system',
          grantedByName: 'Milestone System',
          grantType: 'milestone_achievement',
          category: 'special',
          experiencePoints: milestone.rewardGranted.experiencePoints || 0,
          skillPoints: milestone.rewardGranted.skillPoints || 0,
          reason: `Milestone achieved: ${milestone.description}`,
          metadata: {
            achievementId: milestone.achievement,
            specialReward: milestone.rewardGranted.specialReward
          }
        });
        
        await grant.save({ session });
      }
    }
  }
}