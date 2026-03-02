import Anthropic from '@anthropic-ai/sdk';
import { claudeConfig } from '../config/claude';
import { logger } from '../utils/logger';

export interface SentimentAnalysisResult {
  sentiment: number;        // -10 (very negative) to +10 (very positive)
  trustChange: number;      // -5 (big trust loss) to +5 (big trust gain)
  emotionalImpact: number;  // 0 (neutral) to 10 (highly impactful)
  tone: string;             // e.g., "friendly", "hostile", "neutral", "flirtatious", "formal"
  reasoning: string;        // Brief explanation of the analysis
}

export class SentimentAnalysisService {
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
   * Analyzes the sentiment and emotional impact of a character's action towards the bot
   */
  async analyzeActionSentiment(
    content: string,
    characterName: string,
    botPersonality: string,
    existingRelationship?: {
      sentimentScore: number;
      trustLevel: number;
      familiarityLevel: number;
    }
  ): Promise<SentimentAnalysisResult> {
    try {
      logger.info(`[SentimentAnalysis] Analyzing action from ${characterName}`);

      const systemPrompt = this.buildSystemPrompt(botPersonality, existingRelationship);
      const userMessage = this.buildUserMessage(content, characterName);

      const response = await this.anthropic.messages.create({
        model: claudeConfig.getModel(), // Use Haiku for speed
        max_tokens: 500,
        temperature: 0.3, // Lower temperature for more consistent analysis
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

      return this.parseClaudeResponse(responseText);
    } catch (error) {
      logger.error('[SentimentAnalysis] Claude API failed, using fallback analysis', error);
      return this.fallbackSentimentAnalysis(content, characterName);
    }
  }

  /**
   * Builds the system prompt for sentiment analysis
   */
  private buildSystemPrompt(
    botPersonality: string,
    existingRelationship?: {
      sentimentScore: number;
      trustLevel: number;
      familiarityLevel: number;
    }
  ): string {
    let prompt = `You are an expert analyst of social interactions in Victorian London (1889).
Your role is to analyze how a character's action affects their relationship with another character (a bot).

Bot Personality: ${botPersonality}

`;

    if (existingRelationship) {
      prompt += `Current Relationship Status:
- Sentiment: ${existingRelationship.sentimentScore}/100 (${this.describeSentiment(existingRelationship.sentimentScore)})
- Trust: ${existingRelationship.trustLevel}/100 (${this.describeTrust(existingRelationship.trustLevel)})
- Familiarity: ${existingRelationship.familiarityLevel}/100 (${this.describeFamiliarity(existingRelationship.familiarityLevel)})

`;
    }

    prompt += `Analyze the character's action and respond with a JSON object containing:
- sentiment: number from -10 (very negative/hostile) to +10 (very positive/warm)
- trustChange: number from -5 (significant trust loss) to +5 (significant trust gain)
- emotionalImpact: number from 0 (neutral) to 10 (highly impactful/memorable)
- tone: string describing the tone (e.g., "friendly", "hostile", "neutral", "flirtatious", "formal", "threatening", "respectful")
- reasoning: brief explanation (1-2 sentences) of your analysis

Consider Victorian social norms, class distinctions, and propriety.
Respond ONLY with the JSON object, no additional text.`;

    return prompt;
  }

  /**
   * Builds the user message for analysis
   */
  private buildUserMessage(content: string, characterName: string): string {
    return `Character Name: ${characterName}
Action: "${content}"

Analyze this action's sentiment and impact.`;
  }

  /**
   * Parses Claude's JSON response
   */
  private parseClaudeResponse(responseText: string): SentimentAnalysisResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sentiment: this.clamp(parsed.sentiment || 0, -10, 10),
        trustChange: this.clamp(parsed.trustChange || 0, -5, 5),
        emotionalImpact: this.clamp(parsed.emotionalImpact || 0, 0, 10),
        tone: parsed.tone || 'neutral',
        reasoning: parsed.reasoning || 'Analysis completed'
      };
    } catch (error) {
      logger.error('[SentimentAnalysis] Failed to parse Claude response', error);
      logger.debug('[SentimentAnalysis] Raw response:', responseText);

      // Return neutral values if parsing fails
      return {
        sentiment: 0,
        trustChange: 0,
        emotionalImpact: 1,
        tone: 'neutral',
        reasoning: 'Failed to parse sentiment analysis'
      };
    }
  }

  /**
   * Fallback sentiment analysis using keyword matching
   */
  private fallbackSentimentAnalysis(content: string, characterName: string): SentimentAnalysisResult {
    logger.info('[SentimentAnalysis] Using fallback keyword matching');

    const lowerContent = content.toLowerCase();

    // Positive keywords (Italian and English)
    const positiveKeywords = [
      'buon', 'buona', 'piacer', 'gentil', 'graz', 'bell', 'magnifico',
      'eccellent', 'splendid', 'meraviglios', 'amic', 'affettuos',
      'good', 'please', 'thank', 'kind', 'wonderful', 'beautiful',
      'excellent', 'splendid', 'marvelous', 'friend', 'affection'
    ];

    // Negative keywords
    const negativeKeywords = [
      'cattiv', 'brutto', 'orribil', 'dispiace', 'scusa', 'problema',
      'difficulta', 'paura', 'timor', 'ostil', 'nemico', 'odio',
      'bad', 'ugly', 'horrible', 'sorry', 'problem', 'difficulty',
      'fear', 'hostile', 'enemy', 'hate', 'angry', 'upset'
    ];

    // Trust-building keywords
    const trustKeywords = [
      'fiducia', 'confido', 'prometto', 'giuro', 'sincero', 'onesto',
      'trust', 'confidence', 'promise', 'swear', 'sincere', 'honest'
    ];

    // Trust-breaking keywords
    const distrustKeywords = [
      'bugia', 'menzogna', 'tradimento', 'inganno', 'falso', 'sospetto',
      'lie', 'deceit', 'betray', 'deception', 'false', 'suspect'
    ];

    let sentiment = 0;
    let trustChange = 0;
    let emotionalImpact = 1;
    let tone = 'neutral';

    // Count keyword matches
    for (const keyword of positiveKeywords) {
      if (lowerContent.includes(keyword)) {
        sentiment += 2;
        emotionalImpact += 1;
      }
    }

    for (const keyword of negativeKeywords) {
      if (lowerContent.includes(keyword)) {
        sentiment -= 2;
        emotionalImpact += 1;
      }
    }

    for (const keyword of trustKeywords) {
      if (lowerContent.includes(keyword)) {
        trustChange += 1;
      }
    }

    for (const keyword of distrustKeywords) {
      if (lowerContent.includes(keyword)) {
        trustChange -= 2;
        sentiment -= 1;
      }
    }

    // Determine tone
    if (sentiment > 3) {
      tone = 'friendly';
    } else if (sentiment < -3) {
      tone = 'hostile';
    } else if (trustChange > 2) {
      tone = 'respectful';
    } else if (trustChange < -2) {
      tone = 'suspicious';
    }

    // Clamp values
    sentiment = this.clamp(sentiment, -10, 10);
    trustChange = this.clamp(trustChange, -5, 5);
    emotionalImpact = this.clamp(emotionalImpact, 0, 10);

    return {
      sentiment,
      trustChange,
      emotionalImpact,
      tone,
      reasoning: `Fallback keyword analysis: detected ${tone} tone based on language patterns`
    };
  }

  /**
   * Utility: Clamp a number between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Utility: Describe sentiment score
   */
  private describeSentiment(score: number): string {
    if (score >= 80) return 'very positive';
    if (score >= 60) return 'positive';
    if (score >= 40) return 'slightly positive';
    if (score >= -40) return 'neutral';
    if (score >= -60) return 'slightly negative';
    if (score >= -80) return 'negative';
    return 'very negative';
  }

  /**
   * Utility: Describe trust level
   */
  private describeTrust(trust: number): string {
    if (trust >= 80) return 'very high trust';
    if (trust >= 60) return 'high trust';
    if (trust >= 40) return 'moderate trust';
    if (trust >= -40) return 'low trust';
    return 'very low trust';
  }

  /**
   * Utility: Describe familiarity level
   */
  private describeFamiliarity(familiarity: number): string {
    if (familiarity >= 80) return 'very familiar';
    if (familiarity >= 60) return 'familiar';
    if (familiarity >= 40) return 'somewhat familiar';
    if (familiarity >= 20) return 'barely acquainted';
    return 'strangers';
  }
}
