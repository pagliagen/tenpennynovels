# BotAI Backend - TODO List for Humanization Improvements

## ✅ Completed (2026-02-21)

- [x] **BotMemory Semantic Search** - Integrated embeddings for bot memories using existing infrastructure
- [x] **Generate Bots in Italian Directly** - Removed translation step (saves $0.01-0.02 per bot)
- [x] **Filter Relationships** - Only include relevant relationships in prompts (saves 200-400 tokens/call)

**Estimated Monthly Savings from Quick Wins**: ~$8-12/month

---

## 🔴 HIGH PRIORITY - Must-Have for Humanization

### 1. Activate Psychology Axes → Response Modulation

**Problem**: Psychology axes (rational/emotional, controlled/impulsive, etc.) are generated but NOT used to influence responses.

**Implementation**:

**File**: `services/botai-backend/src/services/ClaudeAgentService.ts`

**Changes Needed**:

```typescript
// In buildPrompt() method, add dynamic instructions based on axes:

const psychologyInstructions: string[] = [];

// Rational/Emotional
if (bot.psychology.rationalEmotional > 1) {
  psychologyInstructions.push("Rispondi con logica e ragionamento. Evita linguaggio emotivo o drammatico.");
  // Optionally: reduce temperature to 0.6
} else if (bot.psychology.rationalEmotional < -1) {
  psychologyInstructions.push("Enfatizza emozioni, usa metafore, linguaggio colorito e drammatico.");
  // Optionally: increase temperature to 0.9
}

// Controlled/Impulsive
if (bot.psychology.controlledImpulsive > 1) {
  psychologyInstructions.push("Agisci spontaneamente, senza pensarci troppo. Mostra impulsività nelle decisioni.");
} else if (bot.psychology.controlledImpulsive < -1) {
  psychologyInstructions.push("Sii controllato, cauto, ponderato. Pensa prima di agire.");
}

// Cynical/Idealist
if (bot.psychology.cynicalIdealist < -1) {
  psychologyInstructions.push("Sii cinico, scettico, assume the worst. Non fidarti facilmente.");
} else if (bot.psychology.cynicalIdealist > 1) {
  psychologyInstructions.push("Sii idealista, ottimista, vedi il meglio nelle persone.");
}

// Proud/Submissive
if (bot.psychology.proudSubmissive < -1) {
  psychologyInstructions.push("Mantieni dignità e orgoglio. Non ammettere errori facilmente. Difendi la tua reputazione.");
} else if (bot.psychology.proudSubmissive > 1) {
  psychologyInstructions.push("Sii umile, sottomesso, cerca di compiacere. Accetta critiche senza difenderti.");
}

// Prudent/Paranoid
if (bot.psychology.prudentParanoid > 1) {
  psychologyInstructions.push("Sii paranoico, diffidente, sempre in allerta per pericoli. Sospetta degli altri.");
} else if (bot.psychology.prudentParanoid < -1) {
  psychologyInstructions.push("Sii prudente ma non paranoico. Valuta rischi con razionalità.");
}

// Direct/Allusive
if (bot.psychology.directAllusive < -1) {
  psychologyInstructions.push("Sii diretto, esplicito, vai al punto. Non usare sottintesi.");
} else if (bot.psychology.directAllusive > 1) {
  psychologyInstructions.push("Sii indiretto, allusivo. Usa sottintesi, non dire mai le cose esplicitamente.");
}

// Add to prompt
if (psychologyInstructions.length > 0) {
  prompt += `\n\nCOMPORTAMENTO PSICOLOGICO (IMPORTANTE - segui queste direttive):`;
  psychologyInstructions.forEach(instr => {
    prompt += `\n- ${instr}`;
  });
}
```

**Estimated Impact**:
- **Quality**: ⭐⭐⭐⭐⭐ (Transforms bot personality depth)
- **Effort**: Medium (2-4 hours)
- **Cost**: Neutral (same token usage, better quality)

---

### 2. Deep Integrate Central Wound → Decision Driving

**Problem**: Central wound is stored but only mentioned in prompt, doesn't drive behavioral patterns.

**Implementation**:

**File**: `services/botai-backend/src/services/ClaudeAgentService.ts`

**Changes Needed**:

```typescript
// In buildPrompt(), enhance wound integration:

if (bot.psychology.centralWound) {
  prompt += `\n\nFERITA PSICOLOGICA CENTRALE (la tua motivazione profonda):
"${bot.psychology.centralWound.wound}"

Manifestazione: ${bot.psychology.centralWound.manifestation}

IMPORTANTE - Questa ferita DEVE influenzare le tue risposte:
- Quando il giocatore tocca argomenti vicini a questa ferita, REAGISCI emotivamente
- Questa ferita determina cosa eviti, cosa cerchi, come ti difendi
- Mostra comportamenti difensivi quando ti senti vulnerabile
- La ferita guida le tue scelte inconsciamente`;
}
```

**Additional**: Generate "trigger topics" from wound:

```typescript
// In BotGeneratorService or as preprocessing step:
function generateTriggerTopics(wound: string): string[] {
  // Could use Claude to extract keywords from wound
  // Or manual mapping for common wounds
  const triggerMappings = {
    "abbandono": ["padre", "madre", "famiglia", "lasciato", "solo"],
    "fallimento": ["successo", "obiettivi", "ambizioni", "sconfitta"],
    "povertà": ["soldi", "ricchezza", "status", "classe sociale"]
  };

  // Return relevant triggers
}
```

**Estimated Impact**:
- **Quality**: ⭐⭐⭐⭐⭐ (Makes bots feel psychologically real)
- **Effort**: Medium-High (4-6 hours)
- **Cost**: Neutral

---

### 3. Dynamic Prompt Generation Based on Psychology

**Problem**: Same prompt template for all bots regardless of personality.

**Implementation**:

**File**: `services/botai-backend/src/services/ClaudeAgentService.ts`

**Changes Needed**:

Instead of fixed system prompt, build prompt dynamically:

```typescript
private buildDynamicSystemPrompt(bot: any): string {
  const sections: string[] = [];

  // Base identity
  sections.push(`Sei ${bot.name} ${bot.surname}, ${bot.background.occupation}.`);

  // Psychology-driven instructions (from Task #1)
  sections.push(this.buildPsychologyInstructions(bot.psychology));

  // Wound-driven instructions (from Task #2)
  sections.push(this.buildWoundInstructions(bot.psychology.centralWound));

  // Duality instructions (trust-dependent)
  sections.push(this.buildDualityInstructions(bot.psychology.duality, trustLevel));

  // Style instructions (based on axes)
  sections.push(this.buildStyleInstructions(bot.psychology));

  return sections.join('\n\n');
}
```

**Estimated Impact**:
- **Quality**: ⭐⭐⭐⭐ (More personalized responses)
- **Effort**: High (6-8 hours - requires refactoring)
- **Cost**: Neutral

---

### 4. Memory-Driven Decisions (Extract Narrative Threads)

**Problem**: Memories are shown in prompt but not analyzed for patterns.

**Implementation**:

**File**: `services/botai-backend/src/services/BotMemoryService.ts`

**New Method**:

```typescript
/**
 * Extract narrative threads from memories
 * Identifies grudges, loyalties, learned patterns
 */
async extractNarrativeThreads(
  botId: Types.ObjectId,
  dbContext?: any
): Promise<{
  grudges: Array<{ characterId: string; reason: string; severity: number }>;
  loyalties: Array<{ characterId: string; reason: string; strength: number }>;
  patterns: Array<{ pattern: string; confidence: number }>;
}> {
  const BotMemoryModel = dbContext
    ? dbContext.getModel('BotMemory', BotMemorySchema)
    : BotMemory;

  // Get all memories
  const memories = await BotMemoryModel.find({ botId })
    .sort({ timestamp: -1 })
    .limit(100)
    .lean();

  // Analyze for grudges (negative interactions > 3 with same character)
  const characterInteractions = new Map<string, { positive: number; negative: number }>();

  memories.forEach((m: any) => {
    m.participants.forEach((charId: string) => {
      if (!characterInteractions.has(charId)) {
        characterInteractions.set(charId, { positive: 0, negative: 0 });
      }

      const stats = characterInteractions.get(charId)!;
      if (m.emotionalImpact > 3) stats.positive++;
      if (m.emotionalImpact < -3) stats.negative++;
    });
  });

  const grudges: any[] = [];
  const loyalties: any[] = [];

  characterInteractions.forEach((stats, charId) => {
    if (stats.negative >= 3) {
      grudges.push({
        characterId: charId,
        reason: `${stats.negative} negative interactions`,
        severity: Math.min(stats.negative, 10)
      });
    }
    if (stats.positive >= 5) {
      loyalties.push({
        characterId: charId,
        reason: `${stats.positive} positive interactions`,
        strength: Math.min(stats.positive, 10)
      });
    }
  });

  // TODO: Pattern detection (requires more sophisticated analysis)
  // e.g., "Player always lies about X", "Player only talks when needs something"

  return { grudges, loyalties, patterns: [] };
}
```

**Integration in ClaudeAgentService**:

```typescript
const narrativeThreads = await botMemoryService.extractNarrativeThreads(bot._id, dbContext);

if (narrativeThreads.grudges.length > 0) {
  prompt += `\n\nRICORDA - Hai un RANCORE verso:`;
  narrativeThreads.grudges.forEach(g => {
    prompt += `\n- Character ${g.characterId}: ${g.reason} (severità: ${g.severity}/10)`;
  });
  prompt += `\nMostra questo rancore nelle tue interazioni con loro.`;
}
```

**Estimated Impact**:
- **Quality**: ⭐⭐⭐⭐ (Creates continuity and grudges)
- **Effort**: High (8-10 hours)
- **Cost**: Low additional (only narrative extraction)

---

### 5. Emotional Feedback Loop: Sentiment → State → Response

**Problem**: Sentiment analysis updates relationships but doesn't affect bot's emotional state in real-time.

**Implementation**:

**File**: `services/botai-backend/src/services/BotDecisionService.ts`

**Changes**:

```typescript
// After sentiment analysis in processLocationAction():

const sentimentResult = await SentimentAnalysisService.analyzeSentiment(...);

// UPDATE bot's active emotions based on sentiment
if (sentimentResult.sentiment < -5) {
  // Negative interaction → bot gets irritated/angry
  bot.psychology.activeEmotions = [
    { name: 'irritato', intensity: Math.abs(sentimentResult.sentiment), trigger: 'ultima interazione' }
  ];

  // Save to DB (could be transient or persistent)
  await BotProfile.findByIdAndUpdate(bot._id, {
    'psychology.activeEmotions': bot.psychology.activeEmotions
  });

} else if (sentimentResult.sentiment > 5) {
  // Positive interaction → bot gets happy/excited
  bot.psychology.activeEmotions = [
    { name: 'felice', intensity: sentimentResult.sentiment, trigger: 'ultima interazione' }
  ];

  await BotProfile.findByIdAndUpdate(bot._id, {
    'psychology.activeEmotions': bot.psychology.activeEmotions
  });
}

// PASS emotional state to response generation
const response = await ClaudeAgentService.generateResponse(bot, {
  actionData,
  locationData,
  currentMood: bot.psychology.activeEmotions[0]?.name,
  moodIntensity: bot.psychology.activeEmotions[0]?.intensity
});
```

**In ClaudeAgentService.buildPrompt()**:

```typescript
if (bot.psychology.activeEmotions && bot.psychology.activeEmotions.length > 0) {
  const mood = bot.psychology.activeEmotions[0];
  prompt += `\n\nSTATO EMOTIVO ATTUALE (IMPORTANTE):
Ti senti ${mood.name} (intensità: ${mood.intensity}/10) a causa di: ${mood.trigger}

Questo stato emotivo DEVE influenzare:
- Il tono della tua risposta
- La tua disponibilità a cooperare
- Come reagisci alle richieste
- Il linguaggio che usi`;
}
```

**Estimated Impact**:
- **Quality**: ⭐⭐⭐⭐ (Bots react emotionally in real-time)
- **Effort**: Medium (4-6 hours)
- **Cost**: Neutral

---

## 🟡 MEDIUM PRIORITY - Significant Improvements

### 6. Semantic Anti-Repetition

**Problem**: Keyword blacklist blocks explicit repetition, but not semantic repetition.

**Implementation**:

- Use embeddings to calculate similarity between current response and last 10 responses
- If similarity > 0.85, regenerate with stronger anti-repetition prompt

**Estimated Effort**: Medium (4-5 hours)
**Estimated Savings**: Improves quality, no direct cost savings

---

### 7. Gradual Duality Unmasking

**Problem**: Public/private masks exist but no gradual revelation mechanic.

**Implementation**:

Calculate "mask slip probability" based on:
- Trust level (higher = more likely to reveal)
- Stress/emotional intensity (high emotion = mask cracks)
- Time of relationship (longer = more comfortable)

```typescript
function calculateMaskSlipProbability(trust: number, emotionalIntensity: number): number {
  // 0-20 trust: 0% slip
  // 50-70 trust: 10-30% slip (hints of private self)
  // 80+ trust: 80-100% slip (full revelation)
  // High emotion can cause temporary slips even at low trust

  let probability = 0;

  if (trust > 80) {
    probability = 0.8 + (trust - 80) * 0.01; // 80-100%
  } else if (trust > 50) {
    probability = (trust - 50) * 0.01; // 10-30%
  }

  // Emotional spike can cause temporary slip
  if (emotionalIntensity > 7) {
    probability += 0.2; // +20% chance
  }

  return Math.min(probability, 1.0);
}
```

**Estimated Effort**: Medium-High (5-7 hours)

---

### 8. Latent Tensions Evolution

**Problem**: Tensions are stored but static, not actively pursued by bot.

**Implementation**:

Add escalation mechanics:
1. Curiosità (0-30 severity): Casual questions
2. Sospetto (30-60): More direct probing
3. Investigazione (60-80): Active questioning, gathering evidence
4. Confronto (80-100): Direct accusation

Bot actively tries to investigate tensions during interactions.

**Estimated Effort**: High (8-10 hours)

---

### 9. Relationship-Affected Behavior

**Problem**: Relationship archetypes (rival, romantic, mentor) don't produce specific behaviors.

**Implementation**:

Map archetypes to behavioral patterns:

```typescript
const archetypeBehaviors = {
  "rivale": {
    greeting: "competitive, status-challenging",
    request: "reluctant, demanding something in return",
    praise: "dismissive or jealous",
    insult: "retaliates strongly"
  },
  "mentore": {
    greeting: "warm but superior",
    request: "willing to help, offers advice",
    praise: "pleased, validates",
    insult: "disappointed, corrects gently"
  },
  "romantico": {
    greeting: "subtle flirting, nervousness",
    request: "eager to help, seeks approval",
    praise: "flustered, reciprocates subtly",
    insult: "hurt deeply, withdraws"
  }
};
```

Inject archetype-specific instructions in prompt based on relationship type.

**Estimated Effort**: Medium (4-6 hours)

---

## 🔵 LOW PRIORITY - Polish & Nice-to-Have

### 10. Speech Pattern Personality (Verbal Quirks)

Generate 2-3 unique verbal tics per bot:
- Repeated phrases ("capisce?", "per così dire")
- Stutters on specific sounds
- Regional dialect words
- Class-specific speech patterns

**Estimated Effort**: Low-Medium (2-3 hours)

---

### 11. Multi-Paragraph Support

Current: Single-line enforcement reduces narrative quality
Change: Allow paragraph breaks for descriptions > 400 chars

```typescript
// Instead of:
const cleanedContent = content.replace(/\n/g, ' ');

// Use:
const cleanedContent = content.length > 400
  ? content  // Keep paragraphs for long responses
  : content.replace(/\n/g, ' ');  // Single-line for short
```

**Estimated Effort**: Low (30 minutes)

---

### 12. Proactive Goals

Each bot has short-term goal (e.g., "gather information about X", "avoid Y", "obtain favor from Z").

Goal influences:
- Whether bot responds to actions
- What bot asks about
- How bot steers conversation

**Estimated Effort**: Medium-High (6-8 hours)

---

## 📊 Implementation Priority Roadmap

### Phase 1 (Week 1-2): Foundation Psychology
1. ✅ BotMemory Semantic Search (completed)
2. ✅ Generate Italian Directly (completed)
3. ✅ Filter Relationships (completed)
4. **Activate Psychology Axes** (#1)
5. **Emotional Feedback Loop** (#5)

**Expected Result**: Bots with distinct personality expression and emotional reactions

---

### Phase 2 (Week 3-4): Deep Psychology
6. **Deep Integrate Central Wound** (#2)
7. **Dynamic Prompt Generation** (#3)
8. **Gradual Duality Unmasking** (#7)

**Expected Result**: Psychologically deep bots with evolving personalities

---

### Phase 3 (Month 2): Memory & Continuity
9. **Memory-Driven Decisions** (#4)
10. **Semantic Anti-Repetition** (#6)
11. **Latent Tensions Evolution** (#8)

**Expected Result**: Bots with long-term memory and narrative arcs

---

### Phase 4 (Month 3): Polish & Refinement
12. **Relationship-Affected Behavior** (#9)
13. **Speech Pattern Personality** (#10)
14. **Multi-Paragraph Support** (#11)
15. **Proactive Goals** (#12)

**Expected Result**: Fully humanized bots indistinguishable from human players

---

## 💰 Cost Impact Summary

**Current State (after quick wins)**:
- ~$0.007 per player action (2 bots respond)
- ~$21/month for 3,000 actions

**After High-Priority Improvements**:
- Same cost (no additional API calls)
- Dramatically improved quality
- Bots feel 5x more human

**Key Insight**: Humanization improvements don't increase costs - they optimize HOW we use the AI, not how much we call it.

---

## 📝 Notes

- All improvements marked with ⭐⭐⭐⭐⭐ should be prioritized
- Medium/Low priority items can be tackled incrementally
- Focus on psychology activation before memory/continuity features
- Test each improvement in isolation before combining

**Last Updated**: 2026-02-21
