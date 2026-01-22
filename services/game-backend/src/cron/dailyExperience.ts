import cron from 'node-cron';
import {
  Character,
  CharacterProgression,
  ExperienceGrant,
  OnGameMessage,
  OffGameChatMessage,
  GamingSession
} from '../../../../packages/database/models';
import { logger } from '../utils/logger';
import { ConfigurationService } from '../../../../packages/shared/src/services/ConfigurationService';
import { getRedisClient } from '../config/redis';

// Initialize cron jobs with dynamic schedules from database
async function initializeDailyExperienceCrons(): Promise<void> {
  const redis = getRedisClient();
  const configService = new ConfigurationService(redis, logger);

  // Fetch cron schedules from database
  const dailyXpSchedule = await configService.getConfig('cron_schedule_daily_xp') || '0 2 * * *';
  const weeklyResetSchedule = await configService.getConfig('cron_schedule_weekly_credit') || '0 3 * * 1';

  logger.info(`✅ Initializing Daily XP cron with schedule: ${dailyXpSchedule}`);
  logger.info(`✅ Initializing Weekly Reset cron with schedule: ${weeklyResetSchedule}`);

  // Daily experience grants (configurable schedule, default: 2:00 AM)
  cron.schedule(dailyXpSchedule, async () => {
    logger.info('Starting daily experience grant process');
  
  try {
    // Get all active characters
    const activeCharacters = await Character.find({
      status: 'APPROVED',
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Active within 24h
    });
    
    const results = [];
    
    for (const character of activeCharacters) {
      try {
        const dailyGrant = await processDailyExperienceGrant(character);
        results.push({ characterId: character._id, success: true, grant: dailyGrant });
      } catch (error: any) {
        results.push({ 
          characterId: character._id, 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    logger.info(`Daily experience grants completed: ${results.length} characters processed`);
    
  } catch (error: any) {
    logger.error('Daily experience grant process failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

async function processDailyExperienceGrant(character: any): Promise<any> {
  const progression = await CharacterProgression.findOne({ characterId: character._id });
  if (!progression) {
    // Create progression if it doesn't exist
    const newProgression = new CharacterProgression({
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
    await newProgression.save();
    return null; // Don't grant on first day
  }

  // Check if already granted today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (progression.activityMetrics.lastDailyGrant &&
      progression.activityMetrics.lastDailyGrant >= today) {
    return null; // Already granted today
  }

  // Fetch configuration values from database
  const { ConfigurationService } = await import('../../../../packages/shared/src/services/ConfigurationService');
  const { getRedisClient } = await import('../config/redis');
  const redis = getRedisClient();
  const configService = new ConfigurationService(redis, logger);

  const baseXP = await configService.getConfig('experience_daily_base_xp') || 2;
  const baseSkill = await configService.getConfig('experience_daily_base_skill') || 1;
  const maxMultiplier = await configService.getConfig('experience_activity_multiplier_max') || 2.0;

  // Calculate daily grant based on activity
  const activityScore = await calculateActivityScore(character._id);
  const baseGrant = { experiencePoints: baseXP, skillPoints: baseSkill };

  // Apply activity multiplier
  const multiplier = Math.max(0.5, Math.min(maxMultiplier, activityScore));
  const finalGrant = {
    experiencePoints: Math.round(baseGrant.experiencePoints * multiplier),
    skillPoints: Math.round(baseGrant.skillPoints * multiplier)
  };
  
  // Create the grant
  const grant = new ExperienceGrant({
    characterId: character._id,
    grantedBy: character._id,
    grantedByType: 'system',
    grantedByName: 'Daily Activity System',
    grantType: 'automatic_daily',
    category: 'daily',
    experiencePoints: finalGrant.experiencePoints,
    skillPoints: finalGrant.skillPoints,
    reason: `Daily activity reward (activity score: ${activityScore.toFixed(2)})`,
    metadata: {
      automaticRule: 'daily_activity_grant',
      bonusMultiplier: multiplier,
      activityScore
    }
  });
  
  await grant.save();
  
  // Update progression
  progression.availableExperiencePoints += finalGrant.experiencePoints;
  progression.availableSkillPoints += finalGrant.skillPoints;
  progression.totalExperienceEarned += finalGrant.experiencePoints;
  progression.totalSkillPointsEarned += finalGrant.skillPoints;
  progression.activityMetrics.lastDailyGrant = new Date();
  progression.activityMetrics.daysActive++;
  
  // Update consecutive active days
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (progression.activityMetrics.lastActivityCheck && 
      progression.activityMetrics.lastActivityCheck >= yesterday) {
    progression.activityMetrics.consecutiveActiveDays++;
    progression.activityMetrics.longestActiveStreak = Math.max(
      progression.activityMetrics.longestActiveStreak,
      progression.activityMetrics.consecutiveActiveDays
    );
  } else {
    progression.activityMetrics.consecutiveActiveDays = 1;
  }
  
  progression.activityMetrics.lastActivityCheck = new Date();
  await progression.save();
  
  // Send notification
  try {
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();
    
    await redis.publish('character:daily_experience', JSON.stringify({
      characterId: character._id,
      experiencePoints: finalGrant.experiencePoints,
      skillPoints: finalGrant.skillPoints,
      activityScore,
      consecutiveDays: progression.activityMetrics.consecutiveActiveDays
    }));
  } catch (redisError: any) {
    logger.error('Failed to send daily experience notification', {
      characterId: character._id,
      error: redisError instanceof Error ? redisError.message : String(redisError)
    });
  }
  
  return grant;
}

async function calculateActivityScore(characterId: string): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  
  try {
    // Count recent activity
    const [ongameMessages, offgameMessages, sessionsCount] = await Promise.all([
      // OnGame messages
      OnGameMessage.countDocuments({
        from: characterId,
        sentAt: { $gte: oneDayAgo }
      }),
      
      // OffGame messages  
      OffGameChatMessage.countDocuments({
        senderId: characterId,
        sentAt: { $gte: oneDayAgo }
      }),
      
      // Gaming sessions in last 3 days
      GamingSession.countDocuments({
        'participants.characterId': characterId,
        sessionDate: { $gte: threeDaysAgo },
        status: 'completed'
      })
    ]);
    
    // Calculate activity score (0.5 - 2.0 range)
    let score = 0.5; // Base score
    
    // Message activity (up to +0.8)
    const totalMessages = ongameMessages + offgameMessages;
    score += Math.min(0.8, totalMessages * 0.1);
    
    // Session participation (up to +0.7)
    score += Math.min(0.7, sessionsCount * 0.35);
    
    return Math.min(2.0, score);
    
  } catch (error: any) {
    logger.error('Failed to calculate activity score', {
      characterId,
      error: error instanceof Error ? error.message : String(error)
    });
    return 0.5; // Return base score on error
  }
}

  // Weekly activity reset (configurable schedule, default: Monday 3:00 AM)
  cron.schedule(weeklyResetSchedule, async () => {
    logger.info('Starting weekly activity metrics reset');
  
  try {
    await CharacterProgression.updateMany(
      {},
      { 
        $set: { 'activityMetrics.messagesThisWeek': 0 }
      }
    );
    
    logger.info('Weekly activity metrics reset completed');
    
  } catch (error: any) {
    logger.error('Weekly activity reset failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  });

  logger.info('✅ Daily experience cron jobs initialized successfully');
}

export { initializeDailyExperienceCrons, processDailyExperienceGrant, calculateActivityScore };