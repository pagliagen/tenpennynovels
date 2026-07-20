import { Router, Request, Response } from 'express';
import { generationManager } from './GenerationManager';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('CharacterGenRoutes');
const router = Router();

// Cached game config
let cachedGameConfig: any = null;
let configFetchTime = 0;
const CONFIG_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch game configuration from unified-backend
 */
async function getGameConfig(): Promise<any> {
  const now = Date.now();

  // Return cached config if still valid
  if (cachedGameConfig && (now - configFetchTime) < CONFIG_CACHE_TTL) {
    return cachedGameConfig;
  }

  try {
    const backendUrl = process.env.UNIFIED_BACKEND_URL || 'http://localhost:3001';
    const chargenSecret = process.env.CHARACTER_GEN_SECRET || 'default-chargen-secret-key-change-me';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${backendUrl}/character-gen/config`, {
      headers: {
        'X-Character-Gen-Secret': chargenSecret
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
    }

    const jsonData = await response.json() as any;

    // Extract config from backend response
    const config = jsonData?.data?.config || {};

    if (!config?.skills?.length || !config?.occupations?.length) {
      throw new Error('Backend returned empty or invalid config');
    }

    const statsBudget = config?.limits?.statsBudget || 450;
    const skillsBudget = config?.limits?.skillsBudget || 250;
    const skills = config.skills;
    const occupations = config.occupations;

    cachedGameConfig = {
      skills,
      occupations,
      statsBudget,
      skillsBudget
    };

    configFetchTime = now;
    logger.info(`✅ Loaded game config: ${cachedGameConfig.skills.length} skills, ${cachedGameConfig.occupations.length} occupations`);
    return cachedGameConfig;
  } catch (error) {
    logger.error('Failed to fetch game config from backend', { error });
    throw error;
  }
}

// GET /config — espone il gameConfig cachato (same-origin per le pagine di debug)
// Evita che il client debba parlare col backend con il secret in chiaro nel JS.
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const config = await getGameConfig();
    return res.json({
      success: true,
      data: {
        skills: config.skills,
        occupations: config.occupations,
        statsBudget: config.statsBudget,
        skillsBudget: config.skillsBudget
      }
    });
  } catch (error) {
    logger.error('Failed to expose game config', { error });
    return res.status(503).json({
      success: false,
      error: 'Unable to load configuration from backend',
      code: 'CONFIG_LOAD_ERROR'
    });
  }
});

// POST /generate — avvia/rimpiazza, ritorna SUBITO (no SSE)
router.post('/generate', async (req: Request, res: Response) => {
  const { requestId, sessionKey, description, firstName, lastName, gender } = req.body;
  const missing: string[] = [];

  if (!sessionKey) missing.push('sessionKey');
  if (!description) missing.push('description');

  if (missing.length) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
      code: 'MISSING_REQUIRED_FIELDS'
    });
  }

  try {
    const gameConfig = await getGameConfig();
    const { generationId } = generationManager.submit(
      { requestId: requestId || sessionKey, sessionKey, description, firstName, lastName, gender },
      gameConfig,
    );

    logger.info(`Submit session=${sessionKey} gen=${generationId}`);
    return res.status(202).json({
      success: true,
      sessionKey,
      generationId,
      status: 'queued'
    });
  } catch (error) {
    logger.error('Failed to start generation', { error });
    return res.status(503).json({
      success: false,
      error: 'Unable to load configuration from backend',
      code: 'CONFIG_LOAD_ERROR'
    });
  }
});

// GET /status/:sessionKey — SSE stream
router.get('/status/:sessionKey', (req: Request, res: Response) => {
  const sessionKey = (req.params.sessionKey as string);
  const ok = generationManager.subscribe(sessionKey, res);

  if (!ok) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired',
      code: 'SESSION_NOT_FOUND'
    });
  }

  // Connection stays open for streaming
  // Client will close when it gets 'complete' or 'error' event
});

// Helper: detect which step to resume from based on modification text
function detectResumeStep(modification: string): number {
  const lower = modification.toLowerCase();

  // Step 2: Basic info (names, age, occupation)
  if (/job|occupation|profession|work|occupation|lavoro|professione|occupazione|mestiere/.test(lower)) {
    return 2;
  }

  // Step 3: Background (history, past, personality)
  if (/history|background|past|personality|bio|storia|background|passato|personalità|carattere/.test(lower)) {
    return 3;
  }

  // Step 4: Skills extraction
  if (/skill|ability|competence|abilità|competenza|capacità/.test(lower)) {
    return 4;
  }

  // Step 5: Stats (strength, characteristic, attribute)
  if (/stat|strength|dexterity|intelligence|characteristic|attribut|caratteristica|forza|agilità|intelligenza/.test(lower)) {
    return 5;
  }

  // Default: restart from step 2 (basic info)
  return 2;
}

// POST /resume — resume generation from a modification
router.post('/resume', async (req: Request, res: Response) => {
  const { sessionKey, modification, resumeFromStep } = req.body;

  if (!sessionKey || !modification) {
    return res.status(400).json({
      success: false,
      error: 'Missing sessionKey or modification',
      code: 'MISSING_FIELDS'
    });
  }

  try {
    const gameConfig = await getGameConfig();
    const autoResumeStep = resumeFromStep || detectResumeStep(modification);
    const previousData = generationManager.getPartialCharacter(sessionKey);

    // Submit with resumeFromStep and previousData
    const { generationId } = generationManager.submitWithResume(
      {
        requestId: sessionKey,
        sessionKey,
        description: modification,
      },
      gameConfig,
      autoResumeStep,
      previousData
    );

    logger.info(`Resume session=${sessionKey} gen=${generationId} resumeFromStep=${autoResumeStep} modification="${modification.substring(0, 50)}..."`);
    return res.status(202).json({
      success: true,
      sessionKey,
      generationId,
      resumeFromStep: autoResumeStep,
      status: 'queued'
    });
  } catch (error) {
    logger.error('Failed to resume generation', { error });
    return res.status(503).json({
      success: false,
      error: 'Unable to resume generation',
      code: 'RESUME_ERROR'
    });
  }
});

// GET /partial/:sessionKey — get current partial character state
router.get('/partial/:sessionKey', (req: Request, res: Response) => {
  const sessionKey = (req.params.sessionKey as string);
  const partial = generationManager.getPartialCharacter(sessionKey);

  if (partial === null) {
    return res.status(404).json({
      success: false,
      error: 'Session not found',
      code: 'SESSION_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    data: partial
  });
});

// POST /approve/:sessionKey — approve narrative and continue
router.post('/approve/:sessionKey', (req: Request, res: Response) => {
  const sessionKey = (req.params.sessionKey as string);
  const ok = generationManager.approveNarrative(sessionKey);

  if (!ok) {
    return res.status(400).json({
      success: false,
      error: 'Session not in approval state',
      code: 'NOT_PENDING_APPROVAL'
    });
  }

  logger.info(`Narrative approved for session=${sessionKey}`);
  res.json({
    success: true,
    message: 'Narrative approved, continuing generation'
  });
});

// POST /reject/:sessionKey — reject narrative and prepare for modification
router.post('/reject/:sessionKey', (req: Request, res: Response) => {
  const sessionKey = (req.params.sessionKey as string);
  const ok = generationManager.rejectNarrative(sessionKey);

  if (!ok) {
    return res.status(400).json({
      success: false,
      error: 'Session not in approval state',
      code: 'NOT_PENDING_APPROVAL'
    });
  }

  logger.info(`Narrative rejected for session=${sessionKey}`);
  res.json({
    success: true,
    message: 'Narrative rejected, ready for modification'
  });
});

export default router;
