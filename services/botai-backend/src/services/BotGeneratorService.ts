import { claudeConfig } from '../config/claude';
import { logger } from '../utils/logger';

export interface BotGenerationInput {
  locationId: string;
  locationName: string;
  locationDescription: string;
  description: string; // Natural language description of the bot
}

export interface BotGeneratedData {
  name: string;
  surname: string;

  // NUOVO: Assi psicologici
  psychologicalAxes: {
    rationalEmotional: number;      // -3 a +3
    controlledImpulsive: number;
    cynicalIdealist: number;
    proudSubmissive: number;
    prudentParanoid: number;
    directAllusive: number;
  };

  // NUOVO: Ferita/bisogno centrale
  centralWound: {
    wound: string;
    manifestation: string;
  };

  // NUOVO: Maschera pubblica vs verità privata
  duality: {
    publicMask: string;
    privateTruth: string;
  };

  personality: {
    traits: string[];
    coreValues: string[];
    speechPattern: string;
    emotionalRange: { min: number; max: number };
  };
  goals: {
    shortTerm: string[];
    longTerm: string[];
  };
  physicalDescription: string;
  publicDescription: string;
  privateDescription: string;
  background: any;
  activationKeywords: string[];
  tags?: string[]; // Location zone tags where bot operates
  stats: {
    strength: number;
    constitution: number;
    size: number;
    dexterity: number;
    charm: number;
    intelligence: number;
    power: number;
    education: number;
  };
  gender: string;
}

export class BotGeneratorService {
  async generateBotDetails(input: BotGenerationInput): Promise<BotGeneratedData> {
    const prompt = this.buildGenerationPrompt(input);

    const client = claudeConfig.getClient();
    const model = claudeConfig.getModel();

    logger.info(`[BotGenerator] Generating bot details for location ${input.locationName}`);
    logger.info(`[BotGenerator] Description: ${input.description}`);

    // Step 1: Generate with Haiku (fast, good quality, in English)
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      temperature: 0.9, // High creativity for variety
      system: this.getSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response (already in Italian)
    const generatedData = this.parseClaudeResponse(content.text);

    logger.info(`[BotGenerator] Successfully generated bot details for ${generatedData.name}`);

    return generatedData;
  }

  private getSystemPrompt(): string {
    return `You are a specialist in creating Non-Player Characters (NPCs) for a role-playing game set in Victorian London, 1889.

Your task is to generate complete and coherent details for a bot character based on the natural language description provided by the user.

**IMPORTANT: Generate ALL text fields in ITALIAN.** The game is played by Italian speakers, so all descriptions, traits, values, goals, backgrounds, and keywords must be in Italian.

VICTORIAN LONDON CONTEXT (1889):
- Era of Queen Victoria's Golden Jubilee, British Empire at its peak
- Stark class divisions: aristocracy, middle class, working class poor
- Jack the Ripper murders still fresh in public memory (1888)
- Industrialization, coal smoke, gas lamps, horse-drawn carriages
- Social issues: poverty, child labor, workhouses, opium dens
- Immigration (Irish, Jewish, Italian communities in East End)
- Victorian morality vs. underground vice (gin palaces, brothels, gambling)
- Occupations: dock workers, factory workers, servants, street vendors, prostitutes, clerks, shopkeepers, constables, etc.

IMPORTANT CHARACTER AUTHENTICITY:
- Characters must feel genuine to 1889 London
- Speech patterns reflect class (cockney for lower class, formal English for upper class)
- Personality traits should be distinctive and memorable
- Goals must be realistic for the era and social class
- Physical descriptions must include period-appropriate clothing
- Stats should reflect the character (old = low constitution, wealthy = high education, laborer = high strength, etc.)
- Activation keywords should be words a player would naturally use when talking to this type of character

PSYCHOLOGICAL DEPTH (NEW REQUIREMENT):
Every character must have a complete psychological profile:

1. **Psychological Axes** (-3 to +3 scale):
   - rationalEmotional: -3 (purely rational/logical) → +3 (purely emotional/passionate)
   - controlledImpulsive: -3 (extremely controlled) → +3 (extremely impulsive)
   - cynicalIdealist: -3 (deeply cynical) → +3 (deeply idealistic)
   - proudSubmissive: -3 (very proud/arrogant) → +3 (very submissive/humble)
   - prudentParanoid: -3 (prudent/cautious) → +3 (paranoid/fearful)
   - directAllusive: -3 (very direct/blunt) → +3 (very allusive/indirect)

2. **Central Wound**: Every character has a core psychological wound or need that drives them.
   Examples: "Fear of abandonment", "Hunger for recognition", "Guilt over past failure", "Need for control", "Shame of poverty"

3. **Public Mask vs Private Truth**: What they show publicly vs. who they really are.
   - Public Mask: How they present themselves to the world
   - Private Truth: Their hidden self, insecurities, true desires

RESPONSE FORMAT:
You must respond ONLY with a valid JSON object, without markdown or other text. The JSON must have this structure:

{
  "name": "first name",
  "surname": "last name",
  "gender": "male" or "female",
  "psychologicalAxes": {
    "rationalEmotional": 1,
    "controlledImpulsive": -2,
    "cynicalIdealist": 0,
    "proudSubmissive": -1,
    "prudentParanoid": 2,
    "directAllusive": -2
  },
  "centralWound": {
    "wound": "Deep psychological wound or core need",
    "manifestation": "How this manifests in their behavior and choices"
  },
  "duality": {
    "publicMask": "What they show to the world (200 char max)",
    "privateTruth": "Who they really are underneath (200 char max)"
  },
  "personality": {
    "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
    "coreValues": ["value1", "value2", "value3"],
    "speechPattern": "detailed description of how they speak, accent, mannerisms",
    "emotionalRange": { "min": -7, "max": 8 }
  },
  "goals": {
    "shortTerm": ["concrete short-term goal 1", "goal 2", "goal 3"],
    "longTerm": ["long-term aspiration 1", "aspiration 2"]
  },
  "physicalDescription": "detailed physical description (MAX 800 CHARACTERS): appearance, clothing, scars, posture, distinctive features, mannerisms",
  "publicDescription": "brief public description (2-3 sentences, MAX 200 CHARACTERS) that other players will see",
  "privateDescription": "private notes on the character (hidden motivations, secrets, inner conflicts, MAX 300 CHARACTERS)",
  "background": {
    "briefHistory": "character history (childhood, key events, how they came to be who they are)",
    "occupation": "current occupation",
    "socialClass": "working class / middle class / upper class"
  },
  "activationKeywords": ["keyword1", "keyword2", "phrase", "nickname"],
  "tags": ["bancone"] or ["tavolo", "bancone"] or [] (array of location zone strings where bot operates),
  "stats": {
    "strength": 50,
    "constitution": 50,
    "size": 50,
    "dexterity": 50,
    "charm": 50,
    "intelligence": 50,
    "power": 50,
    "education": 50
  }
}

CRITICAL RULES FOR STATS:
- Stats MUST be simple numeric values between 1-100 (e.g., 50, 75, 30)
- Stats MUST NOT contain formulas, calculations, or references to other stats
- WRONG: "power", "FLOOR(power/5)", "constitution + size"
- CORRECT: 50, 75, 30
- Average value is 50, adjust based on character traits

CRITICAL RULES FOR TEXT FIELDS:
- physicalDescription: MAX 800 characters
- publicDescription: MAX 200 characters
- privateDescription: MAX 300 characters

IMPORTANT - LOCATION TAGS:
Based on the character's role and occupation, determine which ZONES within the location they operate in.

Common location zone tags:
- "bancone" → bartenders, servers at the bar
- "tavolo" → customers seated at tables
- "ingresso" → doormen, guards at entrance
- "bagno" → cleaners, attendants
- "cucina" → cooks, kitchen staff
- "sala" → general hall/room area
- ["tavolo", "bancone"] → regular customers who move between areas

Rules for tag assignment:
- Bartenders/servers usually stay at "bancone"
- Regular customers can have ["tavolo", "bancone"] (moves around)
- Mysterious strangers often just ["tavolo"] (seated, doesn't move much)
- Doormen/guards have ["ingresso"]
- If the character can operate anywhere, use empty array []

Include the "tags" field in your JSON response as an array of strings.`;
  }

  private buildGenerationPrompt(input: BotGenerationInput): string {
    return `Generate complete details for this NPC character:

DESCRIPTION: ${input.description}

LOCATION CONTEXT:
- Name: ${input.locationName}
- Description: ${input.locationDescription}

The character must be consistent with this location and the provided description.

Create an authentic, memorable character suited to the Victorian era (London 1889).

**REMEMBER: All text fields (traits, values, descriptions, goals, keywords) must be in ITALIAN.**

Respond ONLY with the JSON (no markdown, no additional text).`;
  }

  private async translateToItalian(data: BotGeneratedData, context: BotGenerationInput): Promise<BotGeneratedData> {
    const client = claudeConfig.getClient();

    const translationPrompt = `You are translating NPC character data from English to Italian for a Victorian London 1889 role-playing game.

CONTEXT:
- Location: ${context.locationName}
- Original Description: ${context.description}

ORIGINAL DATA (English):
${JSON.stringify({
  traits: data.personality.traits,
  coreValues: data.personality.coreValues,
  goals: data.goals,
  physicalDescription: data.physicalDescription,
  publicDescription: data.publicDescription,
  privateDescription: data.privateDescription,
  background: data.background,
  activationKeywords: data.activationKeywords
}, null, 2)}

Translate the following fields to Italian, maintaining the Victorian London context and atmosphere:
- personality.traits (array of 3-5 trait words, each max 30 characters)
- personality.coreValues (array of 2-4 value words, each max 30 characters)
- goals.shortTerm (array of 2-4 goal phrases, each max 200 characters)
- goals.longTerm (array of 1-3 aspiration phrases, each max 200 characters)
- physicalDescription (MUST be max 1000 characters - condense if needed while keeping key details)
- publicDescription (max 500 characters - 2-3 sentences)
- privateDescription (max 1000 characters)
- background.briefHistory (max 2000 characters)
- background.occupation (max 100 characters)
- activationKeywords (array of 5-12 keywords/phrases, each max 50 characters)

CRITICAL REQUIREMENTS:
- physicalDescription MUST NOT exceed 1000 characters (hard limit)
- If the English text is too long, condense it intelligently while preserving key Victorian details
- Keep the Victorian atmosphere and period-appropriate language
- Translate naturally, not word-by-word
- activationKeywords should be what Italian players would naturally say to talk to this character
- Maintain the character's personality and tone

Respond ONLY with a JSON object containing the translated fields:
{
  "traits": ["trait1", "trait2", ...],
  "coreValues": ["value1", "value2", ...],
  "shortTermGoals": ["goal1", "goal2", ...],
  "longTermGoals": ["goal1", "goal2"],
  "physicalDescription": "...",
  "publicDescription": "...",
  "privateDescription": "...",
  "briefHistory": "...",
  "occupation": "...",
  "activationKeywords": ["keyword1", "keyword2", ...]
}`;

    logger.info(`[BotGenerator] Translating to Italian with Sonnet...`);

    const response = await client.messages.create({
      model: claudeConfig.getTranslateModel(),
      max_tokens: 2048,
      temperature: 0.3, // Lower temperature for more accurate translation
      messages: [
        {
          role: 'user',
          content: translationPrompt
        }
      ]
    });

    const translationContent = response.content[0];
    if (translationContent.type !== 'text') {
      throw new Error('Unexpected response type from translation');
    }

    // Parse translation
    let cleanedText = translationContent.text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/, '').replace(/```\s*$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/, '').replace(/```\s*$/, '');
    }

    const translated = JSON.parse(cleanedText);

    // Debug: log translated data
    logger.info(`[BotGenerator] Translation result - traits: ${JSON.stringify(translated.traits)}`);
    logger.info(`[BotGenerator] Translation result - goals: ${JSON.stringify(translated.shortTermGoals?.slice(0, 2))}`);

    // Merge translated data back into original structure
    return {
      ...data,
      personality: {
        ...data.personality,
        traits: translated.traits,
        coreValues: translated.coreValues
      },
      goals: {
        shortTerm: translated.shortTermGoals,
        longTerm: translated.longTermGoals
      },
      physicalDescription: translated.physicalDescription,
      publicDescription: translated.publicDescription,
      privateDescription: translated.privateDescription,
      background: {
        ...data.background,
        briefHistory: translated.briefHistory,
        occupation: translated.occupation
      },
      activationKeywords: translated.activationKeywords
    };
  }

  private parseClaudeResponse(responseText: string): BotGeneratedData {
    try {
      // Remove markdown backticks if present
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/```json\n?/, '').replace(/```\s*$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```\n?/, '').replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanedText);

      // Validate required fields
      if (!parsed.name || !parsed.personality || !parsed.goals || !parsed.physicalDescription) {
        throw new Error('Missing required fields in generated data');
      }

      // Set defaults
      parsed.surname = parsed.surname || '';
      parsed.gender = parsed.gender || 'male';

      return parsed as BotGeneratedData;
    } catch (error) {
      logger.error('[BotGenerator] Failed to parse Claude response:', error);
      logger.error('[BotGenerator] Raw response:', responseText);
      throw new Error('Failed to parse bot generation response');
    }
  }
}

export const botGeneratorService = new BotGeneratorService();
