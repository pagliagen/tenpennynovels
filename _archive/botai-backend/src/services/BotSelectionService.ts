import Anthropic from '@anthropic-ai/sdk';
import { claudeConfig } from '../config/claude';
import { logger } from '../utils/logger';

// ============================================================
// Interfaces
// ============================================================

export interface BotSelectionResult {
  selectedBot: any;           // Bot document
  selectedTag: string;        // Tag/zone to lock to
  confidence: number;         // 0-100
  reasoning: string;          // AI explanation
  shouldRespond: boolean;     // Whether bot should respond
}

export interface MultiTagActionContext {
  sessionId: string;
  locationId: string;
  locationName: string;
  recentActionsByTag: {
    tag: string;
    actions: Array<{
      characterId: string;
      characterName: string;
      content: string;
      timestamp: Date;
      actionId: string;
    }>;
  }[];
  availableBots: Array<{
    botId: string;
    name: string;
    surname?: string;
    personality: any;
    goals: any;
    tags: string[];
    currentEmotionalState: any;
    publicDescription?: string;
  }>;
  existingAssignments: { [tag: string]: string }; // tag -> botId
}

export interface ShouldRespondResult {
  shouldRespond: boolean;
  reasoning: string;
  confidence: number;
}

// ============================================================
// Bot Selection Service
// ============================================================

export class BotSelectionService {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({
      apiKey
    });
  }

  /**
   * AI-powered bot selection for first activation in session
   * Analyzes all recent actions across tags and selects best bot + tag
   */
  async selectBotForFirstActivation(
    context: MultiTagActionContext
  ): Promise<BotSelectionResult | null> {
    try {
      logger.info('[BotSelection] Analyzing multi-tag context for bot selection');
      logger.info(`[BotSelection]   Total tags with recent actions: ${context.recentActionsByTag.length}`);
      logger.info(`[BotSelection]   Tags: ${context.recentActionsByTag.map(t => t.tag).join(', ')}`);
      logger.info(`[BotSelection]   Existing assignments: ${JSON.stringify(context.existingAssignments)}`);
      logger.info(`[BotSelection]   Available bots: ${context.availableBots.length}`);

      // Filter only bots with no existing assignments
      const unassignedTags = context.recentActionsByTag.filter(
        tagGroup => !context.existingAssignments[tagGroup.tag]
      );

      logger.info(`[BotSelection]   Unassigned tags: ${unassignedTags.length}`);
      if (unassignedTags.length > 0) {
        logger.info(`[BotSelection]   Unassigned: ${unassignedTags.map(t => t.tag).join(', ')}`);
      }

      if (unassignedTags.length === 0) {
        logger.info('[BotSelection] All tags already have assigned bots - no new selection needed');
        return null;
      }

      const systemPrompt = this.buildSelectionSystemPrompt();
      const userMessage = this.buildSelectionUserMessage(context, unassignedTags);

      const startTime = Date.now();
      const response = await this.anthropic.messages.create({
        model: claudeConfig.getModel(), // Haiku for speed
        max_tokens: 750,
        temperature: 0.4, // Balanced for consistency and creativity
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      const latency = (Date.now() - startTime) / 1000;

      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      const result = this.parseSelectionResponse(responseText, context);

      if (result) {
        logger.info(`[BotSelection] AI selected bot ${result.selectedBot.name} for tag "${result.selectedTag}"`, {
          confidence: result.confidence,
          reasoning: result.reasoning,
          latency
        });
      } else {
        logger.warn('[BotSelection] AI did not select any bot (low confidence or invalid response)');
      }

      return result;

    } catch (error) {
      logger.error('[BotSelection] Claude API failed during bot selection', error);
      return this.fallbackSelection(context);
    }
  }

  /**
   * AI-powered decision: should locked bot respond to this action?
   * Replaces keyword-based shouldBotRespond logic
   */
  async shouldLockedBotRespond(
    bot: any,
    actionData: any,
    recentContextActions: any[]
  ): Promise<ShouldRespondResult> {
    try {
      logger.debug(`[BotSelection] Checking if bot ${bot.name} should respond to action`);

      const systemPrompt = this.buildShouldRespondSystemPrompt(bot);
      const userMessage = this.buildShouldRespondUserMessage(actionData, recentContextActions);

      const response = await this.anthropic.messages.create({
        model: claudeConfig.getModel(), // Haiku for speed
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for consistent decisions
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      const responseText = response.content[0].type === 'text'
        ? response.content[0].text
        : '';

      return this.parseShouldRespondResponse(responseText);

    } catch (error) {
      logger.error('[BotSelection] Claude API failed during shouldRespond check', error);
      // Fallback: respond if action seems relevant
      return {
        shouldRespond: true,
        reasoning: 'API failed, defaulting to respond',
        confidence: 40
      };
    }
  }

  // ============================================================
  // Prompt Building - Bot Selection
  // ============================================================

  private buildSelectionSystemPrompt(): string {
    return `You are a game master assistant for a Victorian London RPG (1889).
Your role is to intelligently select which NPC bot should activate and in which zone/tag they should interact.

RULES:
1. Bots can ONLY operate in zones (tags) that match their role/tags
2. Select the bot whose personality and goals best fit the recent actions in a specific zone
3. Consider Victorian social norms, class distinctions, and character roles
4. Only select if confidence is >60% (otherwise respond with shouldRespond: false)

RESPOND WITH JSON ONLY:
{
  "selectedBotId": "bot_id_here",
  "selectedTag": "tag_name",
  "confidence": 85,
  "shouldRespond": true,
  "reasoning": "Brief explanation of why this bot is most suitable for this tag"
}

If no bot is suitable or confidence <60%, respond:
{
  "selectedBotId": null,
  "selectedTag": null,
  "confidence": 0,
  "shouldRespond": false,
  "reasoning": "Explanation of why no bot is suitable"
}`;
  }

  private buildSelectionUserMessage(
    context: MultiTagActionContext,
    unassignedTags: MultiTagActionContext['recentActionsByTag']
  ): string {
    let message = `LOCATION: ${context.locationName}\nSESSION: ${context.sessionId}\n\n`;

    // Recent actions by tag
    message += 'RECENT ACTIONS BY ZONE/TAG:\n\n';
    for (const tagGroup of unassignedTags) {
      message += `Zone "${tagGroup.tag}":\n`;
      for (const action of tagGroup.actions.slice(-5)) {
        const timeAgo = this.getTimeAgo(action.timestamp);
        message += `- ${action.characterName}: "${action.content}" (${timeAgo})\n`;
      }
      message += '\n';
    }

    // Available bots
    message += 'AVAILABLE BOTS:\n\n';
    for (let i = 0; i < context.availableBots.length; i++) {
      const bot = context.availableBots[i];
      message += `${i + 1}. ${bot.name}${bot.surname ? ' ' + bot.surname : ''}\n`;
      message += `   Bot ID: ${bot.botId}\n`;
      message += `   Role: ${bot.publicDescription || 'NPC'}\n`;
      message += `   Tags/Zones: [${bot.tags.join(', ')}]\n`;
      message += `   Personality: ${JSON.stringify(bot.personality.traits).substring(0, 100)}...\n`;
      message += `   Goals: ${JSON.stringify(bot.goals.shortTerm).substring(0, 80)}...\n`;
      message += `   Mood: ${bot.currentEmotionalState.mood} (${bot.currentEmotionalState.intensity}/10)\n\n`;
    }

    message += 'TASK: Select which bot should respond and to which zone/tag. Consider bot role fit and personality alignment.';

    return message;
  }

  // ============================================================
  // Prompt Building - Should Respond Check
  // ============================================================

  private buildShouldRespondSystemPrompt(bot: any): string {
    return `You are analyzing whether a Victorian London NPC should respond to a player action.

BOT PROFILE:
Name: ${bot.name}${bot.surname ? ' ' + bot.surname : ''}
Role: ${bot.publicDescription || 'NPC'}
Personality: ${JSON.stringify(bot.personality.traits)}
Goals: ${JSON.stringify(bot.goals.shortTerm)}
Current Mood: ${bot.currentEmotionalState.mood} (${bot.currentEmotionalState.intensity}/10)

DECISION CRITERIA:
1. Is the action directed at this bot (mentions name, role, or relevant to bot's zone)?
2. Does the action relate to bot's goals or personality?
3. Would it be natural for this bot to respond based on their character?
4. Is the action significant enough to warrant a response?

RESPOND WITH JSON ONLY:
{
  "shouldRespond": true/false,
  "reasoning": "Brief explanation of why bot should/shouldn't respond",
  "confidence": 0-100
}`;
  }

  private buildShouldRespondUserMessage(
    actionData: any,
    recentContextActions: any[]
  ): string {
    let message = `TRIGGERING ACTION:\n`;
    message += `Character: ${actionData.characterName}\n`;
    message += `Content: "${actionData.content}"\n`;
    message += `Tag/Zone: ${actionData.tags || 'default'}\n\n`;

    if (recentContextActions && recentContextActions.length > 0) {
      message += 'RECENT CONTEXT (last 5 actions in bot\'s zone):\n';
      for (const action of recentContextActions.slice(-5)) {
        const timeAgo = this.getTimeAgo(action.timestamp);
        message += `- ${action.characterName}: "${action.content}" (${timeAgo})\n`;
      }
      message += '\n';
    }

    message += 'Should this bot respond to the triggering action?';

    return message;
  }

  // ============================================================
  // Response Parsing
  // ============================================================

  private parseSelectionResponse(
    responseText: string,
    context: MultiTagActionContext
  ): BotSelectionResult | null {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('[BotSelection] No JSON found in Claude response');
        return this.fallbackSelection(context);
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate response
      if (!parsed.shouldRespond || parsed.confidence < 60 || !parsed.selectedBotId) {
        logger.info('[BotSelection] AI confidence too low or no bot selected', {
          confidence: parsed.confidence,
          reasoning: parsed.reasoning
        });
        return null;
      }

      // Find the selected bot
      const selectedBot = context.availableBots.find(
        b => b.botId === parsed.selectedBotId
      );

      if (!selectedBot) {
        logger.warn('[BotSelection] Selected bot not found in available bots', {
          selectedBotId: parsed.selectedBotId
        });
        return this.fallbackSelection(context);
      }

      return {
        selectedBot,
        selectedTag: parsed.selectedTag,
        confidence: this.clamp(parsed.confidence, 0, 100),
        reasoning: parsed.reasoning || 'AI selection completed',
        shouldRespond: true
      };

    } catch (error) {
      logger.error('[BotSelection] Failed to parse selection response', error);
      logger.debug('[BotSelection] Raw response:', responseText);
      return this.fallbackSelection(context);
    }
  }

  private parseShouldRespondResponse(responseText: string): ShouldRespondResult {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        shouldRespond: parsed.shouldRespond === true,
        reasoning: parsed.reasoning || 'AI decision completed',
        confidence: this.clamp(parsed.confidence || 50, 0, 100)
      };

    } catch (error) {
      logger.error('[BotSelection] Failed to parse shouldRespond response', error);
      logger.debug('[BotSelection] Raw response:', responseText);

      // Default: respond if parsing fails
      return {
        shouldRespond: true,
        reasoning: 'Failed to parse AI response, defaulting to respond',
        confidence: 40
      };
    }
  }

  // ============================================================
  // Fallback Logic
  // ============================================================

  private fallbackSelection(context: MultiTagActionContext): BotSelectionResult | null {
    logger.warn('[BotSelection] Using fallback heuristic selection');

    // Find tag with most recent action
    const sortedTags = context.recentActionsByTag
      .filter(tagGroup => !context.existingAssignments[tagGroup.tag])
      .filter(tagGroup => tagGroup.actions.length > 0)
      .sort((a, b) => {
        const aTime = new Date(a.actions[0].timestamp).getTime();
        const bTime = new Date(b.actions[0].timestamp).getTime();
        return bTime - aTime;
      });

    if (sortedTags.length === 0) {
      logger.info('[BotSelection] No unassigned tags with actions');
      return null;
    }

    const mostRecentTag = sortedTags[0];

    // Filter bots that can operate in this tag
    const eligibleBots = context.availableBots.filter(bot =>
      bot.tags.length === 0 || bot.tags.includes(mostRecentTag.tag)
    );

    if (eligibleBots.length === 0) {
      logger.warn('[BotSelection] No eligible bots for tag:', mostRecentTag.tag);
      return null;
    }

    // Simple scoring: prefer first eligible bot (can be enhanced)
    const selectedBot = eligibleBots[0];

    return {
      selectedBot,
      selectedTag: mostRecentTag.tag,
      confidence: 50, // Low confidence for fallback
      reasoning: `Fallback: Selected ${selectedBot.name} for tag "${mostRecentTag.tag}" based on tag compatibility`,
      shouldRespond: true
    };
  }

  // ============================================================
  // Utilities
  // ============================================================

  private getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

export const botSelectionService = new BotSelectionService();
