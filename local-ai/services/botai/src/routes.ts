import { Router, Request, Response } from 'express';
import { Bot } from './models/Bot';
import { getAgent } from './agent/AgentFactory';
import { buildSystemPrompt, buildUserMessage, getLastCharacterFromActions, maskActions } from './agent/PromptBuilder';
import { formatResponse } from './agent/ResponseFormatter';
import { ContextAnalyzer } from './agent/ContextAnalyzer';
import { ResponseRefiner } from './agent/ResponseRefiner';
import { PostResponseAnalyzer } from './agent/PostResponseAnalyzer';
import { getActiveEmotions, buildUpdatedEmotions, deriveMood } from './agent/EmotionManager';
import { MemoryStore } from './memory/MemoryStore';
import { RelationshipStore } from './memory/RelationshipStore';
import { sendCallback } from './callback/CallbackSender';
import { enqueue, getQueueStatus } from './queue/RequestQueue';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('BotAI');
const agent = getAgent();
const contextAnalyzer = new ContextAnalyzer(agent);
const responseRefiner = new ResponseRefiner(agent);
const postAnalyzer = new PostResponseAnalyzer(agent);
const memoryStore = new MemoryStore();
const relationshipStore = new RelationshipStore();

const router = Router();

router.post('/respond', async (req: Request, res: Response) => {
  const { requestId, bot: botRef, context, callback } = req.body;

  try {
    const bot = await Bot.findById(botRef.id);
    if (!bot || !bot.isActive) {
      res.status(404).json({ success: false, error: 'Bot not found or inactive' });
      return;
    }

    const queueStatus = getQueueStatus();
    res.status(202).json({ success: true, requestId, status: 'queued', queue: queueStatus });

    enqueue(() => processAndCallback(requestId, bot, context, callback)).catch((err) => {
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

router.get('/bots', async (_req: Request, res: Response) => {
  const bots = await Bot.find({ isActive: true }).lean();
  res.json({ success: true, data: bots });
});

router.post('/bots/generate', async (req: Request, res: Response) => {
  const { requestId, description, location, style, locale, callback } = req.body;

  const queueStatus = getQueueStatus();
  res.status(202).json({ success: true, requestId, status: 'queued', queue: queueStatus });

  enqueue(async () => {
    const generated = await agent.generateBot(description, {
      location,
      style,
      locale: locale || 'it',
    });

    const bot = await Bot.create({
      name: generated.name,
      gender: generated.gender,
      publicDescription: generated.publicDescription,
      personality: generated.personality,
      systemPrompt: generated.systemPrompt,
    });

    await sendCallback(callback, {
      requestId,
      type: 'bot-generated',
      data: bot.toObject(),
    });
  }).catch((err) => {
    logger.error(`Generate failed ${requestId}: ${err.message}`);
  });
});

router.get('/bots/:id', async (req: Request, res: Response) => {
  const bot = await Bot.findById(req.params.id).lean();
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

router.delete('/bots/:id', async (req: Request, res: Response) => {
  const bot = await Bot.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!bot) {
    res.status(404).json({ success: false, error: 'Bot not found' });
    return;
  }
  res.json({ success: true, data: { id: bot._id, deleted: true } });
});

// ──────────────────────────────────────────
//  4-STEP RESPONSE PIPELINE
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

/**
 * Steps 1–3: context analysis, generation, refinement.
 * Returns the final response + a closure that runs Step 4 (post-analysis + persistence).
 * Keeping Step 4 as a separate closure lets the caller send the callback first
 * and then persist asynchronously without blocking the player.
 */
async function runResponsePipeline(bot: any, context: any): Promise<{
  response: string;
  metadata: Record<string, any>;
  persistInteraction: () => Promise<void>;
}> {
  const pipelineStart = Date.now();
  const { characterId, characterName } = getLastCharacterFromActions(context.actions);
  const locationId = context.location?.id || '';
  const botId = bot._id.toString();

  logger.info(`Pipeline START for bot "${bot.name}" ← [${characterId}]`);

  // ── Load data + resolve display names ──
  const [memories, relationship, knownNames] = await Promise.all([
    memoryStore.getContextualMemories(botId, characterId, locationId),
    characterId ? relationshipStore.getRelationship(botId, characterId) : Promise.resolve(null),
    buildKnownNames(botId, context.actions, context.presentCharacters),
  ]);

  const displayName = knownNames.get(characterId) || 'Sconosciuto';
  const activeEmotions = getActiveEmotions(bot);
  const maskedActionsList = maskActions(context.actions, knownNames);

  logger.info(`Display name for [${characterId}]: "${displayName}"`);

  // ── STEP 1: Context Analysis ──
  logger.info('[Step 1/4] Analyzing context...');
  const insights = await contextAnalyzer.analyze({
    bot,
    relationship,
    memories,
    activeEmotions,
    maskedActions: maskedActionsList,
    displayName,
    location: context.location,
  });
  logger.info(`[Step 1/4] Done — firstEncounter: ${insights.isFirstEncounter}, intent: ${insights.messageAnalysis.intent}`);

  // ── STEP 2: Generate Response (temperature lowered to 0.7 for better on-character consistency) ──
  logger.info('[Step 2/4] Generating response...');
  const systemPrompt = buildSystemPrompt(bot, insights, activeEmotions);
  const userMessage = buildUserMessage(context, knownNames);
  const numPredict = bot.narrativeStyle ? 950 : 700;
  const { text: draftText, tokensUsed: genTokens } = await agent.generate(systemPrompt, userMessage, numPredict, 0.72, 0.85, 1.2);
  const draftResponse = formatResponse(draftText);
  logger.info(`[Step 2/4] Done — draft: "${draftResponse.substring(0, 80)}..."`);

  // ── STEP 3: Self-critique & Refine (with loop budget + emotion coherence) ──
  logger.info('[Step 3/4] Refining response...');
  const refineOutput = await responseRefiner.refine(
    bot,
    draftResponse,
    insights,
    maskedActionsList.slice(-5),
    activeEmotions,
  );
  const { response: finalResponse, wasRefined, attempts: refinerAttempts } = refineOutput;
  if (wasRefined) {
    logger.info(`[Step 3/4] Response REFINED after ${refinerAttempts} attempt(s): "${finalResponse.substring(0, 80)}..."`);
  } else {
    logger.info(`[Step 3/4] Response consistent (${refinerAttempts} attempt(s), no changes needed)`);
  }

  const step3Ms = Date.now() - pipelineStart;

  // ── STEP 4: Post-response Analysis + Persistence (returned as closure, run after callback) ──
  const persistInteraction = async () => {
    logger.info('[Step 4/4] Analyzing interaction (background)...');
    const analysis = await postAnalyzer.analyze(
      bot,
      displayName,
      insights,
      maskedActionsList.slice(-5),
      finalResponse,
    );
    logger.info(`[Step 4/4] Done — sentiment: ${analysis.sentimentDelta}, trust: ${analysis.trustDelta}, learned: ${analysis.characterLearned ? 'yes' : 'no'}`);

    await memoryStore.addMemory(botId, characterId, characterName, analysis.memorySummary, {
      sentiment: analysis.sentimentDelta > 0 ? 'positive' : analysis.sentimentDelta < 0 ? 'negative' : 'neutral',
      type: analysis.memoryType,
      importance: analysis.memoryImportance,
      locationId,
    });

    if (analysis.characterLearned) {
      await memoryStore.addMemory(botId, characterId, characterName, analysis.characterLearned, {
        type: 'observation',
        importance: Math.max(60, analysis.memoryImportance),
        locationId,
      });
    }

    if (characterId) {
      await relationshipStore.updateRelationship(botId, characterId, characterName, {
        trust: analysis.trustDelta,
        familiarity: analysis.familiarityDelta,
        sentiment: analysis.sentimentDelta,
      });

      if (analysis.significantEvent) {
        await relationshipStore.addSignificantEvent(botId, characterId, analysis.significantEvent);
      }
    }

    const updatedEmotions = buildUpdatedEmotions(bot.activeEmotions || [], analysis.emotionalReaction);
    const newMood = deriveMood(updatedEmotions);
    await Bot.updateOne(
      { _id: bot._id },
      {
        $set: {
          activeEmotions: updatedEmotions,
          'currentMood.type': newMood,
          'currentMood.since': new Date(),
        },
      },
    );

    logger.info(`[Step 4/4] Persistence complete (${Date.now() - pipelineStart - step3Ms}ms)`);
  };

  logger.info(`Pipeline steps 1-3 COMPLETE in ${step3Ms}ms (${(step3Ms / 1000).toFixed(1)}s)`);

  return {
    response: finalResponse,
    metadata: {
      model: process.env.ANTHROPIC_API_KEY
        ? (process.env.ANTHROPIC_MODEL || 'claude')
        : (process.env.OLLAMA_MODEL || 'ollama'),
      tokensUsed: genTokens,
      processingMs: step3Ms,
      pipelineSteps: 4,
      wasRefined,
      refinerAttempts,
    },
    persistInteraction,
  };
}

async function processAndCallback(requestId: string, bot: any, context: any, callback: any) {
  let response: string;
  let metadata: Record<string, any>;
  let persistInteraction: () => Promise<void>;

  try {
    ({ response, metadata, persistInteraction } = await runResponsePipeline(bot, context));
  } catch (err: any) {
    logger.error(`[Pipeline] FAILED for ${requestId}: ${err.message}`);
    // Send a graceful fallback callback so the client is not left hanging
    await sendCallback(callback, {
      requestId,
      botId: bot._id.toString(),
      botName: bot.name,
      botCharacterId: context.presentCharacters?.find((c: any) => c.name === bot.name)?.id || '',
      locationId: context.location.id || '',
      response: '',
      metadata: { error: err.message, model: process.env.OLLAMA_MODEL || 'unknown' },
    }).catch((cbErr) => logger.error(`[Pipeline] Fallback callback also failed: ${cbErr.message}`));
    return;
  }

  const callbackPayload = {
    requestId,
    botId: bot._id.toString(),
    botName: bot.name,
    botCharacterId: context.presentCharacters?.find((c: any) => c.name === bot.name)?.id || '',
    locationId: context.location.id || '',
    response,
    metadata,
  };

  // Send response to the game immediately after steps 1-3
  await sendCallback(callback, callbackPayload);

  // Step 4 runs in background without blocking the player
  persistInteraction().catch((err: any) =>
    logger.error(`[Step 4/4] Background persistence failed for ${requestId}: ${err.message}`),
  );
}

export default router;
