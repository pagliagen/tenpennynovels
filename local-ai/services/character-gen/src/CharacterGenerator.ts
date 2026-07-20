import * as https from 'https';
import * as http from 'http';
import { createLogger } from '../../../shared/logger';
import { CharacterGenInput, CharacterGenResult, GeneratedStats, GeneratedBackground, GeneratedSkill } from './types';
import { allocateStats } from './StatAllocator';
import { allocateSkills, allocateSkillsWithOccupation } from './SkillAllocator';
import {
  buildNarrativePrompt,
  buildBasicInfoPrompt,
  buildOccupationPrompt,
  buildBackgroundPrompt,
  buildBriefHistoryPrompt,
  buildSignificantEventsPrompt,
  buildImportantRelationshipsPrompt,
  buildPersonalityPrompt,
  buildIdeologyPrompt,
  buildSignificantPlacesPrompt,
  buildFearsAndPhobiasPrompt,
  buildSecretsPrompt,
  buildGoalsAndMotivationsPrompt,
  buildDescriptionsAndMarksPrompt,
  buildSkillsPrompt,
  buildStatsAllocationPrompt
} from './PromptBuilder';

const logger = createLogger('CharacterGenerator');

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const NAME_CHECK_TIMEOUT_MS = 3000;
const REFERENCE_YEAR = 1895; // Victorian setting reference year for age calculations

type AIProvider = 'inception' | 'ollama';

interface LLMResponse {
  text: string;
  tokensUsed: number;
}

// === Abort helpers ===
export function makeAbortError(): Error {
  const e = new Error('ABORTED');
  e.name = 'AbortError';
  return e;
}

export function isAbortError(err: any): boolean {
  return err?.name === 'AbortError' || err?.code === 'ABORT_ERR';
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw makeAbortError();
}

// === Provider resolution ===
function resolveProvider(): AIProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'inception' || explicit === 'ollama') {
    return explicit;
  }
  return 'ollama';
}

// === LLM requests with AbortSignal ===
function ollamaRequest(
  host: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  temperature: number,
  signal: AbortSignal
): Promise<LLMResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(makeAbortError()); return; }

    const payload = JSON.stringify({
      model,
      stream: false,
      keep_alive: -1,
      options: { temperature, num_predict: maxTokens },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });
    const url = new URL('/api/chat', host);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout: REQUEST_TIMEOUT_MS,
        signal,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Ollama ${res.statusCode}: ${data.substring(0, 300)}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.message?.content ?? '';
            const tokensUsed = (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0);
            resolve({ text, tokensUsed });
          } catch { reject(new Error(`Invalid JSON from Ollama: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', (err: any) => {
      if (isAbortError(err)) reject(makeAbortError());
      else reject(new Error(`Ollama connection error: ${err.message}`));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(payload);
    req.end();
  });
}

function inceptionRequest(
  apiKey: string,
  model: string,
  body: Record<string, unknown>,
  signal: AbortSignal
): Promise<LLMResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(makeAbortError()); return; }

    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.inceptionlabs.ai',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: REQUEST_TIMEOUT_MS,
        signal,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Inception ${res.statusCode}: ${data.substring(0, 300)}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.message?.content ?? '';
            const usage = parsed.usage || {};
            const tokensUsed = usage.total_tokens ?? ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));
            resolve({ text, tokensUsed });
          } catch { reject(new Error(`Invalid JSON from Inception: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', (err: any) => {
      if (isAbortError(err)) reject(makeAbortError());
      else reject(new Error(`Inception connection error: ${err.message}`));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Inception timeout')); });
    req.write(payload);
    req.end();
  });
}
 
export class CharacterGenerator {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;
  private ollamaHost: string;

  constructor() {
    this.provider = resolveProvider();
    this.ollamaHost = process.env.OLLAMA_URL || 'http://localhost:11434';

    if (this.provider === 'inception') {
      this.apiKey = process.env.INCEPTION_API_KEY || '';
      this.model = process.env.INCEPTION_MODEL || 'mercury-2';
      if (!this.apiKey) throw new Error('INCEPTION_API_KEY is not set');
    } else {
      this.apiKey = '';
      this.model = process.env.OLLAMA_ANALYTICAL_MODEL || process.env.OLLAMA_MODEL || 'hermes3:8b';
    }
  }

  private async llmRequest(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
    temperature: number,
    signal: AbortSignal
  ): Promise<LLMResponse> {
    logger.info('🤖 [LLM Request]', {
      provider: this.provider,
      model: this.model,
      temperature,
      maxTokens,
      systemPromptLength: systemPrompt.length,
      userMessageLength: userMessage.length,
    });

    let response: LLMResponse;
    if (this.provider === 'inception') {
      response = await inceptionRequest(this.apiKey, this.model, {
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }, signal);
    } else {
      response = await ollamaRequest(this.ollamaHost, this.model, 'REGOLA IMPORTANTE: Rispondi sempre in italiano. ' + systemPrompt, userMessage, maxTokens, temperature, signal);
    }

    logger.info('✅ LLM Response received', {
      tokensUsed: response.tokensUsed,
      textLength: response.text.length,
      textPreview: response.text.substring(0, 200),
    }); 

    return response;
  }

  async run(
    input: CharacterGenInput,
    gameConfig: any,
    signal: AbortSignal,
    emit: (type: string, data: any) => void,
    resumeFromStep?: number,
    previousData?: any,
    approvalPromise?: Promise<void>
  ): Promise<CharacterGenResult> {
    if (!gameConfig) {
      throw new Error('VALIDATION ERROR: gameConfig is required');
    }
    if (!gameConfig.skills || gameConfig.skills.length === 0) {
      throw new Error('VALIDATION ERROR: gameConfig.skills is required (must have at least 1 skill)');
    }
    if (!gameConfig.occupations || gameConfig.occupations.length === 0) {
      throw new Error('VALIDATION ERROR: gameConfig.occupations is required (must have at least 1 occupation)');
    }
    if (typeof gameConfig.statsBudget !== 'number' || gameConfig.statsBudget <= 0) {
      throw new Error(`VALIDATION ERROR: gameConfig.statsBudget must be a positive number, got ${gameConfig.statsBudget}`);
    }
    if (typeof gameConfig.skillsBudget !== 'number' || gameConfig.skillsBudget <= 0) {
      throw new Error(`VALIDATION ERROR: gameConfig.skillsBudget must be a positive number, got ${gameConfig.skillsBudget}`);
    }

    const statsBudget = gameConfig.statsBudget;
    const skillsBudget = gameConfig.skillsBudget;
    const occupations = gameConfig.occupations;
    const requestId = input.requestId;
    const startStep = resumeFromStep || 1;

    const partialCharacter: any = previousData ? { ...previousData } : {};

    let charFirstName = input.firstName || previousData?.firstName || '[Name to be generated]';
    let charLastName = input.lastName || previousData?.lastName || '[Surname to be generated]';
    const charGender = input.gender || previousData?.gender || 'not specified';

    // Store gender in partialCharacter so it's returned to frontend
    partialCharacter.gender = charGender;

    logger.info(`Generating character: ${charFirstName} ${charLastName} (provider: ${this.provider}, resumeFrom: ${startStep})`);

    // STEP 1: Generate narrative text only
    if (startStep <= 1) {
      checkAbort(signal);
      logger.info('📖 STEP 1: Generating narrative text...');
      emit('step', { step: 1, message: 'Generating narrative text...', status: 'start' });
      const narrativePrompt = buildNarrativePrompt(
        { firstName: charFirstName, lastName: charLastName, gender: charGender, description: input.description },
        occupations
      );
      const narrativeRes = await this.llmRequest(narrativePrompt.system, narrativePrompt.user, 2000, 0.8, signal);
      partialCharacter.narrativeText = narrativeRes.text;
      emit('step', { step: 1, message: 'Narrative text generated', status: 'complete', partialCharacter });

      if (approvalPromise) {
        logger.info(`Step 1: Waiting for approval before continuing to Step 2`);
        await approvalPromise;
        logger.info(`Step 1: Approved, continuing to Step 2`);
      }
    } else {
      logger.info(`Step 1: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 1, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 2: Extract basic info (ONLY basic fields, NO descriptions)
    if (startStep <= 2) {
      checkAbort(signal);
      logger.info('👤 STEP 2: Extracting basic info...');
      emit('step', { step: 2, message: 'Extracting basic info...', status: 'start' });
      const narrativeText = partialCharacter.narrativeText || '';
      const basicInfoPrompt = buildBasicInfoPrompt(narrativeText);
      logger.info('📝 STEP 2: Full prompt being sent to LLM', {
        systemLength: basicInfoPrompt.system.length,
        userLength: basicInfoPrompt.user.length,
        narrativeIncluded: basicInfoPrompt.user.includes('Narrazione:'),
        narrativeLength: narrativeText.length,
        fullUserPrompt: basicInfoPrompt.user  // FULL UNTRUNCATED
      });
      const basicInfoRes = await this.llmRequest(basicInfoPrompt.system, basicInfoPrompt.user, 1200, 0.5, signal);

      const basicInfo = parseTextualBasicInfo(basicInfoRes.text);
      if (basicInfo.firstName && basicInfo.firstName !== '[Name to be generated]') {
        charFirstName = basicInfo.firstName;
      }
      if (basicInfo.lastName && basicInfo.lastName !== '[Surname to be generated]') {
        charLastName = basicInfo.lastName;
      }

      Object.assign(partialCharacter, basicInfo);
      emit('step', { step: 2, message: 'Basic info extracted', status: 'complete', partialCharacter });
    } else {
      logger.info(`Step 2: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 2, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 3: Select occupation (AI chooses based on narrative + basic info)
    if (startStep <= 3) {
      checkAbort(signal);
      emit('step', { step: 3, message: 'Selecting occupation...', status: 'start' });
      const narrativeText = partialCharacter.narrativeText || '';
      const basicInfo = partialCharacter;

      const occupationPrompt = buildOccupationPrompt(
        {
          firstName: charFirstName,
          lastName: charLastName,
          narrativeText,
          basicInfo
        },
        occupations
      );

      const occupationRes = await this.llmRequest(occupationPrompt.system, occupationPrompt.user, 100, 0.5, signal);

      // Parse occupation selection
      const availableOccupationNames = occupations.map((o: any) => o.name);
      logger.info('STEP 3 Parsing context:', {
        responseText: occupationRes.text,
        responseLength: occupationRes.text.length,
        responseIsEmpty: occupationRes.text.trim().length === 0,
        availableOccupations: availableOccupationNames.slice(0, 10) + '...'
      });

      const occupationMatch = parseOccupationSelection(occupationRes.text, occupations);
      if (occupationMatch) {
        partialCharacter.selectedOccupation = {
          occupationId: occupationMatch.occupationId,
          occupationName: occupationMatch.occupationName
        };
        logger.info(`✅ Step 3: Occupation confirmed: ${occupationMatch.occupationName}`);
        emit('step', { step: 3, message: `Occupation selected: ${occupationMatch.occupationName}`, status: 'complete', partialCharacter });
      } else {
        logger.error(`❌ STEP 3 CRITICAL: Failed to parse occupation from LLM response!`, {
          llmResponse: occupationRes.text,
          responseLength: occupationRes.text.length,
          availableOccupations: availableOccupationNames,
        });
        throw new Error(`STEP 3: Occupation parsing failed - LLM response was empty or unrecognized: "${occupationRes.text}"`);
      }
    } else {
      logger.info(`Step 3: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 3, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 4: Generate background (5 SEPARATE requests - one per section)
    if (startStep <= 4) {
      checkAbort(signal);
      logger.info('📖 STEP 4: Generating background (5 sections)...');
      emit('step', { step: 4, message: 'Generating background...', status: 'start' });
      const narrativeText = partialCharacter.narrativeText || '';
      const basicInfo = partialCharacter;

      // 4.1: Brief History
      logger.info('📖 STEP 4.1: Brief History...');
      const briefHistoryPrompt = buildBriefHistoryPrompt(charFirstName, charLastName, narrativeText, basicInfo);
      const briefHistoryRes = await this.llmRequest(briefHistoryPrompt.system, briefHistoryPrompt.user, 1500, 0.7, signal);
      partialCharacter.briefHistory = briefHistoryRes.text.trim();
      logger.debug('STEP 4.1 Generated:', { length: partialCharacter.briefHistory.length });
      emit('step', { step: 4.1, message: 'Brief history generated', status: 'complete', partialCharacter });

      // 4.2: Significant Events
      checkAbort(signal);
      logger.info('📖 STEP 4.2: Significant Events...');
      const eventsPrompt = buildSignificantEventsPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const eventsRes = await this.llmRequest(eventsPrompt.system, eventsPrompt.user, 1000, 0.7, signal);
      partialCharacter.significantEvents = eventsRes.text.trim();
      logger.debug('STEP 4.2 Generated:', { length: partialCharacter.significantEvents.length });
      emit('step', { step: 4.2, message: 'Significant events generated', status: 'complete', partialCharacter });

      // 4.3: Important Relationships
      checkAbort(signal);
      logger.info('📖 STEP 4.3: Important Relationships...');
      const relationsPrompt = buildImportantRelationshipsPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const relationsRes = await this.llmRequest(relationsPrompt.system, relationsPrompt.user, 1500, 0.7, signal);
      partialCharacter.importantRelationships = relationsRes.text.trim();
      logger.debug('STEP 4.3 Generated:', { length: partialCharacter.importantRelationships.length });
      emit('step', { step: 4.3, message: 'Important relationships generated', status: 'complete', partialCharacter });

      // 4.4: Personality
      checkAbort(signal);
      logger.info('📖 STEP 4.4: Personality...');
      const personalityPrompt = buildPersonalityPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const personalityRes = await this.llmRequest(personalityPrompt.system, personalityPrompt.user, 1500, 0.7, signal);
      partialCharacter.personality = personalityRes.text.trim();
      logger.debug('STEP 4.4 Generated:', { length: partialCharacter.personality.length });
      emit('step', { step: 4.4, message: 'Personality generated', status: 'complete', partialCharacter });

      // 4.5: Ideology
      checkAbort(signal);
      logger.info('📖 STEP 4.5: Ideology/Credo...');
      const ideologyPrompt = buildIdeologyPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const ideologyRes = await this.llmRequest(ideologyPrompt.system, ideologyPrompt.user, 1500, 0.7, signal);
      partialCharacter.ideology = ideologyRes.text.trim();
      logger.debug('STEP 4.5 Generated:', { length: partialCharacter.ideology.length });
      emit('step', { step: 4.5, message: 'Ideology/Credo generated', status: 'complete', partialCharacter });

      // 4.6: Significant Places
      checkAbort(signal);
      logger.info('📖 STEP 4.6: Significant Places...');
      const placesPrompt = buildSignificantPlacesPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const placesRes = await this.llmRequest(placesPrompt.system, placesPrompt.user, 1000, 0.7, signal);
      partialCharacter.significantPlaces = placesRes.text.trim();
      logger.debug('STEP 4.6 Generated:', { length: partialCharacter.significantPlaces.length });
      emit('step', { step: 4.6, message: 'Significant places generated', status: 'complete', partialCharacter });

      // 4.7: Fears and Phobias
      checkAbort(signal);
      logger.info('📖 STEP 4.7: Fears and Phobias...');
      const fearsPrompt = buildFearsAndPhobiasPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const fearsRes = await this.llmRequest(fearsPrompt.system, fearsPrompt.user, 1000, 0.7, signal);
      partialCharacter.fearsAndPhobias = fearsRes.text.trim();
      logger.debug('STEP 4.7 Generated:', { length: partialCharacter.fearsAndPhobias.length });
      emit('step', { step: 4.7, message: 'Fears and phobias generated', status: 'complete', partialCharacter });

      // 4.8: Secrets
      checkAbort(signal);
      logger.info('📖 STEP 4.8: Secrets...');
      const secretsPrompt = buildSecretsPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const secretsRes = await this.llmRequest(secretsPrompt.system, secretsPrompt.user, 1000, 0.7, signal);
      partialCharacter.secrets = secretsRes.text.trim();
      logger.debug('STEP 4.8 Generated:', { length: partialCharacter.secrets.length });
      emit('step', { step: 4.8, message: 'Secrets generated', status: 'complete', partialCharacter });

      // 4.9: Goals and Motivations
      checkAbort(signal);
      logger.info('📖 STEP 4.9: Goals and Motivations...');
      const goalsPrompt = buildGoalsAndMotivationsPrompt(charFirstName, charLastName, narrativeText, partialCharacter.briefHistory);
      const goalsRes = await this.llmRequest(goalsPrompt.system, goalsPrompt.user, 1000, 0.7, signal);
      partialCharacter.goalsAndMotivations = goalsRes.text.trim();
      logger.debug('STEP 4.9 Generated:', { length: partialCharacter.goalsAndMotivations.length });
      emit('step', { step: 4.9, message: 'Goals and motivations generated', status: 'complete', partialCharacter });

      // 4.10: Descriptions & Marks
      checkAbort(signal);
      logger.info('📖 STEP 4.10: Descriptions & Marks...');
      const descPrompt = buildDescriptionsAndMarksPrompt(charFirstName, charLastName, narrativeText, basicInfo);
      // 5 sezioni (~200 parole ciascuna) → serve headroom rispetto alle 3 originali
      const descRes = await this.llmRequest(descPrompt.system, descPrompt.user, 2600, 0.7, signal);

      // Parse the five descriptions from response
      const descSections = parseDescriptionsSections(descRes.text);
      partialCharacter.physicalDescription = descSections.physicalDescription;
      partialCharacter.publicDescription = descSections.publicDescription;
      partialCharacter.privateDescription = descSections.privateDescription;
      partialCharacter.visibleMarks = descSections.visibleMarks;
      partialCharacter.hiddenMarks = descSections.hiddenMarks;
      logger.debug('STEP 4.10 Generated:', {
        physicalLength: partialCharacter.physicalDescription.length,
        publicLength: partialCharacter.publicDescription.length,
        privateLength: partialCharacter.privateDescription.length,
        visibleLength: partialCharacter.visibleMarks.length,
        hiddenLength: partialCharacter.hiddenMarks.length
      });
      emit('step', { step: 4.10, message: 'Descriptions & marks generated', status: 'complete', partialCharacter });

      emit('step', { step: 4, message: 'Background generated (10 sections complete)', status: 'complete', partialCharacter });
    } else {
      logger.info(`Step 4: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 4, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 5: Extract skills list
    if (startStep <= 5) {
      checkAbort(signal);
      logger.info('⚔️ STEP 5: Extracting skills...');
      emit('step', { step: 5, message: 'Extracting skills...', status: 'start' });
      const narrativeText = partialCharacter.narrativeText || '';
      const availableSkillsList = gameConfig.skills.map((s: any) => s.name).join(', ');
      const skillsPrompt = buildSkillsPrompt(charFirstName, charLastName, narrativeText, availableSkillsList);
      const skillsRes = await this.llmRequest(skillsPrompt.system, skillsPrompt.user, 800, 0.3, signal);
      const extractedSkills = parseMarkdownSkills(skillsRes.text, gameConfig.skills);
      logger.debug('STEP 5 Parsed skills:', { count: extractedSkills.length, skills: extractedSkills.map((s: any) => s.name) });
      partialCharacter.extractedSkills = extractedSkills;
      emit('step', { step: 5, message: 'Skills extracted', status: 'complete', partialCharacter });
    } else {
      logger.info(`Step 5: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 5, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 6: Allocate stats (narrative-driven)
    if (startStep <= 6) {
      checkAbort(signal);
      emit('step', { step: 6, message: 'Allocating stats based on narrative...', status: 'start' });

      try {
        // Use LLM to analyze narrative and allocate stats
        const statsPrompt = buildStatsAllocationPrompt(
          partialCharacter.firstName!,
          partialCharacter.lastName!,
          partialCharacter.narrativeText!,
          partialCharacter
        );

        const statsResponse = await this.llmRequest(statsPrompt.system, statsPrompt.user, 1024, 0.7, signal);
        logger.debug('STEP 6 LLM response:', { response: statsResponse.text.substring(0, 200) });

        // Parse stats from response
        const rawStats = parseTextualStats(statsResponse.text);
        const stats = normalizeBudget(rawStats, statsBudget) as unknown as GeneratedStats;
        const statsSum = Object.values(stats).reduce((a, b) => a + b, 0);

        partialCharacter.stats = stats;
        emit('step', { step: 6, message: `Stats allocated (total: ${statsSum}/${statsBudget})`, status: 'complete', partialCharacter });
      } catch (error) {
        logger.error('Step 6 stats allocation failed, using fallback', { error });
        // Fallback to random allocation
        let stats = allocateStats({}, statsBudget);
        stats = normalizeBudget(stats as unknown as Record<string, number>, statsBudget) as unknown as GeneratedStats;
        const statsSum = Object.values(stats).reduce((a, b) => a + b, 0);
        partialCharacter.stats = stats;
        emit('step', { step: 6, message: `Stats allocated (fallback, total: ${statsSum}/${statsBudget})`, status: 'complete', partialCharacter });
      }
    } else {
      logger.info(`Step 6: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 6, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 7: Allocate skills with occupation bonuses
    if (startStep <= 7) {
      checkAbort(signal);
      emit('step', { step: 7, message: 'Allocating skills...', status: 'start' });
      const extractedSkills = partialCharacter.extractedSkills || [];
      const prioritySkillIds = extractedSkills.slice(0, 8).map((s: any) => s.id);

      // Get the selected occupation for bonus application
      const selectedOccupation = occupations.find((o: any) =>
        o.id === partialCharacter.selectedOccupation?.occupationId
      );

      // Allocate skills with occupation bonuses
      const skillsAllocated = allocateSkillsWithOccupation(
        gameConfig.skills,
        prioritySkillIds,
        selectedOccupation,
        skillsBudget
      );

      partialCharacter.skills = skillsAllocated;

      // Calculate total for display (manualPoints + requiredBonus, not including occupationBonus)
      const skillsSum = Object.values(skillsAllocated).reduce((sum: number, skill: any) =>
        sum + skill.manualPoints + skill.requiredBonus, 0);

      logger.info(`Step 7: Skills allocated with occupation bonuses (budget: ${skillsSum}/${skillsBudget})`);
      emit('step', { step: 7, message: `Skills allocated (total: ${skillsSum}/${skillsBudget})`, status: 'complete', partialCharacter });
    } else {
      logger.info(`Step 7: Skipped (resuming from step ${startStep})`);
      emit('step', { step: 7, message: 'Skipped (from previous generation)', status: 'complete', partialCharacter });
    }

    // STEP 7.5: Name uniqueness check
    checkAbort(signal);
    emit('step', { step: 7.5, message: 'Checking name uniqueness...' });
    const fullName = `${charFirstName} ${charLastName}`;
    await this.checkNameAvailability(fullName, signal).catch(err => {
      logger.warn(`Name check failed (continuing anyway): ${err.message}`);
    });
    emit('step', { step: 7.5, message: 'Name check complete', complete: true });

    // Budget validation
    checkAbort(signal);
    const statsSum = Object.values(partialCharacter.stats || {}).reduce((a: number, b: any) => a + b, 0);

    // For skills, sum manualPoints + requiredBonus (occupationBonus is extra/free)
    let skillsSum = 0;
    if (partialCharacter.skills && typeof partialCharacter.skills === 'object') {
      for (const skillData of Object.values(partialCharacter.skills)) {
        const skill = skillData as any;
        if (skill && typeof skill === 'object' && 'manualPoints' in skill && 'requiredBonus' in skill) {
          skillsSum += (skill.manualPoints || 0) + (skill.requiredBonus || 0);
        }
      }
    }

    if (statsSum !== statsBudget) {
      throw new Error(`BUDGET MISMATCH stats: got ${statsSum}, expected ${statsBudget}`);
    }
    if (skillsSum !== skillsBudget) {
      throw new Error(`BUDGET MISMATCH skills: got ${skillsSum}, expected ${skillsBudget}`);
    }

    // STEP 8: Assemble final JSON
    checkAbort(signal);
    emit('step', { step: 8, message: 'Assembling character...' });

    // Skills: chiave = skillId (ObjectId), valore = breakdown completo + name.
    //
    // CRITICO: NON convertire le chiavi in nomi. Il wizard idrata con
    // `if (!key.match(/^[0-9a-f]{24}$/i)) return;` (wizardStore.ts) e scarterebbe
    // ogni skill keyata per nome. Il breakdown va preservato integralmente,
    // altrimenti il wizard non può ricostruire né validare il budget.
    // `name` è denormalizzato qui così i consumer (debug UI, review) non
    // devono rifare il lookup sul gameConfig.
    const skillsOut: Record<string, GeneratedSkill> = {};
    if (partialCharacter.skills) {
      for (const [skillId, skillData] of Object.entries(partialCharacter.skills)) {
        const skillDef = gameConfig.skills.find((s: any) => s.id === skillId);
        const name = skillDef?.name || skillId;

        if (skillData && typeof skillData === 'object' && 'total' in skillData) {
          const b = skillData as any;
          skillsOut[skillId] = {
            name,
            base: b.base ?? 0,
            requiredBonus: b.requiredBonus ?? 0,
            manualPoints: b.manualPoints ?? 0,
            occupationBonus: b.occupationBonus ?? 0,
            total: b.total ?? 0,
            category: b.category ?? skillDef?.category ?? 'general',
          };
        } else if (typeof skillData === 'number') {
          // Formato legacy: solo il totale. Ricostruisci un breakdown coerente.
          const base = skillDef?.baseValue ?? 0;
          skillsOut[skillId] = {
            name,
            base,
            requiredBonus: 0,
            manualPoints: Math.max(0, skillData - base),
            occupationBonus: 0,
            total: skillData,
            category: skillDef?.category ?? 'general',
          };
        }
      }
    }

    const result = {
      requestId,
      character: {
        firstName: charFirstName,
        lastName: charLastName,
        gender: charGender,
        birthDate: partialCharacter.birthDate,
        birthPlace: partialCharacter.birthPlace || '',
        age: partialCharacter.age,
        apparentAge: partialCharacter.apparentAge,
        height: partialCharacter.height,
        weight: partialCharacter.weight,
        eyeColor: partialCharacter.eyeColor,
        hairColor: partialCharacter.hairColor,
        visibleMarks: partialCharacter.visibleMarks || '',
        hiddenMarks: partialCharacter.hiddenMarks || '',
        maritalStatus: partialCharacter.maritalStatus,
        educationTitle: partialCharacter.educationTitle,
        criminalRecord: partialCharacter.criminalRecord,
        illnesses: partialCharacter.illnesses || '',
        pathologies: partialCharacter.pathologies || '',
        currentOccupation: partialCharacter.selectedOccupation?.occupationName || partialCharacter.currentOccupation,
        occupation: partialCharacter.selectedOccupation?.occupationName || partialCharacter.currentOccupation,
        occupationId: partialCharacter.selectedOccupation?.occupationId,
        publicDescription: partialCharacter.publicDescription || '',
        privateDescription: partialCharacter.privateDescription || '',
        physicalDescription: partialCharacter.physicalDescription || '',
        stats: partialCharacter.stats,
        skills: skillsOut,  // keyed by skillId, breakdown completo + name
        background: {
          briefHistory: partialCharacter.briefHistory || '',
          significantEvents: partialCharacter.significantEvents || '',
          importantRelationships: partialCharacter.importantRelationships || '',
          personality: partialCharacter.personality || '',
          ideology: partialCharacter.ideology || '',
          significantPlaces: partialCharacter.significantPlaces || '',
          fearsAndPhobias: partialCharacter.fearsAndPhobias || '',
          secrets: partialCharacter.secrets || '',
          goalsAndMotivations: partialCharacter.goalsAndMotivations || '',
        } as GeneratedBackground,
      },
    };
    emit('step', { step: 8, message: 'Character assembled', complete: true });

    return result;
  }

  private async checkNameAvailability(fullName: string, signal: AbortSignal): Promise<void> {
    // Best-effort Opzione B: HTTP call to unified-backend to check name uniqueness
    // If fails, just log and continue (non-blocking)
    const backendUrl = process.env.UNIFIED_BACKEND_URL || 'http://localhost:3001';
    const checkUrl = `${backendUrl}/characters/name-available?name=${encodeURIComponent(fullName)}`;

    const controller = new AbortController();
    const abortHandler = () => controller.abort();

    try {
      const timeout = setTimeout(() => controller.abort(), NAME_CHECK_TIMEOUT_MS);

      // Handle outer signal abort: propagate to controller
      signal.addEventListener('abort', abortHandler);

      const merged = controller.signal;

      // Use fetch (Node 22 built-in)
      const response = await fetch(checkUrl, {
        signal: merged,
        headers: { 'Content-Type': 'application/json' },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        logger.warn(`Name check returned ${response.status} for ${fullName}`);
        return;
      }

      const data = await response.json() as { available?: boolean };
      if (!data.available) {
        logger.warn(`Name "${fullName}" already taken, but proceeding (backend will handle collision)`);
      }
    } catch (err: any) {
      if (isAbortError(err) || err?.name === 'AbortError') throw makeAbortError();
      logger.warn(`Name uniqueness check failed: ${err.message} (continuing)`);
    } finally {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

function parseMarkdownSkills(text: string, availableSkills: Array<{id: string; name: string}>): Array<{id: string; name: string; value: number}> {
  const result: Array<{id: string; name: string; value: number}> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Parse markdown: "- skillName (value)" where value is the LLM-estimated total
    const match = line.match(/^-\s+([^(]+)\s*\((\d+)\)/);
    if (match) {
      const [, skillName, skillValue] = match;
      const trimmedName = skillName.trim();
      const skillValueNum = parseInt(skillValue, 10);

      // Find matching skill in available skills (by name only, since LLM doesn't have skill IDs)
      const skill = availableSkills.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
      if (skill) {
        result.push({
          id: skill.id,
          name: skill.name,
          value: skillValueNum  // Use LLM-estimated value
        });
      }
    }
  }

  return result;
}

/**
 * Normalize maritalStatus from Italian to English values
 */
function normalizeMaritalStatus(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase().trim();

  // Map Italian → English
  const map: Record<string, string> = {
    'celibe': 'single',
    'nubile': 'single',
    'coniugato': 'married',
    'coniugata': 'married',
    'vedovo': 'widowed',
    'vedova': 'widowed',
    'divorziato': 'divorced',
    'divorziata': 'divorced',
    'fidanzato': 'engaged',
    'fidanzata': 'engaged',
    'single': 'single',
    'married': 'married',
    'widowed': 'widowed',
    'divorced': 'divorced',
    'engaged': 'engaged'
  };

  return map[lower] || value;
}

/**
 * Parse background sections from a multi-section response text
 * Extracts: briefHistory, significantEvents, importantRelationships, personality, ideology
 */
function parseDescriptionsSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {
    physicalDescription: '',
    publicDescription: '',
    privateDescription: '',
    visibleMarks: '',
    hiddenMarks: ''
  };

  // NOTA: l'ordine conta — "DESCRIZIONE PUBBLICA/PRIVATA" vanno testate prima di
  // "DESCRIZIONE FISICA" solo se i pattern fossero ambigui; qui sono disgiunti.
  const headerPatterns = [
    { key: 'physicalDescription', pattern: /DESCRIZIONE\s+FISICA/i },
    { key: 'publicDescription', pattern: /DESCRIZIONE\s+PUBBLICA/i },
    { key: 'privateDescription', pattern: /DESCRIZIONE\s+PRIVATA/i },
    { key: 'visibleMarks', pattern: /MARCHI\s+VISIBILI/i },
    { key: 'hiddenMarks', pattern: /MARCHI\s+NASCOSTI/i }
  ];

  let currentSection: string | null = null;
  let currentContent = '';

  for (const line of text.split('\n')) {
    let foundHeader = false;
    for (const { key, pattern } of headerPatterns) {
      if (pattern.test(line)) {
        if (currentSection) {
          sections[currentSection] = currentContent.trim();
        }
        currentSection = key;
        currentContent = '';
        foundHeader = true;
        break;
      }
    }

    if (!foundHeader && currentSection) {
      if (currentContent || line.trim()) {
        currentContent += line + '\n';
      }
    }
  }

  if (currentSection && currentContent) {
    sections[currentSection] = currentContent.trim();
  }

  return sections;
}

function parseBackgroundSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {
    briefHistory: '',
    significantEvents: '',
    importantRelationships: '',
    personality: '',
    ideology: ''
  };

  // Split by section headers (case-insensitive)
  const headerPatterns = [
    { key: 'briefHistory', patterns: /STORIA\s+IN\s+BREVE/i },
    { key: 'significantEvents', patterns: /FATTI\s+SALIENTI/i },
    { key: 'importantRelationships', patterns: /RELAZIONI\s+IMPORTANTI/i },
    { key: 'personality', patterns: /PERSONALITÀ/i },
    { key: 'ideology', patterns: /IDEOLOGIA|CREDO/i }
  ];

  let currentSection: string | null = null;
  let currentContent = '';

  for (const line of text.split('\n')) {
    // Check if line matches any section header
    let foundHeader = false;
    for (const { key, patterns } of headerPatterns) {
      if (patterns.test(line)) {
        // Save previous section
        if (currentSection) {
          sections[currentSection] = currentContent.trim();
        }
        currentSection = key;
        currentContent = '';
        foundHeader = true;
        break;
      }
    }

    if (!foundHeader && currentSection) {
      // Add line to current section (skip empty lines at start)
      if (currentContent || line.trim()) {
        currentContent += line + '\n';
      }
    }
  }

  // Save last section
  if (currentSection && currentContent) {
    sections[currentSection] = currentContent.trim();
  }

  return sections;
}

/**
 * Normalize skill/stat values to match exact budget.
 * If total != budget, adjust by 1 starting from highest value (up) or lowest value (down)
 */
function normalizeBudget(values: Record<string, number>, targetBudget: number): Record<string, number> {
  const result = { ...values };
  let currentTotal = Object.values(result).reduce((a, b) => a + b, 0);

  if (currentTotal === targetBudget) return result;

  // Sort by value (highest first)
  const sortedKeys = Object.entries(result)
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => key);

  if (currentTotal < targetBudget) {
    // Add points to skills with highest values
    const diff = targetBudget - currentTotal;
    for (let i = 0; i < diff; i++) {
      const key = sortedKeys[i % sortedKeys.length];
      result[key]++;
    }
  } else {
    // Subtract points from skills with highest values
    const diff = currentTotal - targetBudget;
    for (let i = 0; i < diff; i++) {
      const key = sortedKeys[i % sortedKeys.length];
      if (result[key] > 0) result[key]--;
    }
  }

  return result;
}

/**
 * Riconosce le formulazioni con cui l'LLM dice "questo campo non ha contenuto".
 *
 * Convenzione del wizard: campo vuoto = nessun precedente / personaggio sano
 * (vedi placeholder e helpText in Step1BasicInfo.tsx). Normalizziamo qui perché
 * il match esatto precedente era arbitrario: "Nessuna" veniva svuotato ma
 * "Nessuna." (col punto) e "none" passavano come contenuto, rendendo l'esito
 * dipendente dalla punteggiatura del modello.
 */
function isNoValue(value: string): boolean {
  // Via punteggiatura di coda e accenti/spazi superflui
  const v = value
    .toLowerCase()
    .replace(/[.!;,\s]+$/g, '')
    .trim();

  if (v === '' || v === '-' || v === '--' || v === 'n/a' || v === 'na') return true;
  if (v === 'no' || v === 'none' || v === 'null' || v === 'nulla') return true;

  // "nessuno" / "nessuna" / "nessun precedente penale" / "nessuna patologia nota".
  // Limite di lunghezza per non azzerare una descrizione che inizia per "nessun..."
  // ma poi racconta qualcosa di sostanziale.
  if (/^nessun[oa]?\b/.test(v) && v.length <= 40) return true;

  return false;
}

function parseTextualBasicInfo(text: string): Record<string, any> {
  const result: Record<string, any> = {
    firstName: '[Name to be generated]',
    lastName: '[Surname to be generated]',
    birthDate: undefined,
    birthPlace: undefined,
    age: undefined,
    apparentAge: undefined,
    height: undefined,
    weight: undefined,
    eyeColor: undefined,
    hairColor: undefined,
    maritalStatus: undefined,
    educationTitle: undefined,
    criminalRecord: undefined,
    pathologies: undefined,
    currentOccupation: undefined
  };

  // Fields that should be parsed as numbers
  const numericFields = new Set(['age', 'apparentAge', 'height', 'weight']);

  // Fields that should NOT be stored if value is "nessuno", "no", "-", "N/A"
  const nullableFields = new Set(['visibleMarks', 'hiddenMarks', 'criminalRecord', 'pathologies']);

  // Parse "campo: valore" format (supports camelCase field names)
  const lines = text.split('\n');
  for (const line of lines) {
    // Match: fieldName: value (allows alphanumeric, underscores, hyphens in field names)
    const match = line.match(/^([a-zA-Z][a-zA-Z0-9]*(?:[A-Z][a-z]*)*)\s*:\s*(.+)$/);
    if (match) {
      const [, field, value] = match;
      const trimmedValue = value.trim();

      if (!trimmedValue || trimmedValue === '-' || trimmedValue === 'N/A') {
        continue;
      }

      // Check if nullable field with "no value" indicator
      if (nullableFields.has(field) && isNoValue(trimmedValue)) {
        result[field] = undefined;
        continue;
      }

      // Convert to number for numeric fields
      if (numericFields.has(field)) {
        const numValue = parseInt(trimmedValue, 10);
        if (!isNaN(numValue)) {
          result[field] = numValue;
          continue;
        }
      }

      // Normalize maritalStatus to English values
      if (field === 'maritalStatus') {
        result[field] = normalizeMaritalStatus(trimmedValue);
      } else {
        result[field] = trimmedValue;
      }
    }
  }

  return result;
}

function parseTextualStats(text: string): Record<string, number> {
  const result: Record<string, number> = {
    strength: 50,
    dexterity: 50,
    intelligence: 50,
    constitution: 50,
    appearance: 50,
    size: 50,
    power: 50,
    education: 50
  };

  // Parse "campo: valore" format (supports camelCase field names)
  const lines = text.split('\n');
  for (const line of lines) {
    // Match: fieldName: value (allows alphanumeric, underscores, hyphens in field names)
    const match = line.match(/^([a-zA-Z][a-zA-Z0-9]*(?:[A-Z][a-z]*)*)\s*:\s*(\d+)/);
    if (match) {
      const [, field, valueStr] = match;
      const numValue = parseInt(valueStr, 10);

      if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
        // Map field names to stat keys
        const fieldLower = field.toLowerCase();
        if (fieldLower in result) {
          result[fieldLower] = numValue;
        }
      }
    }
  }

  return result;
}

function parseOccupationSelection(text: string, occupations: Array<{ id: string; name: string }>): { occupationId: string; occupationName: string } | null {
  // Extract occupation name from response (format: "- Occupation Name" or just "Occupation Name")
  const cleaned = text.trim();

  // Remove markdown list marker if present
  const occupationName = cleaned.replace(/^-\s*/, '').trim();

  // Find matching occupation (case-insensitive)
  const matched = occupations.find(o => o.name.toLowerCase() === occupationName.toLowerCase());

  if (matched) {
    return { occupationId: matched.id, occupationName: matched.name };
  }

  return null;
}
