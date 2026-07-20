import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Bot } from './models/Bot';
import { getCreativeAgent, getAnalyticalAgent, resolveProvider } from './agent/AgentFactory';
import { buildSystemPrompt, buildUserMessage, getLastCharacterFromActions, maskActions } from './agent/PromptBuilder';
import { formatResponse } from './agent/ResponseFormatter';
import { buildContext, ContextData } from './agent/ContextBuilder';
import { deterministicRefine } from './agent/DeterministicRefiner';
import { ContextAnalyzer } from './agent/ContextAnalyzer';
import { ResponseRefiner } from './agent/ResponseRefiner';
import { PostResponseAnalyzer } from './agent/PostResponseAnalyzer';
import {
  getGlobalEmotions, mergeEmotions, deriveMoodFromAxes,
  getGlobalEmotionPair, getRelationshipEmotionPair,
  buildPersonalityProfile, computeExpressedEmotions, computeSuppressionBurden,
} from './agent/EmotionManager';
import { MemoryStore } from './memory/MemoryStore';
import { RelationshipStore } from './memory/RelationshipStore';
import { Memory } from './models/Memory';
import { sendCallback } from './callback/CallbackSender';
import { enqueue, getQueueStatus } from './queue/RequestQueue';
import { detectTimePassage } from './utils/SessionDetector';
import { getDecayedNeeds, updateNeedSatisfaction, computeEmotionalPressure } from './agent/NeedsManager';
import { applyEmotionalNoise } from './agent/SpontaneityEngine';
import { detectPhaseTransition, recordPhaseTransition } from './agent/PhaseDetector';
import { deriveAttachmentStyle } from './agent/AttachmentMapper';
import { addSupportEvent } from './agent/ReciprocityEngine';
import { Relationship, ISupportEvent, SupportCategory } from './models/Relationship';
import { computePersonalityBaseline, computeRelationshipBaseline, mergeBaselines } from './agent/BaselineComputer';
import { updateConflictState } from './agent/ConflictEngine';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('BotAI');

// Rate limiting middleware for GET endpoints
const getBotsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests to GET /bots, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const getBotByIdLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests to GET /bots/:id, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/** Calcola overlap tra keyword significative di due testi (0-1). Ignora stopwords. */
function keywordOverlap(a: string, b: string): number {
  const stopwords = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
    'e', 'o', 'ma', 'che', 'non', 'un', 'una', 'si', 'come', 'del', 'al', 'dal', 'nel', 'sul', 'dei', 'ai',
    'questo', 'quello', 'suo', 'sua', 'mio', 'mia', 'ogni', 'piu', 'anche', 'solo', 'quando', 'dove', 'cosa',
    'essere', 'ha', 'ho', 'sono', 'stata', 'stato', 'era', 'viene']);
  const extract = (text: string): Set<string> => {
    const words = text.toLowerCase().replace(/[^a-zàèéìòù\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stopwords.has(w));
    return new Set(words);
  };
  const setA = extract(a);
  const setB = extract(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const w of setA) { if (setB.has(w)) overlap++; }
  return overlap / Math.min(setA.size, setB.size);
}
const creativeAgent = getCreativeAgent();
const analyticalAgent = getAnalyticalAgent();
const contextAnalyzer = new ContextAnalyzer(analyticalAgent);
const responseRefiner = new ResponseRefiner(analyticalAgent);
const postAnalyzer = new PostResponseAnalyzer(creativeAgent, analyticalAgent);
const memoryStore = new MemoryStore();
const relationshipStore = new RelationshipStore();

const router = Router();

// Rate limiting for data-fetching endpoints
const dataFetchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // 50 requests per minute
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: false,
  legacyHeaders: false,
});

// ──────────────────────────────────────────
//  CRUD Routes (unchanged)
// ──────────────────────────────────────────

router.post('/respond', async (req: Request, res: Response) => {
  const { requestId, bot: botRef, context, callback } = req.body;

  try {
    const bot = await Bot.findById(botRef.id);
    if (!bot || !bot.isActive) {
      res.status(404).json({ success: false, error: 'Bot not found or inactive' });
      return;
    }
    if (bot.status !== 'active') {
      res.status(400).json({ success: false, error: 'Bot is not active (pending confirmation)' });
      return;
    }

    const queueStatus = getQueueStatus();
    res.status(202).json({ success: true, requestId, status: 'queued', queue: queueStatus });

    enqueue(() => processAndCallback(requestId, bot, context, callback), bot._id.toString()).catch((err) => {
      logger.error(`Async processing failed for ${requestId}: ${err.message}`);
    });
  } catch (error: any) {
    logger.error(`Error in /respond: ${error.message}`);
    if (error.name === 'CastError') {
      res.status(400).json({ success: false, error: `Invalid bot ID: ${botRef?.id}` });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/bots', getBotsLimiter, async (req: Request, res: Response) => {
  const filter: Record<string, any> = { isActive: true };
  const status = req.query.status as string | undefined;
  if (status === 'active') {
    filter.status = 'active';
  } else if (status === 'pending') {
    filter.status = 'pending';
  }
  const bots = await Bot.find(filter).lean();
  res.json({ success: true, data: bots });
});

router.post('/bots/generate', async (req: Request, res: Response) => {
  const { requestId, description, location, style, locale } = req.body;
  try {
    const generated = await creativeAgent.generateBot(description, {
      location, style, locale: locale || 'it',
    });
    const bot = await Bot.create({
      name: generated.name,
      gender: generated.gender,
      publicDescription: generated.publicDescription,
      personality: generated.personality,
      systemPrompt: generated.systemPrompt,
      narrativeStyle: generated.narrativeStyle,
    });
    res.json({ success: true, requestId, data: bot.toObject() });
  } catch (err: any) {
    logger.error(`Generate failed ${requestId}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/bots/:id', getBotByIdLimiter, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, error: 'Invalid bot ID format' });
    return;
  }
  const bot = await Bot.findById(id).lean();
  if (!bot) {
    res.status(404).json({ success: false, error: 'Bot not found' });
    return;
  }
  res.json({ success: true, data: bot });
});

router.post('/bots', async (req: Request, res: Response) => {
  try {
    const bot = await Bot.create(req.body);
    res.status(201).json({ success: true, data: bot });
  } catch (error: any) {
    logger.error(`Error creating bot: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/bots/:id', async (req: Request, res: Response) => {
  const bot = await Bot.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!bot) {
    res.status(404).json({ success: false, error: 'Bot not found' });
    return;
  }
  res.json({ success: true, data: bot });
});

router.post('/bots/:id/refine', async (req: Request, res: Response) => {
  const { hints, style, locale } = req.body;
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) {
      res.status(404).json({ success: false, error: 'Bot not found' });
      return;
    }
    const current = bot.toObject();
    const refined = await creativeAgent.refineBot(current, hints || {}, {
      style: style || 'Londra vittoriana, fine 1800, Call of Cthulhu',
      locale: locale || 'it',
    });
    const updated = await Bot.findByIdAndUpdate(req.params.id, {
      name: refined.name,
      gender: refined.gender,
      publicDescription: refined.publicDescription,
      personality: refined.personality,
      narrativeStyle: refined.narrativeStyle,
      systemPrompt: refined.systemPrompt,
    }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    logger.error(`Refine failed for bot ${req.params.id}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/bots/:id/relationships', dataFetchLimiter, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    // Validate botId as ObjectId to prevent query injection
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid bot ID format' });
      return;
    }
    const botId = new Types.ObjectId(id);
    const relationships = await Relationship.find({ botId })
      .sort({ lastInteraction: -1 })
      .lean();
    res.json({ success: true, data: relationships });
  } catch (error: any) {
    logger.error(`Error fetching relationships for bot ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch relationships' });
  }
});

router.get('/bots/:id/memories', dataFetchLimiter, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    // Validate botId as ObjectId to prevent query injection
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid bot ID format' });
      return;
    }
    const botId = new Types.ObjectId(id);
    const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const limit = Math.min(Number(limitParam) || 50, 200);
    const memories = await Memory.find({ botId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: memories });
  } catch (error: any) {
    logger.error(`Error fetching memories for bot ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch memories' });
  }
});

router.get('/bots/:id/memories/:characterId', dataFetchLimiter, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    // Validate botId as ObjectId to prevent query injection
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid bot ID format' });
      return;
    }
    const botId = new Types.ObjectId(id);
    const { characterId } = req.params;
    if (!characterId || typeof characterId !== 'string' || characterId.trim() === '') {
      res.status(400).json({ success: false, error: 'Invalid character ID' });
      return;
    }
    const limitParam = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const limit = Math.min(Number(limitParam) || 30, 100);
    const memories = await Memory.find({
      botId,
      externalCharacterId: characterId,
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    res.json({ success: true, data: memories });
  } catch (error: any) {
    logger.error(`Error fetching character memories for bot ${req.params.id}: ${error.message}`);
    res.status(500).json({ success: false, error: 'Failed to fetch character memories' });
  }
});

router.delete('/bots/:id', async (req: Request, res: Response) => {
  const bot = await Bot.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!bot) {
    res.status(404).json({ success: false, error: 'Bot not found' });
    return;
  }
  res.json({ success: true, data: { _id: bot._id, deleted: true } });
});

// ──────────────────────────────────────────
//  2-CALL RESPONSE PIPELINE
//  Call 1 (blocking): ContextBuilder + PromptBuilder + agent.generate + DeterministicRefiner
//  Call 2 (background): PostResponseAnalyzer (unified with ArcSummarizer)
// ──────────────────────────────────────────

async function buildKnownNames(
  botId: string,
  actions: Array<{ characterId?: string; characterName: string }>,
  presentCharacters?: Array<{ id?: string; name: string }>,
): Promise<Map<string, string>> {
  const knownNames = new Map<string, string>();
  const allCharacterIds = new Set<string>();

  for (const a of actions) {
    if (a.characterId) allCharacterIds.add(a.characterId);
  }
  if (presentCharacters) {
    for (const c of presentCharacters) {
      if (c.id) allCharacterIds.add(c.id);
    }
  }

  const lookups = [...allCharacterIds].map(async (charId) => {
    const learned = await memoryStore.getLearnedName(botId, charId);
    knownNames.set(charId, learned || 'Sconosciuto');
  });

  await Promise.all(lookups);
  return knownNames;
}

async function runResponsePipeline(bot: any, context: any): Promise<{
  response: string;
  metadata: Record<string, any>;
  persistInteraction: () => Promise<void>;
}> {
  const pipelineStart = Date.now();
  const { characterId, characterName } = getLastCharacterFromActions(context.actions);
  const safeCharacterId = typeof characterId === 'string' ? characterId : '';
  const locationId = context.location?.id || '';
  const botId = bot._id.toString();

  logger.info(`Pipeline START for bot "${bot.name}" ← [${safeCharacterId}]`);

  // ── Data Loading (parallel) ──
  // Compute personality baseline ONCE (used for both memory recall and emotion pairs)
  const personalityBaseline = computePersonalityBaseline(bot.personality?.traits || []);
  // Pre-compute emotions with personality-only baseline for mood-congruent memory recall
  const globalEmotionsForRecall = getGlobalEmotions(bot, personalityBaseline);

  const [memories, relationship, knownNames] = await Promise.all([
    memoryStore.getContextualMemories(botId, safeCharacterId, locationId, globalEmotionsForRecall),
    safeCharacterId ? relationshipStore.getRelationship(botId, safeCharacterId) : Promise.resolve(null),
    buildKnownNames(botId, context.actions, context.presentCharacters),
  ]);

  // Audience awareness: relationships with other present characters
  const presentCharacterIds = (context.presentCharacters || [])
    .map((c: any) => c.id)
    .filter((id: string) => id && id !== safeCharacterId);
  const presentRelationships = presentCharacterIds.length > 0
    ? await relationshipStore.getRelationshipsForCharacters(botId, presentCharacterIds)
    : [];

  const displayName = knownNames.get(safeCharacterId) || 'Sconosciuto';

  // Compute full emotional baselines (personality + relationship)
  const relBaseline = relationship ? computeRelationshipBaseline(relationship) : null;
  const mergedGlobalBaseline = relBaseline
    ? mergeBaselines(personalityBaseline, relBaseline.axes)
    : personalityBaseline;

  const globalPair = getGlobalEmotionPair(bot, mergedGlobalBaseline);
  const relPair = getRelationshipEmotionPair(relationship, bot, relBaseline?.axes);
  const maskedActionsList = maskActions(context.actions, knownNames);
  const timePassage = detectTimePassage(relationship?.lastInteraction ?? null);
  const decayedNeeds = getDecayedNeeds(bot);
  const profile = buildPersonalityProfile(bot.personality?.traits || []);

  // ── Psychological Realism: Needs Pressure + Contagion + Noise ──
  // 1. Unmet needs create emotional pressure (previously computed but never applied)
  const needPressure = computeEmotionalPressure(decayedNeeds);
  for (const [axis, value] of Object.entries(needPressure)) {
    if (value && value > 0) {
      (globalPair.felt as any)[axis] = Math.min(1.0, ((globalPair.felt as any)[axis] || 0) + value);
    }
  }

  // 2. Emotional contagion from present characters' actions
  const contagionResult = computeEmotionalContagion(context.actions || [], profile.emotionalControl);
  for (const [axis, value] of Object.entries(contagionResult.axes)) {
    if (value && value > 0) {
      (globalPair.felt as any)[axis] = Math.min(1.0, ((globalPair.felt as any)[axis] || 0) + value);
    }
  }

  // 3. Spontaneous emotional noise (prevents deterministic behavior)
  globalPair.felt = applyEmotionalNoise(globalPair.felt, profile.emotionalControl);
  if (relPair.felt) {
    relPair.felt = applyEmotionalNoise(relPair.felt, profile.emotionalControl);
  }

  const presentRelationshipInfos = presentRelationships.map((r) => ({
    characterId: r.externalCharacterId,
    displayName: knownNames.get(r.externalCharacterId) || 'Sconosciuto',
    relationshipType: r.relationshipType || 'stranger',
    perceivedStatus: r.perceivedStatus || 'unknown',
    sentiment: r.sentiment,
  }));

  // Reciprocity balance
  let reciprocityDescription = '';
  if (relationship) {
    const { description } = relationshipStore.getReciprocityBalance(relationship);
    reciprocityDescription = description || '';
  }

  // Emotional climate (text version for prompt, axes already merged above)
  const emotionalClimate = contagionResult.climateText;

  // ── STEP 1: Context Analysis (LLM) ──
  logger.info('[Step 1/4] Analyzing context (LLM)...');
  const insights = await contextAnalyzer.analyze({
    bot,
    relationship,
    memories,
    globalEmotions: globalPair.felt,
    relationshipEmotions: relPair.felt,
    maskedActions: maskedActionsList,
    displayName,
    location: context.location,
    timePassage,
  });
  logger.info(`[Step 1/4] Done — intent: ${insights.messageAnalysis.intent}, approach: ${insights.suggestedApproach.substring(0, 60)}...`);

  // ── STEP 2: Deterministic Context Building ──
  logger.info('[Step 2/4] Building context data...');
  const ctx: ContextData = buildContext({
    bot,
    relationship,
    memories,
    globalEmotions: globalPair.felt,
    relationshipEmotions: relPair.felt,
    maskedActions: maskedActionsList,
    displayName,
    location: context.location,
    timePassage,
    presentRelationships: presentRelationshipInfos,
    selfMonitoring: bot.selfMonitoring,
    needs: decayedNeeds,
    goals: bot.goals?.filter((g: any) => g.status === 'active') || [],
    reciprocityDescription,
    emotionalClimate,
  });

  // ── STEP 3: Generate Response (LLM) ──
  logger.info('[Step 3/4] Generating response...');

  // Inietta insights LLM nel system prompt
  let systemPrompt = buildSystemPrompt(bot, ctx, globalPair, relPair);
  if (insights.suggestedApproach) {
    systemPrompt += `\n\n--- ANALISI CONTESTUALE (da Step 1) ---`;
    if (insights.whoIsThis) systemPrompt += `\nCHI E: ${insights.whoIsThis}`;
    if (insights.ourHistory) systemPrompt += `\nSTORIA: ${insights.ourHistory}`;
    if (insights.currentRelationship) systemPrompt += `\nRAPPORTO: ${insights.currentRelationship}`;
    systemPrompt += `\nINTENT: ${insights.messageAnalysis.intent} (tono: ${insights.messageAnalysis.emotionalTone})`;
    if (insights.myCurrentState) systemPrompt += `\nSTATO ATTUALE: ${insights.myCurrentState}`;
    systemPrompt += `\nAPPROCCIO: ${insights.suggestedApproach}`;
  }

  const userMessage = buildUserMessage(context, knownNames);
  const numPredict = bot.narrativeStyle ? 950 : 700;

  let draftResponse = '';
  let genTokens = 0;
  const MAX_GEN_ATTEMPTS = 2;
  for (let genAttempt = 1; genAttempt <= MAX_GEN_ATTEMPTS; genAttempt++) {
    const { text: draftText, tokensUsed } = await creativeAgent.generate(
      systemPrompt, userMessage, numPredict, 0.72, 0.85, 1.2,
    );
    genTokens = tokensUsed;
    draftResponse = formatResponse(draftText);
    if (draftResponse.length > 0) break;
    logger.warn(`[Step 3/4] Attempt ${genAttempt}/${MAX_GEN_ATTEMPTS}: empty response (raw length: ${draftText.length}), retrying...`);
  }
  logger.info(`[Step 3/4] Done — draft (${draftResponse.length} chars): "${draftResponse.substring(0, 80)}..."`);

  if (!draftResponse) {
    logger.error(`[Step 3/4] All ${MAX_GEN_ATTEMPTS} generation attempts returned empty response — aborting pipeline`);
    throw new Error('LLM returned empty response after retries');
  }

  // ── STEP 4: Self-critique & Refine (LLM, max 2 loops) ──
  logger.info('[Step 4/4] Refining response...');
  const refineOutput = await responseRefiner.refine(
    bot, draftResponse, insights, maskedActionsList.slice(-5),
    globalPair.felt, ctx.isFirstEncounter,
  );
  const finalResponse = refineOutput.response;
  if (refineOutput.wasRefined) {
    logger.info(`[Step 4/4] REFINED after ${refineOutput.attempts} attempt(s): "${finalResponse.substring(0, 80)}..."`);
  } else {
    logger.info(`[Step 4/4] Consistent (${refineOutput.attempts} attempt(s))`);
  }

  const blockingMs = Date.now() - pipelineStart;
  logger.info(`Pipeline steps 1-4 COMPLETE in ${blockingMs}ms`);

  // ── Background Persistence (returned as closure) ──
  const persistInteraction = async () => {
    logger.info('[Background] Analyzing interaction...');

    // Determine if arc summary is needed (every 10 interactions)
    const currentInteractionCount = (relationship?.interactionCount ?? 0) + 1;
    const shouldGenerateArc = currentInteractionCount > 0 && currentInteractionCount % 10 === 0;
    const arcContext = shouldGenerateArc && relationship ? {
      interactionCount: currentInteractionCount,
      trust: relationship.trust,
      familiarity: relationship.familiarity,
      sentiment: relationship.sentiment,
    } : undefined;

    // Single LLM call for post-analysis (+ optional arc summary)
    const analysis = await postAnalyzer.analyze(
      bot,
      displayName,
      ctx,
      maskedActionsList.slice(-5),
      finalResponse,
      timePassage.isNewSession,
      memories,
      shouldGenerateArc,
      arcContext,
    );

    // Anomaly clamping
    if (Math.abs(analysis.sentimentDelta) > 0.3) {
      logger.warn(`[Background] Anomaly: sentimentDelta ${analysis.sentimentDelta} clamped`);
      analysis.sentimentDelta = Math.sign(analysis.sentimentDelta) * 0.15;
    }
    if (analysis.trustDeltas) {
      for (const dim of ['competence', 'benevolence', 'integrity'] as const) {
        if (Math.abs(analysis.trustDeltas[dim]) > 0.15) {
          logger.warn(`[Background] Anomaly: trust.${dim} delta clamped`);
          analysis.trustDeltas[dim] = Math.sign(analysis.trustDeltas[dim]) * 0.1;
        }
      }
    }

    // ── Memory persistence ──
    const isGenericMemory = analysis.memoryImportance < 50
      || /^interazione con /i.test(analysis.memorySummary)
      || analysis.memorySummary.length < 30;

    if (!isGenericMemory) {
      await memoryStore.addMemory(botId, characterId, characterName, analysis.memorySummary, {
        sentiment: analysis.sentimentDelta > 0 ? 'positive' : analysis.sentimentDelta < 0 ? 'negative' : 'neutral',
        type: analysis.memoryType,
        importance: analysis.memoryImportance,
        locationId,
      });
    }

    if (analysis.characterLearned) {
      const isNameLearning = /si chiama|il suo nome|dice di chiamarsi|si presenta come/i.test(analysis.characterLearned);
      const alreadyKnown = isNameLearning ? await memoryStore.getLearnedName(botId, characterId) : null;
      if (!alreadyKnown) {
        await memoryStore.addMemory(botId, characterId, characterName, analysis.characterLearned, {
          type: 'observation',
          importance: Math.max(60, analysis.memoryImportance),
          locationId,
        });
      }
    }

    // ── Relationship updates ──
    if (characterId) {
      const trustDelta = analysis.trustDeltas
        ? (analysis.trustDeltas.competence + analysis.trustDeltas.benevolence + analysis.trustDeltas.integrity) / 3
        : 0;
      await relationshipStore.updateRelationship(botId, safeCharacterId, characterName, {
        trust: trustDelta,
        familiarity: analysis.familiarityDelta,
        sentiment: analysis.sentimentDelta,
        perceivedStatus: analysis.perceivedStatus,
        relationshipType: analysis.relationshipType,
        givenSupportDelta: analysis.supportEvent.direction === 'given' || analysis.supportEvent.direction === 'mutual' ? 1 : 0,
        receivedSupportDelta: analysis.supportEvent.direction === 'received' || analysis.supportEvent.direction === 'mutual' ? 1 : 0,
        disclosureDelta: analysis.disclosureDelta !== 0
          ? { breadthDelta: analysis.disclosureDelta * 0.3, depthDelta: analysis.disclosureDelta * 0.7 }
          : undefined,
        trustDeltas: analysis.trustDeltas || undefined,
      }, bot.personality?.traits || []);

      // Accumulate quality score for phase transitions (quality > quantity)
      const interactionQuality = Math.abs(analysis.sentimentDelta) * 5
        + (analysis.familiarityDelta || 0.02) * 10
        + (analysis.turningPoint ? analysis.turningPoint.importanceWeight * 0.5 : 0);
      await Relationship.updateOne(
        { botId: bot._id, externalCharacterId: safeCharacterId },
        { $inc: { qualityScore: interactionQuality } },
      );

      // Turning points
      if (analysis.turningPoint && analysis.turningPoint.type) {
        const tpTypeMap: Record<string, string> = {
          self_disclosure: 'first_vulnerability',
          shared_experience: 'shared_crisis',
          conflict: 'first_conflict',
          support_given: 'gift_or_favor',
          support_received: 'gift_or_favor',
          betrayal: 'betrayal',
          reconciliation: 'reconciliation',
          milestone: 'first_meeting',
          abandonment: 'abandonment',
        };
        await relationshipStore.addTurningPoint(botId, safeCharacterId, {
          type: (tpTypeMap[analysis.turningPoint.type] || 'revelation') as any,
          description: analysis.turningPoint.description || '',
          emotionalImpact: analysis.turningPoint.emotionalImpact,
          importanceWeight: analysis.turningPoint.importanceWeight,
          timestamp: new Date(),
          trustDeltaAtTime: trustDelta,
          sentimentDeltaAtTime: analysis.sentimentDelta,
        });
      }

      // Reciprocity: support events
      if (analysis.supportEvent.direction !== 'none' && analysis.supportEvent.type) {
        const relForSupport = await relationshipStore.getRelationship(botId, characterId);
        if (relForSupport) {
          const mapCategory = (t: string): SupportCategory =>
            t === 'practical' ? 'instrumental' : t === 'informational' ? 'informational' : 'emotional';
          const primaryDir = analysis.supportEvent.direction === 'mutual' ? 'given' : analysis.supportEvent.direction;
          const evt: ISupportEvent = {
            direction: primaryDir as 'given' | 'received',
            weight: analysis.turningPoint?.importanceWeight || 3,
            category: mapCategory(analysis.supportEvent.type),
            description: analysis.supportEvent.description || '',
            timestamp: new Date(),
          };
          const newEvents = addSupportEvent(relForSupport.supportEvents || [], evt);
          const finalEvents = analysis.supportEvent.direction === 'mutual'
            ? addSupportEvent(newEvents, { ...evt, direction: 'received' as const })
            : newEvents;
          await Relationship.updateOne(
            { botId: bot._id, externalCharacterId: { $eq: characterId } },
            { $set: { supportEvents: finalEvents } },
          );
        }
      }

      // Conflict engine: detect/update conflict state
      const relForConflict = await relationshipStore.getRelationship(botId, characterId);
      if (relForConflict) {
        const attachStyle = deriveAttachmentStyle(bot.personality?.traits || []);
        const disgustoLevel = relPair.felt.disgusto || 0;
        const conflictUpdate = updateConflictState(relForConflict, analysis, attachStyle, disgustoLevel);
        if (conflictUpdate && characterId) {
          await Relationship.updateOne(
            { botId: bot._id, externalCharacterId: characterId },
            { $set: { activeConflict: conflictUpdate } },
          );
          if (conflictUpdate.resolved) {
            logger.info(`[Background] Conflict resolved for ${characterId}`);
          } else if (conflictUpdate.isActive) {
            logger.info(`[Background] Conflict active: severity ${conflictUpdate.severity.toFixed(2)}, escalation ${conflictUpdate.escalationLevel}`);
          }
        }
      }

      // Phase transitions
      const relAfterUpdates = await relationshipStore.getRelationship(botId, characterId);
      if (relAfterUpdates) {
        const attachmentStyle = deriveAttachmentStyle(bot.personality?.traits || []);
        const newPhase = detectPhaseTransition(relAfterUpdates, attachmentStyle);
        if (newPhase && newPhase !== relAfterUpdates.phase && characterId) {
          const updatedHistory = recordPhaseTransition(relAfterUpdates.phaseHistory || [], newPhase);
          // @ts-expect-error - botId type issue
          await Relationship.updateOne(
            { botId: bot._id, externalCharacterId: new Types.ObjectId(characterId) },
            { $set: { phase: newPhase, phaseEnteredAt: new Date(), phaseHistory: updatedHistory } },
          );
          logger.info(`[Background] Phase transition: ${relAfterUpdates.phase} → ${newPhase}`);
        }

        // Trend snapshot every 5 interactions
        if (relAfterUpdates.interactionCount % 5 === 0) {
          await relationshipStore.recordTrendSnapshot(botId, characterId);
        }
      }

      // Pattern detection (max 4 per relazione, dedup per keyword overlap)
          // @ts-expect-error - botId type issue
      if (analysis.detectedPattern && characterId) {
        const existingPatterns = await Memory.find({
          botId: bot._id,
          externalCharacterId: new Types.ObjectId(characterId),
          type: 'pattern',
        }).lean();

        const isDuplicate = existingPatterns.some(p => keywordOverlap(p.summary, analysis.detectedPattern!) > 0.5);

        if (!isDuplicate && existingPatterns.length < 4) {
          await memoryStore.addMemory(botId, characterId, characterName, analysis.detectedPattern, {
            type: 'pattern', importance: 75, locationId,
          });
          logger.info(`[Step 4/4] Pattern detected: "${analysis.detectedPattern.substring(0, 80)}"`);
        }
      }

      // Contradiction detection
      if (analysis.potentialContradiction) {
        await memoryStore.addMemory(botId, characterId, characterName, analysis.potentialContradiction, {
          type: 'contradiction', importance: 80, locationId,
        });
      }

      // Face threat memory
      if (analysis.faceThreatened) {
        const presentCount = (context.presentCharacters || []).length;
        await memoryStore.addMemory(botId, characterId, characterName,
          `La mia immagine è stata minacciata durante un'interazione${presentCount > 1 ? ' pubblica' : ''}.`,
          { type: 'emotional', importance: 70, locationId });
      }

      // Arc summary (from unified PostResponseAnalyzer)
      if (analysis.arcSummary) {
        const existingArc = await memoryStore.getActiveArcSummary(botId, characterId);
        const newMemory = await memoryStore.addMemory(botId, characterId, characterName, analysis.arcSummary, {
          type: 'arc_summary', importance: 85,
        });
        if (existingArc?._id && newMemory?._id) {
          await memoryStore.supersedMemory(existingArc._id, newMemory._id);
        }
        logger.info(`[Background] Arc summary generated (${analysis.arcSummary.length} chars)`);
      }
    }

    // ── Emotion Regulation ──
    const persistProfile = buildPersonalityProfile(bot.personality?.traits || []);

    // Global emotions
    const updatedGlobalState = mergeEmotions(bot.emotionState, analysis.globalEmotions, '', bot.personality?.traits);
    const globalExpressed = computeExpressedEmotions(updatedGlobalState.axes, persistProfile, updatedGlobalState.suppressionBurden || 0);
    updatedGlobalState.expressedAxes = globalExpressed.axes;
    if (globalExpressed.breakthroughOccurred) {
      // Emotional breakthrough: burden resets after explosive release
      updatedGlobalState.suppressionBurden = 0.15;
      logger.info(`[Background] EMOTIONAL BREAKTHROUGH for bot "${bot.name}" — suppression burst`);
    } else {
      updatedGlobalState.suppressionBurden = computeSuppressionBurden(
        updatedGlobalState.axes, globalExpressed.axes, updatedGlobalState.suppressionBurden || 0,
      );
      if (analysis.emotionSuppressed) {
        updatedGlobalState.suppressionBurden = Math.min(1.0, (updatedGlobalState.suppressionBurden || 0) + 0.05);
      }
    }
    const newMood = deriveMoodFromAxes(updatedGlobalState.axes);
    await Bot.updateOne(
      { _id: bot._id },
      { $set: { emotionState: updatedGlobalState, 'currentMood.type': newMood, 'currentMood.since': new Date() } },
    );

    // Relationship emotions
    if (characterId && analysis.relationshipEmotions) {
      const updatedRelState = mergeEmotions(relationship?.emotionState, analysis.relationshipEmotions, '', bot.personality?.traits);
      const relExpressed = computeExpressedEmotions(updatedRelState.axes, persistProfile, updatedRelState.suppressionBurden || 0);
      updatedRelState.expressedAxes = relExpressed.axes;
      if (relExpressed.breakthroughOccurred) {
        updatedRelState.suppressionBurden = 0.15;
      } else {
        updatedRelState.suppressionBurden = computeSuppressionBurden(
          updatedRelState.axes, relExpressed.axes, updatedRelState.suppressionBurden || 0,
        );
          // @ts-expect-error - botId type issue
      }
      if (characterId) {
        await Relationship.updateOne(
          { botId: bot._id, externalCharacterId: new Types.ObjectId(characterId) },
          { $set: { emotionState: updatedRelState } },
        );
      }
    }

    // Needs & goals
    if (bot.needs && bot.needs.length > 0) {
      const updatedNeeds = analysis.needsSatisfaction
        ? updateNeedSatisfaction(decayedNeeds, analysis.needsSatisfaction)
        : decayedNeeds;
      await Bot.updateOne({ _id: bot._id }, { $set: { needs: updatedNeeds } });
    }
    if (analysis.goalProgress && bot.goals) {
      const updatedGoals = [...bot.goals];
      for (const gp of analysis.goalProgress) {
        if (updatedGoals[gp.goalIndex]?.status === 'active') {
          updatedGoals[gp.goalIndex].progress = Math.max(0, Math.min(1, updatedGoals[gp.goalIndex].progress + gp.delta));
          if (updatedGoals[gp.goalIndex].progress >= 1.0) {
            updatedGoals[gp.goalIndex].status = 'achieved';
          }
        }
      }
      await Bot.updateOne({ _id: bot._id }, { $set: { goals: updatedGoals } });
    }

    logger.info(`[Background] Persistence complete (${Date.now() - pipelineStart}ms total)`);
  };

  return {
    response: finalResponse,
    metadata: {
      model: (() => {
        const p = resolveProvider();
        if (p === 'inception') return process.env.INCEPTION_MODEL || 'mercury-2';
        return process.env.OLLAMA_MODEL || 'ollama';
      })(),
      tokensUsed: genTokens,
      processingMs: blockingMs,
      pipelineSteps: 4,
      wasRefined: refineOutput.wasRefined,
      refinerAttempts: refineOutput.attempts,
    },
    persistInteraction,
  };
}

async function processAndCallback(requestId: string, bot: any, context: any, callback: any) {
  if (!callback?.url) {
    logger.warn(`[Pipeline] No callback URL provided for ${requestId}`);
  }

  let response: string;
  let metadata: Record<string, any>;
  let persistInteraction: () => Promise<void>;

  try {
    ({ response, metadata, persistInteraction } = await runResponsePipeline(bot, context));
  } catch (err: any) {
    logger.error(`[Pipeline] FAILED for ${requestId}: ${err.message}`);
    return;
  }

  const locationId = context.location?.id || '';
  const callbackPayload = {
    requestId,
    botId: bot._id,
    botName: bot.name,
    botCharacterId: context.presentCharacters?.find((c: any) => c.name === bot.name)?.id || '',
    locationId,
    response,
    metadata,
  };

  if (!requestId || !response || !locationId) {
    logger.error(`[Pipeline] Cannot send callback for ${requestId}: missing fields`, {
      hasRequestId: !!requestId,
      hasResponse: !!response,
      responseLength: response?.length ?? 0,
      hasLocationId: !!locationId,
      locationKeys: context.location ? Object.keys(context.location) : [],
    });
    // Non inviare callback con campi mancanti — il webhook rifiuterebbe con 400
    return;
  }

  if (callback?.url) {
    await sendCallback(callback, callbackPayload);
  } else {
    logger.warn(`[Pipeline] Response generated but no callback URL — skipping delivery for ${requestId}`);
  }

  // Background persistence (non-blocking)
  persistInteraction().catch((err: any) =>
    logger.error(`[Background] Persistence failed for ${requestId}: ${err.message}`),
  );
}

// ── Emotional Contagion (keyword-based + axis modification) ──

import { IPlutchikEmotions } from './models/Bot';

const CLIMATE_PATTERNS = {
  panic: /grida|urla|panico|scappa|aiuto|terrore|sangue|sparo|esplosione|fugge|corre via/i,
  hostile: /insulta|minaccia|colpisce|attacca|pugn|schiaffo|sputa|ringhia|sfodera/i,
  joyful: /ride|brinda|festeggia|applaude|danza|celebra|sorride|abbraccia|esulta/i,
  tense: /sussurra|guarda con sospetto|si irrigidisce|trema|stringe i pugni|serra la mascella/i,
};

const CONTAGION_AXES: Record<string, Partial<IPlutchikEmotions>> = {
  panic:   { paura: 0.15, anticipazione: 0.10 },
  hostile: { rabbia: 0.10, anticipazione: 0.08 },
  joyful:  { gioia: 0.12, fiducia: 0.05 },
  tense:   { anticipazione: 0.12, paura: 0.08 },
};

const CONTAGION_TEXT: Record<string, string> = {
  panic: 'Atmosfera di panico intorno a te.',
  hostile: 'Atmosfera tesa e ostile.',
  joyful: 'Atmosfera allegra e festosa.',
  tense: 'Tensione palpabile nell\'aria.',
};

function computeEmotionalContagion(
  actions: Array<{ content: string }>,
  emotionalControl: number,
): { axes: Partial<IPlutchikEmotions>; climateText: string } {
  const recent = actions.slice(-10);
  const counts: Record<string, number> = { panic: 0, hostile: 0, joyful: 0, tense: 0 };

  for (const a of recent) {
    for (const [key, pattern] of Object.entries(CLIMATE_PATTERNS)) {
      if (pattern.test(a.content)) counts[key]++;
    }
  }

  // Find dominant climate (needs 2+ matches)
  const dominant = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)[0];

  if (!dominant) return { axes: {}, climateText: '' };

  const [climateType] = dominant;
  const rawAxes = CONTAGION_AXES[climateType] || {};
  // Scale by susceptibility: stoic characters resist contagion more
  const susceptibility = 1 - emotionalControl;
  const scaledAxes: Partial<IPlutchikEmotions> = {};
  for (const [axis, value] of Object.entries(rawAxes)) {
    if (value) (scaledAxes as any)[axis] = value * susceptibility;
  }

  return { axes: scaledAxes, climateText: CONTAGION_TEXT[climateType] || '' };
}

export default router;
