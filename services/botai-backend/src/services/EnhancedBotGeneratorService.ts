/**
 * Enhanced Bot Generator Service
 * Generates COMPLETE bot characters with full stats, skills, occupation, background, and demographics
 *
 * Multi-stage approach:
 * 1. AI Core Generation - Generate personality-driven foundation
 * 2. Occupation Matching - Match to database occupations
 * 3. Skill Initialization - Load all skills with base values
 * 4. Occupation Bonuses - Apply required/bonus skill bonuses
 * 5. Skill Distribution - AI-driven skill point allocation
 * 6. Character Assembly - Build complete payload
 */

import { claudeConfig } from '../config/claude';
import { logger } from '../utils/logger';
import { SkillCalculator } from '../utils/SkillCalculator';
import {
  CompleteBot,
  CompleteCharacterPayload,
  BotGenerationParams,
  CoreCharacterData,
  Occupation,
  Skill,
  CharacterStats,
  SkillsMap,
  SkillBreakdown,
  SkillBudget,
  SkillPriority,
  OccupationReference
} from '../types/CompleteCharacter';

export class EnhancedBotGeneratorService {
  /**
   * Main entry point: Generate a complete bot with full character data
   */
  async generateCompleteBot(
    params: BotGenerationParams,
    dbContext?: any
  ): Promise<CompleteBot> {
    try {
      logger.info(`[EnhancedBotGen] Starting complete bot generation for ${params.name}`);

      // Stage 1: AI generates core character data
      const coreData = await this.generateCoreCharacterData(params);
      logger.info(`[EnhancedBotGen] Stage 1 complete: Core data generated`);

      // Stage 2: Match occupation to database
      const occupation = await this.matchOccupation(
        coreData.occupationSuggestions,
        coreData.stats,
        params.personality.traits,
        dbContext
      );
      logger.info(`[EnhancedBotGen] Stage 2 complete: Occupation matched - ${occupation.name}`);

      // Stage 3: Initialize all skills with base values
      const initialSkills = await this.initializeSkills(coreData.stats, dbContext);
      logger.info(`[EnhancedBotGen] Stage 3 complete: ${Object.keys(initialSkills).length} skills initialized`);

      // Stage 4: Apply occupation bonuses
      const skillsWithBonuses = this.applyOccupationBonuses(initialSkills, occupation);
      logger.info(`[EnhancedBotGen] Stage 4 complete: Occupation bonuses applied`);

      // Stage 5: Distribute remaining skill points
      const finalSkills = await this.distributeRemainingPoints(
        skillsWithBonuses,
        occupation,
        coreData.stats,
        params.personality
      );
      logger.info(`[EnhancedBotGen] Stage 5 complete: Skill points distributed`);

      // Stage 6: Assemble complete character payload
      const character = this.buildCompleteCharacterPayload(
        params,
        coreData,
        occupation,
        finalSkills
      );
      logger.info(`[EnhancedBotGen] Stage 6 complete: Character assembled`);

      // Return complete bot data
      const completeBot: CompleteBot = {
        bot: {
          _id: '', // Will be assigned by database
          name: params.name,
          surname: params.surname,
          gender: params.gender,
          personality: params.personality,
          background: params.background
        },
        character
      };

      logger.info(`[EnhancedBotGen] ✅ Complete bot generation successful`);
      return completeBot;

    } catch (error: any) {
      logger.error('[EnhancedBotGen] Error generating complete bot:', error);
      throw error;
    }
  }

  /**
   * STAGE 1: AI Core Generation
   * Generate stats, occupation suggestions, demographics, background
   */
  private async generateCoreCharacterData(params: BotGenerationParams): Promise<CoreCharacterData> {
    const prompt = `You are generating COMPLETE character data for a Victorian London 1891 RPG character (Call of Cthulhu system).

CHARACTER IDENTITY:
- Name: ${params.name}${params.surname ? ' ' + params.surname : ''}
- Gender: ${params.gender}
- Personality Traits: ${params.personality.traits.join(', ')}
- Values: ${params.personality.values.join(', ')}
- Goals: ${params.personality.goals.join(', ')}${params.background ? `\n- Background: ${params.background}` : ''}

Generate complete character foundation data:

1. **STATS DISTRIBUTION** (8 stats, total ~400 points):
   - strength (STR): Physical power (typical range: 30-90)
   - constitution (CON): Health and stamina (typical range: 30-90)
   - size (SIZ): Physical size (typical range: 40-90)
   - dexterity (DEX): Agility and coordination (typical range: 30-90)
   - charm (CHA): Charisma and presence (typical range: 30-90)
   - intelligence (INT): Mental acuity (typical range: 40-90)
   - power (POW): Willpower and magic resistance (typical range: 30-90)
   - education (EDU): Learning and knowledge (typical range: 30-90)

   Distribute points based on personality and occupation fit. Total should be ~400 points (±20).

2. **OCCUPATION SUGGESTIONS** (3-5 options):
   Suggest 3-5 Victorian-era occupations that fit this personality.
   Examples: Merchant, Bartender, Constable, Doctor, Journalist, Antiquarian, Dockworker, etc.

3. **DEMOGRAPHICS**:
   - age: 20-60 (realistic for Victorian era)
   - height: e.g., "175 cm" (realistic for era and gender)
   - weight: e.g., "70 kg" (proportional to height and build)
   - eyeColor: Common colors for Victorian London
   - hairColor: Common colors for Victorian London
   - physicalDescription: 2-3 sentences describing appearance, clothing, distinctive features

4. **COMPLETE BACKGROUND** (9 fields):
   - briefHistory: 2-3 paragraphs on childhood, key events, how they became who they are
   - personality: 2-3 sentences on personality traits and demeanor
   - ideology: What they believe in (religion, politics, philosophy)
   - importantPeople: Key people in their life (family, mentors, rivals)
   - importantPlaces: Significant locations (birthplace, favorite spots)
   - treasuredPossessions: Meaningful items they own
   - traits: 2-3 defining character traits
   - goals: Personal aspirations and ambitions
   - fears: What they fear or avoid
   - secrets: Hidden truths they keep (scandals, crimes, shames)

IMPORTANT RULES:
- Stats must be simple integers (30-90 range)
- Total stats should be ~400 (±20)
- Consider Victorian social class in stat distribution:
  * Upper class: High EDU (70-90), high CHA (70-90)
  * Working class: High STR (60-80), lower EDU (30-50)
  * Middle class: Balanced stats
- Background must be rich with Victorian details
- Demographics must be period-appropriate

Respond ONLY with valid JSON (no markdown):
{
  "stats": {
    "strength": 60,
    "constitution": 55,
    "size": 65,
    "dexterity": 50,
    "charm": 70,
    "intelligence": 65,
    "power": 50,
    "education": 60
  },
  "occupationSuggestions": ["Merchant", "Antiquarian", "Shopkeeper"],
  "demographics": {
    "age": 42,
    "height": "175 cm",
    "weight": "72 kg",
    "eyeColor": "brown",
    "hairColor": "dark brown with grey streaks",
    "physicalDescription": "..."
  },
  "background": {
    "briefHistory": "...",
    "personality": "...",
    "ideology": "...",
    "importantPeople": "...",
    "importantPlaces": "...",
    "treasuredPossessions": "...",
    "traits": "...",
    "goals": "...",
    "fears": "...",
    "secrets": "..."
  }
}`;

    const client = claudeConfig.getClient();
    const model = claudeConfig.getModel();

    logger.info(`[EnhancedBotGen] Stage 1: Generating core character data with ${model}`);

    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/, '').replace(/```\s*$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleanedText);

    // Validate stats total
    const statsTotal = Object.values(parsed.stats as CharacterStats).reduce((sum: number, val) => sum + (val as number), 0);
    logger.info(`[EnhancedBotGen] Stats total: ${statsTotal} points`);

    if (statsTotal < 350 || statsTotal > 450) {
      logger.warn(`[EnhancedBotGen] Stats total ${statsTotal} is outside normal range (350-450)`);
    }

    return parsed as CoreCharacterData;
  }

  /**
   * STAGE 2: Occupation Matching
   * Match AI suggestions to actual database occupations
   */
  private async matchOccupation(
    suggestions: string[],
    stats: CharacterStats,
    personalityTraits: string[],
    dbContext?: any
  ): Promise<Occupation> {
    // Import database models
    const mongoose = dbContext || require('mongoose');
    const { default: OccupationModel } = await import('../../../unified-backend/src/database/models/Occupation');

    logger.info(`[EnhancedBotGen] Stage 2: Matching occupation from suggestions: ${suggestions.join(', ')}`);

    // Load all occupations from database
    const allOccupations = await OccupationModel.find({}).lean();

    if (allOccupations.length === 0) {
      throw new Error('No occupations found in database');
    }

    logger.info(`[EnhancedBotGen] Loaded ${allOccupations.length} occupations from database`);

    // Try to find exact match
    for (const suggestion of suggestions) {
      const exactMatch = allOccupations.find(
        (occ: any) => occ.name.toLowerCase() === suggestion.toLowerCase()
      );
      if (exactMatch) {
        logger.info(`[EnhancedBotGen] Found exact match: ${exactMatch.name}`);
        return this.mapOccupationFromDB(exactMatch);
      }
    }

    // Try partial match
    for (const suggestion of suggestions) {
      const partialMatch = allOccupations.find(
        (occ: any) => occ.name.toLowerCase().includes(suggestion.toLowerCase()) ||
                      suggestion.toLowerCase().includes(occ.name.toLowerCase())
      );
      if (partialMatch) {
        logger.info(`[EnhancedBotGen] Found partial match: ${partialMatch.name} for suggestion "${suggestion}"`);
        return this.mapOccupationFromDB(partialMatch);
      }
    }

    // Fallback: pick a random occupation that fits social class based on stats
    logger.warn(`[EnhancedBotGen] No match found for suggestions, selecting random occupation`);

    // Determine social class from education stat
    let targetSocialClass = 'middle';
    if (stats.education >= 70) targetSocialClass = 'upper';
    else if (stats.education <= 40) targetSocialClass = 'working';

    const classMatches = allOccupations.filter(
      (occ: any) => occ.socialClass?.toLowerCase() === targetSocialClass
    );

    const finalChoice = classMatches.length > 0
      ? classMatches[Math.floor(Math.random() * classMatches.length)]
      : allOccupations[Math.floor(Math.random() * allOccupations.length)];

    logger.info(`[EnhancedBotGen] Selected fallback occupation: ${finalChoice.name}`);
    return this.mapOccupationFromDB(finalChoice);
  }

  /**
   * Helper: Map database occupation to Occupation type
   */
  private mapOccupationFromDB(dbOccupation: any): Occupation {
    return {
      _id: dbOccupation._id.toString(),
      name: dbOccupation.name,
      requiredSkills: dbOccupation.requiredSkills || [],
      bonusSkills: dbOccupation.bonusSkills || [],
      description: dbOccupation.description,
      category: dbOccupation.category,
      socialClass: dbOccupation.socialClass
    };
  }

  /**
   * STAGE 3: Skill Initialization
   * Load all skills from database and initialize with base values
   */
  private async initializeSkills(stats: CharacterStats, dbContext?: any): Promise<SkillsMap> {
    // Import database models
    const mongoose = dbContext || require('mongoose');
    const { default: SkillModel } = await import('../../../unified-backend/src/database/models/Skill');

    logger.info(`[EnhancedBotGen] Stage 3: Loading skills from database`);

    // Load all skills
    const allSkills = await SkillModel.find({}).lean();

    if (allSkills.length === 0) {
      throw new Error('No skills found in database');
    }

    logger.info(`[EnhancedBotGen] Loaded ${allSkills.length} skills`);

    // Initialize skills map
    const skillsMap: SkillsMap = {};

    for (const dbSkill of allSkills) {
      const skill: Skill = {
        _id: dbSkill._id.toString(),
        name: dbSkill.name,
        baseValue: dbSkill.baseValue,
        category: dbSkill.category,
        description: dbSkill.description
      };

      // Calculate base value and create breakdown
      const breakdown = SkillCalculator.initializeSkillBreakdown(skill, stats);
      skillsMap[skill.name] = breakdown;
    }

    logger.info(`[EnhancedBotGen] Initialized ${Object.keys(skillsMap).length} skills with base values`);

    return skillsMap;
  }

  /**
   * STAGE 4: Occupation Bonuses
   * Apply required skill bonuses and occupation bonus skills
   */
  private applyOccupationBonuses(skills: SkillsMap, occupation: Occupation): SkillsMap {
    logger.info(`[EnhancedBotGen] Stage 4: Applying bonuses for ${occupation.name}`);
    logger.info(`[EnhancedBotGen] Required skills: ${occupation.requiredSkills.join(', ')}`);
    logger.info(`[EnhancedBotGen] Bonus skills: ${occupation.bonusSkills.join(', ')}`);

    const updatedSkills = { ...skills };

    // Apply required skill bonuses (40 - base)
    for (const skillName of occupation.requiredSkills) {
      if (updatedSkills[skillName]) {
        updatedSkills[skillName] = SkillCalculator.applyRequiredBonus(updatedSkills[skillName]);
        logger.debug(`[EnhancedBotGen] Applied required bonus to ${skillName}: total now ${updatedSkills[skillName].total}`);
      } else {
        logger.warn(`[EnhancedBotGen] Required skill "${skillName}" not found in skills map`);
      }
    }

    // Apply occupation bonus skills (+30 points)
    // Note: Typically 1-2 bonus skills, select the first one or randomly
    const selectedBonusSkill = occupation.bonusSkills[0]; // Select first bonus skill

    if (selectedBonusSkill && updatedSkills[selectedBonusSkill]) {
      updatedSkills[selectedBonusSkill] = SkillCalculator.applyOccupationBonus(updatedSkills[selectedBonusSkill]);
      logger.info(`[EnhancedBotGen] Applied occupation bonus (+30) to ${selectedBonusSkill}: total now ${updatedSkills[selectedBonusSkill].total}`);
    } else if (selectedBonusSkill) {
      logger.warn(`[EnhancedBotGen] Bonus skill "${selectedBonusSkill}" not found in skills map`);
    }

    return updatedSkills;
  }

  /**
   * STAGE 5: Skill Point Distribution
   * Use AI to prioritize skills, then distribute points programmatically
   */
  private async distributeRemainingPoints(
    skills: SkillsMap,
    occupation: Occupation,
    stats: CharacterStats,
    personality: { traits: string[]; values: string[]; goals: string[] }
  ): Promise<SkillsMap> {
    logger.info(`[EnhancedBotGen] Stage 5: Distributing skill points`);

    // Calculate skill budget
    const budget = SkillCalculator.calculateSkillBudget(stats.intelligence);
    logger.info(`[EnhancedBotGen] Skill budget: ${budget.total} points (INT: ${stats.intelligence} * 2 + 100 base)`);

    // Get AI prioritization
    const priorities = await this.getSkillPriorities(skills, occupation, personality, budget.total);
    logger.info(`[EnhancedBotGen] AI prioritized ${priorities.length} skills`);

    // Distribute points
    const { skillsMap: finalSkills, budget: finalBudget } = SkillCalculator.distributePoints(
      skills,
      priorities.map(p => ({ skillName: p.skillName, points: p.suggestedPoints })),
      budget
    );

    logger.info(`[EnhancedBotGen] Distribution complete: ${finalBudget.used}/${finalBudget.total} points used`);
    logger.info(`[EnhancedBotGen] Remaining budget: ${finalBudget.remaining} points`);

    // Validate budget
    if (!SkillCalculator.validateBudget(finalBudget)) {
      logger.error(`[EnhancedBotGen] Budget validation FAILED: used ${finalBudget.used}, total ${finalBudget.total}`);
      throw new Error('Skill budget exceeded');
    }

    // Validate required skills
    if (!SkillCalculator.validateRequiredSkills(finalSkills, occupation.requiredSkills)) {
      logger.error(`[EnhancedBotGen] Required skills validation FAILED`);
      throw new Error('Required skills do not meet minimum threshold');
    }

    return finalSkills;
  }

  /**
   * Helper: Get AI skill prioritization
   */
  private async getSkillPriorities(
    skills: SkillsMap,
    occupation: Occupation,
    personality: { traits: string[]; values: string[]; goals: string[] },
    budget: number
  ): Promise<SkillPriority[]> {
    // Filter out required and bonus skills (already maxed)
    const requiredAndBonusSkills = [
      ...occupation.requiredSkills,
      ...occupation.bonusSkills
    ];

    const availableSkills = Object.keys(skills).filter(
      skillName => !requiredAndBonusSkills.includes(skillName)
    );

    const prompt = `You are prioritizing skill points for a Victorian London 1891 character.

OCCUPATION: ${occupation.name}${occupation.description ? `\nDescription: ${occupation.description}` : ''}

REQUIRED SKILLS (already at 40+): ${occupation.requiredSkills.join(', ')}
BONUS SKILLS (already got +30): ${occupation.bonusSkills.join(', ')}

CHARACTER PERSONALITY:
- Traits: ${personality.traits.join(', ')}
- Values: ${personality.values.join(', ')}
- Goals: ${personality.goals.join(', ')}

AVAILABLE SKILL BUDGET: ${budget} points

TASK: Prioritize 15-20 skills from the list below for point allocation.
- Each skill should get 10-30 points
- Focus on skills that align with occupation and personality
- Do NOT include required or bonus skills (already maxed)
- Total allocation should not exceed ${budget} points

AVAILABLE SKILLS:
${availableSkills.slice(0, 80).join(', ')}

Respond ONLY with valid JSON (no markdown):
{
  "priorities": [
    {
      "skillName": "exact skill name",
      "suggestedPoints": 20,
      "reason": "why this skill fits"
    }
  ]
}

Include 15-20 skills maximum.`;

    const client = claudeConfig.getClient();
    const model = claudeConfig.getModel();

    logger.info(`[EnhancedBotGen] Stage 5: Getting AI skill prioritization`);

    const response = await client.messages.create({
      model,
      max_tokens: 1536,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/, '').replace(/```\s*$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleanedText);
    const priorities: SkillPriority[] = parsed.priorities;

    // Validate and adjust points to fit budget
    const totalSuggested = priorities.reduce((sum, p) => sum + p.suggestedPoints, 0);

    if (totalSuggested > budget) {
      // Scale down proportionally
      const scaleFactor = budget / totalSuggested;
      priorities.forEach(p => {
        p.suggestedPoints = Math.floor(p.suggestedPoints * scaleFactor);
      });
      logger.warn(`[EnhancedBotGen] AI suggested ${totalSuggested} points, scaled down to fit budget`);
    }

    return priorities;
  }

  /**
   * STAGE 6: Character Assembly
   * Build complete character payload ready for game-backend
   */
  private buildCompleteCharacterPayload(
    params: BotGenerationParams,
    coreData: CoreCharacterData,
    occupation: Occupation,
    skills: SkillsMap
  ): CompleteCharacterPayload {
    logger.info(`[EnhancedBotGen] Stage 6: Assembling complete character payload`);

    const occupationRef: OccupationReference = {
      _id: occupation._id,
      name: occupation.name
    };

    const payload: CompleteCharacterPayload = {
      name: params.name,
      surname: params.surname,
      bot_id: '', // Will be set by controller after bot is created
      stats: coreData.stats,
      skills,
      occupation: occupationRef,
      background: coreData.background,
      demographics: {
        ...coreData.demographics,
        publicDescription: params.publicDescription || coreData.demographics.physicalDescription,
        privateDescription: params.privateDescription || ''
      },
      gender: params.gender,
      campaign_id: params.campaign_id
    };

    // Validate completeness
    const skillCount = Object.keys(payload.skills).length;
    const statsTotal = Object.values(payload.stats).reduce((sum, val) => sum + val, 0);

    logger.info(`[EnhancedBotGen] ✅ Character assembly complete:`);
    logger.info(`[EnhancedBotGen]   - Stats total: ${statsTotal}`);
    logger.info(`[EnhancedBotGen]   - Skills count: ${skillCount}`);
    logger.info(`[EnhancedBotGen]   - Occupation: ${payload.occupation.name}`);
    logger.info(`[EnhancedBotGen]   - Background fields: ${Object.keys(payload.background).length}`);

    return payload;
  }
}

export const enhancedBotGeneratorService = new EnhancedBotGeneratorService();
