# BotAI Backend

**Navigation**: [Home](../INDEX.md) > [Backend](./README.md) > BotAI Backend

**Status**: 🚧 Disabled (Requires Migration) | **Last Updated**: 2026-03-01 | **Version**: 1.3

Sistema AI per NPC bot intelligenti con psicologia avanzata, memoria semantica, relazioni complesse.

---

## Overview

**BotAI Backend** è un microservizio dedicato (port 8080) che gestisce personaggi non-giocanti (NPC) controllati da intelligenza artificiale per interazioni realistiche con i giocatori nel gioco di ruolo Victorian.

**Current Status**: Temporaneamente disabled, requires model path migration.

**Key Features**:
- ✅ **Psychology System**: 6 axes (-3 to +3), central wound, public/private duality
- ✅ **Claude AI Integration**: Response generation via Anthropic Claude Sonnet 4.5
- ✅ **Semantic Memory**: Vector-based memory retrieval with embeddings
- ✅ **Relationships**: Archetypes, trust, credibility, latent tensions
- ✅ **Sentiment Analysis**: Emotional feedback loops
- ✅ **Multi-tag Spatial System**: AI-driven bot selection per zone

---

## Architecture

### Microservices Communication

```
┌─────────────────┐          Webhook          ┌──────────────────┐
│                 │  ──────────────────────►  │                  │
│  Game Backend   │                            │  BotAI Backend   │
│  (Port 3001)    │  ◄──────────────────────  │  (Port 8080)     │
│                 │      HTTP POST Action      │                  │
└─────────────────┘                            └──────────────────┘
       │                                              │
       │                                              │
       ▼                                              ▼
┌─────────────────┐                          ┌──────────────────┐
│  MongoDB        │                          │  MongoDB         │
│  (Game DB)      │                          │  (Bot DB)        │
└─────────────────┘                          └──────────────────┘
                                                     │
                                                     ▼
                                             ┌──────────────────┐
                                             │  Claude API      │
                                             │  (Anthropic)     │
                                             └──────────────────┘
```

### Internal Architecture

```
┌─────────────────────────────────────────────────┐
│           BotAI Backend (Port 8080)             │
│  ┌──────────────┐      ┌─────────────────────┐ │
│  │  Bot Manager │      │ Response Generator  │ │
│  │  - Generate  │      │ - Claude Integration│ │
│  │  - Skills    │◄────►│ - Psychology Axes   │ │
│  └──────────────┘      │ - Wound/Duality     │ │
│                        └─────────────────────┘ │
│  ┌──────────────┐      ┌─────────────────────┐ │
│  │Memory System │      │ Sentiment Analysis  │ │
│  │- Semantic    │◄────►│ - Trust Updates     │ │
│  │- Embeddings  │      │ - Emotional State   │ │
│  └──────────────┘      └─────────────────────┘ │
└───────────┬─────────────────────────────────────┘
            │
            ▼
┌───────────────────────┐    ┌──────────────────┐
│  MongoDB (Isolated)   │    │ Embeddings (5002)│
│  - BotProfiles        │    │ - MiniLM-L12-v2  │
│  - BotMemories        │    │ - 384 dimensions │
│  - Relationships      │    │ - Italian opt    │
└───────────────────────┘    └──────────────────┘
```

---

## Communication Flow

1. **Player Action**: Player creates action in location with `bot_enabled=true`
2. **Webhook Notification**: Game Backend → BotAI Backend (`POST /sync/action`)
3. **Bot Decision**: BotAI evaluates if and which bot should respond
4. **Claude API Call**: If responding, generate response via Claude
5. **Bot Action Creation**: BotAI → Game Backend (`POST /game/locations/actions/bot`)
6. **Turn Management**: Turn system advances to next character
7. **WebSocket Broadcast**: All clients receive bot action real-time

**Response Time**: ~2-3s (Claude API latency)

---

## Psychology System

### 6 Psychological Axes

Govern instinctive reactions (-3 to +3):

| Axis | -3 (Left) | 0 (Neutral) | +3 (Right) |
|------|-----------|-------------|------------|
| **Rational/Emotional** | Pure logic | Balanced | Pure emotion |
| **Controlled/Impulsive** | Self-control | Normal | Instant reaction |
| **Cynical/Idealist** | Distrustful | Pragmatic | Optimistic |
| **Proud/Submissive** | Dominant | Equal | Deferential |
| **Prudent/Paranoid** | Cautious | Normal | Suspicious |
| **Direct/Allusive** | Explicit | Balanced | Indirect |

**Example**:
```typescript
psychologyAxes: {
  rationalEmotional: -2,      // Tends rational
  controlledImpulsive: 1,     // Slightly impulsive
  cynicalIdealist: -3,        // Extremely cynical
  proudSubmissive: 2,         // Slightly submissive
  prudentParanoid: 0,         // Balanced
  directAllusive: -1          // Tends direct
}
```

**Impact**: Axes modulate response tone, word choice, emotional expression.

---

### Central Wound

Deep psychological trauma driving behavior.

```typescript
centralWound: {
  wound: "Abbandono da parte dei genitori in giovane età",
  manifestation: "Evita legami profondi, teme il rifiuto, test di fedeltà continui"
}
```

**Usage**:
- Trigger emotional responses
- Create defensive behaviors
- Influence decisions
- **MUST be visible in responses** (subtle references)

---

### Duality System

Public mask vs private truth, revealed based on trust.

```typescript
duality: {
  publicMask: "Mercante rispettabile e onesto",
  privateTruth: "Contrabbandiere con contatti criminali"
}
```

**Trust-Based Reveal**:
- **Trust < 30**: Rigid mask, no hints
- **Trust 30-60**: First subtle hints
- **Trust 60-80**: Mask slips occasionally
- **Trust 80+**: Full revelation possible

---

## Relationship System

### Relationship Archetypes

```typescript
relationshipArchetype: {
  type: 'mentor' | 'rival' | 'romantic' | 'business' |
        'suspicious' | 'protective' | 'apprentice',
  description: "Mentor che guida il personaggio",
  canEvolve: true
}
```

**Examples**:
- **Mentor**: Guides character, shares wisdom
- **Rival**: Competitive, seeks to outperform
- **Romantic**: Attraction, flirtation, jealousy
- **Suspicious**: Distrusts character, watches closely

---

### Trust & Credibility

```typescript
relationship: {
  trust: 65,  // 0-100, affects duality reveal
  sentiment: 0.8,  // -1 to +1
  sourceCredibility: {
    reliability: 2,  // -3 to +3
    basedOn: "Ha sempre mantenuto la parola"
  }
}
```

---

### Latent Tensions

Unconfirmed suspicions affecting relationships.

```typescript
latentTensions: [{
  subject: "Sospetto che nasconda qualcosa sul suo passato",
  severity: 7,  // 1-10
  state: 'active' | 'dormant' | 'resolved',
  source: "Ha evitato domande sulla sua famiglia",
  discoveredAt: Date
}]
```

---

## Semantic Memory System

### Memory Storage

Memories stored with embeddings for semantic retrieval.

```typescript
interface BotMemory {
  botId: ObjectId;
  characterId: ObjectId;
  content: string;
  context: string;  // Location, situation
  emotionalTone: number;  // -1 to +1
  importance: number;  // 1-10

  // Semantic search
  contentEmbedding: number[];  // 384D
  embeddingModel: 'paraphrase-multilingual-MiniLM-L12-v2';

  createdAt: Date;
}
```

### Retrieval

```typescript
// Find relevant memories by semantic similarity
const relevantMemories = await BotMemoryService.findRelevantMemories(
  botId,
  currentActionContent,  // Embed this text
  limit: 5  // Top 5 most similar
);
```

**Performance**: ~100ms embedding + ~50ms ANN search = ~150ms total

**Details**: [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md)

---

## Response Generation

### Claude AI Integration

**Model**: Claude Sonnet 4.5 (claude-3-5-sonnet-20241022)

**Parameters**:
```typescript
{
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  temperature: 0.8,  // Some creativity
  system: systemPrompt,  // Multi-component prompt
  messages: [
    { role: "user", content: contextPrompt }
  ]
}
```

---

### System Prompt Building

Multi-component prompt constructed from:

1. **Identity**: Name, gender, pronouns (grammatical agreement)
2. **Psychology Axes**: 6 axes with current values
3. **Central Wound**: Deep trauma and manifestations
4. **Duality**: Public mask + private truth (trust-based reveal)
5. **Motivations**: Bot's intrinsic goals
6. **Relationships**: Trust levels, sentiment history with characters
7. **Action History**: Recent actions in context for consistency
8. **Session History**: Full session to avoid repetition
9. **Multi-tag Context**: All actions on bot's assigned tags
10. **Victorian Style**: Agatha Christie narrative style, French guillemets « »

**Total Prompt Size**: ~2000-3000 tokens (optimized from 5000+)

---

### Single-Line Response Enforcement

Bot responses **MUST be single-line** for location chat integration.

```typescript
// Claude may return multi-line
let response = "Line 1\nLine 2\nLine 3";

// Enforce single-line
response = response
  .replace(/\r?\n/g, ' ')   // Replace newlines with space
  .replace(/\s{2,}/g, ' ')  // Collapse multiple spaces
  .trim();

// Result: "Line 1 Line 2 Line 3"
```

---

### Anti-Repetition System

**Techniques**:
1. **Session History**: Bot sees full session to avoid repeating info
2. **Information Dosing**: Dose personal info over multiple interactions
3. **Concept Blacklist**: After first mention, avoid:
   - Travel/foreign experiences
   - "I've seen many things", "international experience"
   - Years of trade/experience
   - "I've learned that...", "I know from experience..."

---

## API Endpoints

### Webhook Receiver

```bash
POST /sync/action
Content-Type: application/json
X-Bot-API-Key: <shared_secret>

{
  "eventType": "location_action_created",
  "action": {
    "id": "...",
    "characterId": "...",
    "locationId": "...",
    "content": "Player action text",
    "tags": ["tavern", "indoor"]
  },
  "sessionId": "...",
  "isBotTurn": false
}

Response: 200 OK (immediate, processing async)
```

---

### Bot Generation

```bash
POST /bots/generate
Content-Type: application/json

{
  "name": "Lord Blackwood",
  "gender": "male",
  "occupation": "Detective",
  "personality": "Cynical, observant, logical"
}

Response:
{
  "success": true,
  "bot": {
    "_id": "...",
    "name": "Lord Blackwood",
    "psychologyAxes": {...},
    "centralWound": {...},
    "duality": {...}
  }
}
```

---

### Health Check

```bash
GET /health

Response:
{
  "status": "healthy",
  "version": "1.3",
  "claude": "available",
  "embeddings": "available"
}
```

---

## Database Models

### Bot Model

```typescript
interface Bot {
  _id: ObjectId;
  name: string;
  gender: 'male' | 'female';
  occupation: string;

  // Psychology
  psychologyAxes: {
    rationalEmotional: number;  // -3 to +3
    controlledImpulsive: number;
    cynicalIdealist: number;
    proudSubmissive: number;
    prudentParanoid: number;
    directAllusive: number;
  };

  centralWound: {
    wound: string;
    manifestation: string;
  };

  duality: {
    publicMask: string;
    privateTruth: string;
  };

  // State
  activeEmotions: Array<{
    emotion: string;
    intensity: number;  // 1-10
    trigger?: string;
    startedAt: Date;
  }>;

  // Game integration
  characterId: ObjectId;  // Links to Character in game DB
  createdAt: Date;
  updatedAt: Date;
}
```

---

### Relationship Model

```typescript
interface Relationship {
  botId: ObjectId;
  characterId: ObjectId;

  trust: number;  // 0-100
  sentiment: number;  // -1 to +1

  relationshipArchetype: {
    type: string;
    description: string;
    canEvolve: boolean;
  };

  sourceCredibility: {
    reliability: number;  // -3 to +3
    basedOn: string;
  };

  latentTensions: Array<{
    subject: string;
    severity: number;  // 1-10
    state: 'dormant' | 'active' | 'resolved';
    source: string;
    discoveredAt: Date;
  }>;

  lastInteraction: Date;
  interactionCount: number;
}
```

---

## Performance & Costs

### Cost Per Interaction

**Scenario**: 1 player action → 2 bots respond

**Cost**: ~$0.007 per interaction

**Breakdown**:
- Claude API calls: 2 × $0.003 = $0.006
- Embeddings: 2 × $0.0005 = $0.001

**Optimizations**:
- ✅ Semantic memory (vs full context): 50% reduction
- ✅ Single-line responses (vs multi-paragraph): 30% reduction
- ✅ Cached system prompts: 10% reduction
- ✅ Relationship archetype shortcuts: 5% reduction

**Total Reduction**: ~50% vs baseline

**Details**: [BotAI Costs](../04-ai-ml/botai-costs.md)

---

## Version History

### v1.3 (Current) - Semantic Memory + Cost Optimizations

**Features**:
- Semantic search with embeddings (384D)
- Psychology axes activation in responses
- Emotional feedback loops
- 50% cost reduction via optimizations

---

### v1.2 - Advanced Psychology

**Features**:
- 6 psychological axes (-3 to +3)
- Central wound integration
- Duality gradual unmasking
- Anti-repetition system
- Locked bot AI decision (prevent spam)
- Relationship archetypes (mentor, rival, romantic, etc.)
- Source credibility tracking
- Latent tensions system

---

### v1.1 - Victorian Narrative

**Features**:
- AI-powered bot generation (BotGeneratorService)
- Intelligent bot selection (confidence scoring)
- Gender-aware bots (correct pronouns)
- Multi-tag awareness
- Agatha Christie narrative style
- French guillemets « » for dialogue
- Period-accurate appellatives

---

### v1.0 - Initial Release

**Features**:
- Basic bot generation
- Claude integration
- Simple relationships
- Webhook communication with game backend

---

## State Diagram

**Bot Response Decision Flow**:

![Bot Response State Diagram](../_archive/botai/diagrams/bot-response-state-diagram.mermaid)

**Key States**:
1. Webhook received → Immediate 200 OK
2. Async processing → Background decision
3. Tag-based filtering → Bot selection
4. Locked bot scenario → AI decision if respond
5. First activation → Multi-tag context build
6. Claude API call → Response generation
7. Single-line enforcement → Format response
8. Bot action creation → POST to game backend

**Full diagram**: See [bot-response-state-diagram.mermaid](../_archive/botai/diagrams/bot-response-state-diagram.mermaid) (archived)

---

## Setup & Deployment

### Docker (Current Status: Disabled)

**Build**:
```bash
cd services/botai-backend
docker build -t botai-backend:latest .
```

**Run**:
```bash
docker run -p 8080:8080 \
  -e MONGODB_URI=... \
  -e ANTHROPIC_API_KEY=... \
  -e BOT_API_KEY=... \
  -e GAME_BACKEND_URL=http://unified-backend:3001 \
  botai-backend:latest
```

**Issue**: Requires model path migration before enabling.

---

### Local Development

```bash
cd services/botai-backend
npm install
npm run dev
# → http://localhost:8080
```

**Environment Variables**:
```bash
MONGODB_URI=mongodb://localhost:27017/botai
ANTHROPIC_API_KEY=sk-ant-...
BOT_API_KEY=shared_secret_key
GAME_BACKEND_URL=http://localhost:3001
EMBEDDINGS_SERVICE_URL=http://localhost:5002
```

---

## Testing

### Test Bot Generation

```bash
curl -X POST http://localhost:8080/bots/generate \
  -H "Content-Type: application/json" \
  -H "X-Bot-API-Key: shared_secret_key" \
  -d '{
    "name": "Lady Ashford",
    "gender": "female",
    "occupation": "Socialite",
    "personality": "Charming but manipulative"
  }'
```

---

### Test Webhook

```bash
curl -X POST http://localhost:8080/sync/action \
  -H "Content-Type: application/json" \
  -H "X-Bot-API-Key: shared_secret_key" \
  -d '{
    "eventType": "location_action_created",
    "action": {
      "characterId": "123",
      "locationId": "456",
      "content": "Lord Blackwood enters the tavern",
      "tags": ["tavern", "indoor"]
    },
    "isBotTurn": false
  }'
```

---

## Troubleshooting

### BotAI Backend Not Responding

**Checks**:
```bash
# 1. Verify service running
curl http://localhost:8080/health

# 2. Check logs
docker logs tenpennynovels-botai-backend -f

# 3. Verify API key
curl -H "X-Bot-API-Key: wrong_key" http://localhost:8080/health
# Expected: 401 Unauthorized
```

---

### Claude API Errors

**Common Issues**:
- **401 Unauthorized**: Invalid `ANTHROPIC_API_KEY`
- **429 Rate Limit**: Too many requests (wait or upgrade plan)
- **500 Internal Error**: Check prompt length (<100k tokens)

**Fix**:
```bash
# Verify API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":1024,"messages":[{"role":"user","content":"test"}]}'
```

---

## Related Documentation

- Psychology system documented in this file (6 axes, central wound, duality)
- [BotAI Costs](../04-ai-ml/botai-costs.md) - Cost analysis and optimization
- [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md) - Semantic memory system
- [Unified Backend](./unified-backend-architecture.md) - Game backend integration
- [WebSocket Patterns](../05-frontend/websocket-patterns.md) - Real-time bot actions
