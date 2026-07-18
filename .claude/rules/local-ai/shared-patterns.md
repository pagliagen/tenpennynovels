---
category: AI Services
scope: Shared patterns across botai, qa, character-gen
related:
  - ./README.md
  - ../docker-deployment.md
  - ../services/shared-backend.md
---

# Local AI Services - Shared Patterns

Complete implementation patterns used across all AI services (botai, qa, character-gen).

## p-queue Sequential Processing

### Purpose

Ensures FIFO processing with concurrency: 1 to prevent overwhelming LLM resources and maintain deterministic order.

### Implementation

```typescript
import PQueue from 'p-queue';

// Initialize queue with concurrency: 1 (sequential)
const queue = new PQueue({ concurrency: 1 });

// Enqueue task
router.post('/interact', async (req, res) => {
  const queueSize = queue.size;

  // Respond immediately with 202 Accepted
  res.status(202).json({
    status: 'accepted',
    queuePosition: queueSize,
    message: 'Request queued for processing'
  });

  // Add to queue for background processing
  queue.add(async () => {
    try {
      await processInteraction(req.body);
    } catch (error) {
      logger.error('Queue processing failed', { error });
    }
  });
});
```

### Key Features

- **Sequential**: `concurrency: 1` ensures one task at a time
- **Status tracking**: `queue.size` provides queue position
- **Fire-and-forget**: Response sent before processing starts
- **Error isolation**: Try-catch per task prevents queue stalling

### Usage Pattern

✅ **Correct**: Immediate 202 response, background processing

```typescript
res.status(202).json({ status: 'accepted' });
queue.add(async () => await heavyTask());
```

❌ **Incorrect**: Awaiting queue before response

```typescript
// Don't do this - blocks response
await queue.add(async () => await heavyTask());
res.status(200).json({ result });
```

---

## Express + TypeScript Setup

### Standard Server Initialization

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import logger from '../shared/logger';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware stack
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

// Routes
app.use('/api', routes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Service listening on port ${PORT}`);
});
```

### Route Pattern

```typescript
import { Router } from 'express';

const router = Router();

router.post('/interact', async (req, res) => {
  try {
    // Validation
    const { characterId, message, callbackUrl } = req.body;
    if (!characterId || !message || !callbackUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process
    res.status(202).json({ status: 'accepted' });

    // Background work
    queue.add(async () => {
      // ...
    });
  } catch (error) {
    logger.error('Route error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

---

## Winston Logging Patterns

### Shared Logger Configuration

Location: `/local-ai/shared/logger.ts`

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'botai' }, // Change per service
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

export default logger;
```

### Service-Specific Logger

```typescript
import sharedLogger from '../../../shared/logger';

const logger = sharedLogger.child({ service: 'botai' });

// Usage
logger.debug('Processing interaction', { characterId, messageId });
logger.info('Response generated', { duration: 1523 });
logger.warn('Callback failed, retrying', { attempt: 1 });
logger.error('Fatal error', { error: err.message, stack: err.stack });
```

### Log Levels

- **debug**: Verbose processing details (queue status, context analysis)
- **info**: Normal operations (requests accepted, responses sent)
- **warn**: Recoverable issues (callback retry, missing optional data)
- **error**: Failures requiring attention (callback exhausted, LLM errors)

### Usage Pattern

✅ **Correct**: Structured logging with context

```typescript
logger.info('Interaction processed', {
  characterId,
  responseLength: response.length,
  duration: Date.now() - startTime
});
```

❌ **Incorrect**: console.log or unstructured messages

```typescript
// Don't do this
console.log('Processed interaction for ' + characterId);
```

---

## Health Endpoints

### Shared Health Utility

Location: `/local-ai/shared/health.ts`

```typescript
import axios from 'axios';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy';
  checks: {
    [key: string]: boolean;
  };
}

export async function checkEndpoint(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

export function createHealthResponse(
  serviceName: string,
  checks: Record<string, boolean>
): HealthCheck {
  const allHealthy = Object.values(checks).every(v => v);
  return {
    service: serviceName,
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks
  };
}
```

### Implementation

```typescript
import { checkEndpoint, createHealthResponse } from '../../../shared/health';

router.get('/health', async (req, res) => {
  const checks: Record<string, boolean> = {
    server: true, // Server is running if this executes
  };

  // Check unified-backend connectivity
  if (process.env.UNIFIED_BACKEND_URL) {
    checks.unifiedBackend = await checkEndpoint(
      `${process.env.UNIFIED_BACKEND_URL}/health`
    );
  }

  // Check LLM availability
  try {
    const agent = AgentFactory.getAgent();
    checks.llm = await agent.isAvailable();
  } catch {
    checks.llm = false;
  }

  const health = createHealthResponse('botai', checks);
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

### Response Format

```json
{
  "service": "botai",
  "status": "healthy",
  "checks": {
    "server": true,
    "unifiedBackend": true,
    "llm": true
  }
}
```

---

## Callback Patterns with Retry

### CallbackSender Implementation

Location: `/local-ai/services/botai/src/callback/CallbackSender.ts`

```typescript
import axios from 'axios';
import logger from '../../../../shared/logger';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const CALLBACK_ALLOWED_HOSTS = (
  process.env.CALLBACK_ALLOWED_HOSTS || 'unified-backend,localhost'
).split(',');

export class CallbackSender {
  /**
   * Validate callback URL against whitelist
   */
  private static isAllowedHost(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return CALLBACK_ALLOWED_HOSTS.some(allowed =>
        hostname === allowed || hostname.endsWith(`.${allowed}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * Send callback with retry logic
   * @returns true if successful, false if exhausted retries
   */
  static async send(url: string, payload: any): Promise<boolean> {
    // Validate hostname
    if (!this.isAllowedHost(url)) {
      logger.error('Callback URL not in whitelist', { url });
      return false;
    }

    // Retry loop
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.debug('Sending callback', { url, attempt });

        await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        logger.info('Callback sent successfully', { url, attempt });
        return true;

      } catch (error) {
        logger.warn('Callback failed', {
          url,
          attempt,
          error: error instanceof Error ? error.message : 'Unknown'
        });

        // Retry with delay (except last attempt)
        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }

    logger.error('Callback exhausted all retries', { url });
    return false;
  }

  /**
   * Fire-and-forget progress callback (no retry)
   */
  static async sendProgress(url: string, progress: number): Promise<void> {
    if (!this.isAllowedHost(url)) return;

    try {
      await axios.post(url, { progress }, { timeout: 5000 });
    } catch (error) {
      logger.debug('Progress callback failed (ignored)', { url, progress });
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Usage Pattern

```typescript
// Final result callback (with retry)
const success = await CallbackSender.send(callbackUrl, {
  characterId,
  response: generatedText,
  emotions: activeEmotions,
  timestamp: new Date().toISOString()
});

if (!success) {
  logger.error('Failed to deliver response', { characterId });
  // Consider dead-letter queue or manual recovery
}

// Progress callback (fire-and-forget)
await CallbackSender.sendProgress(callbackUrl, 0.5); // 50% complete
```

### Security: Hostname Whitelist

✅ **Correct**: Validate callback URLs

```typescript
CALLBACK_ALLOWED_HOSTS=unified-backend,localhost,api.example.com
```

❌ **Incorrect**: Allow arbitrary URLs

```typescript
// Don't do this - security vulnerability
await axios.post(userProvidedUrl, data);
```

---

## Ollama (default) vs Inception Agent Selection

**Provider di default: Ollama (LLM locale).** Inception è disponibile come alternativa opzionale via `AI_PROVIDER=inception` (richiede `INCEPTION_API_KEY`). Nessun provider esterno a pagamento è richiesto per il funzionamento base del sistema.

### AgentFactory Pattern (dual-role: creativo / analitico)

Location: `/local-ai/services/botai/src/agent/AgentFactory.ts`

BotAI usa **due agent separati**: uno per il ruolo creativo (dialoghi, generazione/refine bot, modello `OLLAMA_MODEL`) e uno per il ruolo analitico (context analysis, JSON strutturato, modello `OLLAMA_ANALYTICAL_MODEL` con fallback su `OLLAMA_MODEL`). Entrambi sono singleton lazy.

```typescript
import { IAgent } from './IAgent';
import { OllamaAgent } from './OllamaAgent';
import { InceptionAgent } from './InceptionAgent';

type AIProvider = 'inception' | 'ollama';

export function resolveProvider(): AIProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === 'inception' || explicit === 'ollama') return explicit;
  return 'ollama'; // default
}

function createAgent(role: string): IAgent {
  const provider = resolveProvider();
  if (provider === 'inception') {
    return new InceptionAgent();
  }
  return new OllamaAgent(); // legge OLLAMA_MODEL / OLLAMA_ANALYTICAL_MODEL internamente
}

export function getCreativeAgent(): IAgent { /* singleton, role='Creative' */ }
export function getAnalyticalAgent(): IAgent { /* singleton, role='Analytical' */ }
```

### IAgent Interface (reale)

```typescript
export interface IAgent {
  generate(
    systemPrompt: string,
    userMessage: string,
    numPredict?: number,
    temperature?: number,
    topP?: number,
    repeatPenalty?: number,
  ): Promise<{ text: string; tokensUsed: number }>;

  analyzeJSON<T = Record<string, unknown>>(
    stepName: string,
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; numPredict?: number },
  ): Promise<{ result: T; tokensUsed: number }>;

  generateBot(description: string, options?: GenerateBotOptions): Promise<any>;
  refineBot(current: Record<string, any>, hints: Record<string, any>, options?: GenerateBotOptions): Promise<any>;
}
```

### OllamaAgent Implementation (reale, HTTP raw verso `/api/chat`)

Location: `/local-ai/services/botai/src/agent/OllamaAgent.ts`

```typescript
export class OllamaAgent implements IAgent {
  private host = process.env.OLLAMA_URL || 'http://localhost:11434';
  private model = process.env.OLLAMA_MODEL || 'gemma3:12b';

  async generate(systemPrompt, userMessage, numPredict = 1024, temperature = 0.72, topP = 0.85, repeatPenalty = 1.2) {
    const response = await this.chat({
      model: this.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      options: { temperature, top_p: topP, repeat_penalty: repeatPenalty, num_predict: numPredict },
    });
    // ... normalizza whitespace, ritorna { text, tokensUsed }
  }

  async analyzeJSON<T>(stepName, systemPrompt, userMessage, options = {}) {
    // chiama /api/chat con format: 'json', 1 retry se il parsing fallisce
  }
}
```

**Nota**: character-gen e qa NON condividono `OllamaAgent`/`AgentFactory` di botai (che è service-local, non in `shared/`); implementano la propria chiamata Ollama (raw HTTP o client `ollama` npm) seguendo lo stesso pattern.

### Usage Pattern

```typescript
// Selezione automatica in base al ruolo
const creative = getCreativeAgent();
const response = await creative.generate(systemPrompt, userMessage, 950, 0.72, 0.85, 1.2);

const analytical = getAnalyticalAgent();
const { result } = await analytical.analyzeJSON('context-analysis', systemPrompt, userMessage);
```

---

## Docker Multi-Stage Builds

### Dockerfile Pattern

Location: `/local-ai/services/botai/Dockerfile`

```dockerfile
# Stage 1: Builder
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app/services/botai

# Install dependencies
COPY services/botai/package.json ./
RUN npm install

# Symlink to parent node_modules for monorepo shared imports
RUN ln -s /app/services/botai/node_modules /app/node_modules

# Copy shared code and tsconfig
COPY tsconfig.base.json /app/
COPY shared/ /app/shared/

# Copy service code
COPY services/botai/ ./

# Build TypeScript
RUN npx tsc

# Stage 2: Production Runtime
FROM node:22-alpine

# Set working directory
WORKDIR /app/services/botai

# Install production dependencies only
COPY services/botai/package.json ./
RUN npm install --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/services/botai/dist ./dist

# Copy shared code (if needed at runtime)
COPY --from=builder /app/shared /app/shared

# Set permissions for non-root user
RUN chown -R node:node /app
USER node

# Expose service port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start service
CMD ["node", "dist/services/botai/src/index.js"]
```

### Key Features

- **Multi-stage**: Separate builder and runtime stages (smaller final image)
- **Monorepo symlink**: `ln -s` allows shared imports to resolve
- **Production-only deps**: `--omit=dev` excludes devDependencies
- **Non-root user**: `USER node` for security
- **Health check**: Docker monitors service health

### Build & Update Pattern

```bash
# Build image
docker-compose build botai

# Update running service (IMPORTANT: stop + up, not restart)
docker-compose stop botai
docker-compose up -d botai

# Why not restart?
# docker-compose restart uses old image
# stop + up loads newly built image
```

### tsconfig.base.json for Monorepo

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["shared/*"]
    }
  },
  "include": ["services/**/*", "shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## BotAI 4-Step Pipeline

### Overview

Sophisticated character AI interaction processing with context analysis, generation, self-critique, and memory storage.

### Step 1: Context Analysis

**Purpose**: Extract relevant context (character state, location, relationships)

```typescript
import { ContextAnalyzer } from './context/ContextAnalyzer';

const contextAnalyzer = new ContextAnalyzer(unifiedBackendUrl);

const context = await contextAnalyzer.analyze({
  characterId,
  locationId,
  recentMessages: lastN(messages, 10)
});

// Returns:
// {
//   character: { name, personality, activeEmotions, currentMood },
//   location: { name, description, occupants },
//   relationships: [{ target, trust, familiarity, sentiment }],
//   recentMemories: [{ summary, importance, timestamp }]
// }
```

### Step 2: Response Generation

**Purpose**: Generate character response using LLM

```typescript
const agent = AgentFactory.getAgent();

const prompt = buildPrompt({
  character: context.character,
  location: context.location,
  message: userMessage,
  relationships: context.relationships,
  memories: context.recentMemories
});

const response = await agent.generateText(prompt, {
  temperature: 0.72,
  topP: 0.85,
  maxTokens: isNarrativeMode ? 950 : 700,
  repeatPenalty: 1.2
});
```

### Step 3: Self-Critique & Refine

**Purpose**: Validate response quality and refine if needed

```typescript
import { ResponseRefiner } from './refine/ResponseRefiner';

const refiner = new ResponseRefiner(agent);

const refined = await refiner.refine({
  originalResponse: response,
  character: context.character,
  message: userMessage,
  criteria: {
    characterConsistency: true,
    emotionalCoherence: true,
    contextRelevance: true,
    qualityThreshold: 0.7
  }
});

// Returns:
// {
//   finalResponse: string,
//   wasRefined: boolean,
//   issues: string[],
//   quality: number
// }
```

### Step 4: Post-Analysis & Memory

**Purpose**: Update character state and store interaction memory

```typescript
import { PostResponseAnalyzer } from './analysis/PostResponseAnalyzer';

const analyzer = new PostResponseAnalyzer(unifiedBackendUrl);

await analyzer.analyze({
  characterId,
  interaction: {
    userMessage,
    characterResponse: refined.finalResponse,
    timestamp: new Date()
  },
  updates: {
    // Update active emotions
    emotions: extractEmotions(refined.finalResponse),

    // Update mood
    mood: calculateMood(context.character.currentMood, interaction),

    // Update relationships
    relationships: updateRelationships(
      context.relationships,
      userMessage,
      refined.finalResponse
    )
  }
});

// Stores memory in MemoryStore
// Updates Bot document in MongoDB
```

### Complete Flow

```typescript
async function processInteraction(payload: InteractionPayload) {
  const startTime = Date.now();

  try {
    // Step 1: Analyze context
    logger.debug('Step 1: Analyzing context');
    const context = await contextAnalyzer.analyze({
      characterId: payload.characterId,
      locationId: payload.locationId,
      recentMessages: payload.messages
    });

    // Step 2: Generate response
    logger.debug('Step 2: Generating response');
    const agent = AgentFactory.getAgent();
    const prompt = buildPrompt(context, payload.message);
    const rawResponse = await agent.generateText(prompt, {
      temperature: 0.72,
      topP: 0.85,
      maxTokens: 950,
      repeatPenalty: 1.2
    });

    // Step 3: Refine response
    logger.debug('Step 3: Refining response');
    const refined = await refiner.refine({
      originalResponse: rawResponse,
      character: context.character,
      message: payload.message
    });

    // Step 4: Post-analysis
    logger.debug('Step 4: Post-analysis');
    await postAnalyzer.analyze({
      characterId: payload.characterId,
      interaction: {
        userMessage: payload.message,
        characterResponse: refined.finalResponse,
        timestamp: new Date()
      },
      updates: {
        emotions: extractEmotions(refined.finalResponse),
        mood: calculateMood(context.character.currentMood),
        relationships: updateRelationships(context.relationships)
      }
    });

    // Send callback with result
    const duration = Date.now() - startTime;
    logger.info('Interaction processed', { characterId: payload.characterId, duration });

    await CallbackSender.send(payload.callbackUrl, {
      characterId: payload.characterId,
      response: refined.finalResponse,
      emotions: extractEmotions(refined.finalResponse),
      wasRefined: refined.wasRefined,
      duration
    });

  } catch (error) {
    logger.error('Interaction failed', { error });

    // Send error callback
    await CallbackSender.send(payload.callbackUrl, {
      error: 'Processing failed',
      characterId: payload.characterId
    });
  }
}
```

---

## Response Formatting

### Temperature & Sampling Configuration

```typescript
const RESPONSE_CONFIG = {
  // Standard conversation
  standard: {
    temperature: 0.72,      // Balanced creativity
    topP: 0.85,            // Nucleus sampling
    maxTokens: 700,        // ~500 words
    repeatPenalty: 1.2     // Reduce repetition
  },

  // Narrative/storytelling mode
  narrative: {
    temperature: 0.72,
    topP: 0.85,
    maxTokens: 950,        // ~700 words
    repeatPenalty: 1.2
  },

  // Factual/precise mode
  factual: {
    temperature: 0.3,      // Low creativity
    topP: 0.9,
    maxTokens: 500,
    repeatPenalty: 1.1
  }
};
```

### Prompt Construction

```typescript
function buildPrompt(context: Context, message: string): string {
  return `
You are ${context.character.name}, with the following traits:
${context.character.personality.join(', ')}

Current emotional state: ${context.character.activeEmotions.join(', ')}
Current mood: ${context.character.currentMood}

Location: ${context.location.name}
${context.location.description}

Recent memories:
${context.recentMemories.map(m => `- ${m.summary}`).join('\n')}

Relationships:
${context.relationships.map(r =>
  `- ${r.target}: trust ${r.trust}, familiarity ${r.familiarity}`
).join('\n')}

User message: "${message}"

Respond in character, considering your emotional state and relationships.
Keep response under ${context.isNarrative ? 700 : 500} words.
`.trim();
}
```

---

## Memory & Persistence

### MemoryStore Pattern

**Purpose**: Store and retrieve contextual interaction memories

```typescript
export class MemoryStore {
  private baseUrl: string;

  constructor(unifiedBackendUrl: string) {
    this.baseUrl = unifiedBackendUrl;
  }

  /**
   * Store interaction memory
   */
  async store(memory: Memory): Promise<void> {
    await axios.post(`${this.baseUrl}/botai/memories`, {
      characterId: memory.characterId,
      summary: memory.summary,
      importance: memory.importance,
      timestamp: memory.timestamp,
      context: memory.context
    });
  }

  /**
   * Retrieve recent memories for character
   */
  async retrieve(characterId: string, limit: number = 10): Promise<Memory[]> {
    const response = await axios.get(`${this.baseUrl}/botai/memories`, {
      params: { characterId, limit }
    });
    return response.data;
  }

  /**
   * Retrieve contextually relevant memories
   */
  async retrieveRelevant(
    characterId: string,
    query: string,
    limit: number = 5
  ): Promise<Memory[]> {
    const response = await axios.post(`${this.baseUrl}/botai/memories/search`, {
      characterId,
      query,
      limit
    });
    return response.data;
  }
}
```

### RelationshipStore Pattern

**Purpose**: Track and update character relationships

```typescript
export class RelationshipStore {
  /**
   * Update relationship metrics based on interaction
   */
  async update(update: RelationshipUpdate): Promise<void> {
    await axios.patch(`${this.baseUrl}/botai/relationships`, {
      characterId: update.characterId,
      targetId: update.targetId,
      changes: {
        trust: update.trustDelta,      // -1.0 to +1.0
        familiarity: update.familiarityDelta,
        sentiment: update.newSentiment  // 'positive' | 'neutral' | 'negative'
      }
    });
  }

  /**
   * Get all relationships for character
   */
  async getAll(characterId: string): Promise<Relationship[]> {
    const response = await axios.get(`${this.baseUrl}/botai/relationships`, {
      params: { characterId }
    });
    return response.data;
  }
}
```

### Bot Schema Updates

**Purpose**: Persist character state changes

```typescript
async function updateBotState(updates: BotStateUpdate): Promise<void> {
  await axios.patch(`${unifiedBackendUrl}/botai/bots/${updates.characterId}`, {
    activeEmotions: updates.emotions,     // ['happy', 'curious']
    currentMood: updates.mood,            // 'content'
    lastInteraction: new Date(),
    interactionCount: { $inc: 1 }
  });
}
```

---

## Cross-References

- **Docker deployment**: [../docker-deployment.md](../docker-deployment.md)
- **Backend integration**: [../services/shared-backend.md](../services/shared-backend.md)
- **Node environment**: [../02-node-environment.md](../02-node-environment.md)
- **AI services overview**: [./README.md](./README.md)

## Reference Files

- `/local-ai/services/botai/src/routes.ts` - p-queue, endpoints
- `/local-ai/services/botai/src/callback/CallbackSender.ts` - Retry logic
- `/local-ai/services/botai/src/agents/AgentFactory.ts` - LLM selection
- `/local-ai/shared/logger.ts` - Winston configuration
- `/local-ai/shared/health.ts` - Health check utilities
- `/local-ai/services/botai/Dockerfile` - Multi-stage build
