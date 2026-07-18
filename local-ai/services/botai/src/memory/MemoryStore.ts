import { Memory, IMemory, MemoryType } from '../models/Memory';
import { IPlutchikEmotions } from '../models/Bot';
import { Types, Document } from 'mongoose';

// Type helper for lean query results (includes _id)
type LeanMemory = Omit<IMemory, keyof Document> & { _id: Types.ObjectId };

type DominantMood = 'positive' | 'negative' | 'neutral';

const ACCESSIBILITY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni
const NOT_SUPERSEDED = { $or: [{ supersededBy: null }, { supersededBy: { $exists: false } }] };

export class MemoryStore {
  // ── Mood-congruent recall helpers (Bower, 1981) ─────────────────

  /**
   * Derive dominant mood from Plutchik axes.
   * positive if gioia + fiducia > tristezza + rabbia + disgusto
   */
  private deriveDominantMood(emotions?: IPlutchikEmotions): DominantMood {
    if (!emotions) return 'neutral';
    const positive = (emotions.gioia || 0) + (emotions.fiducia || 0);
    const negative = (emotions.tristezza || 0) + (emotions.rabbia || 0) + (emotions.disgusto || 0);
    if (positive > negative + 0.1) return 'positive';
    if (negative > positive + 0.1) return 'negative';
    return 'neutral';
  }

  /**
   * Compute congruence between a memory's sentiment and the bot's current mood.
   * Returns -0.3 to 1.0 — congruent memories get boosted, incongruent get penalized.
   */
  private computeEmotionalCongruence(memSentiment: string, dominantMood: DominantMood): number {
    if (dominantMood === 'neutral') return 0;
    if (dominantMood === 'positive' && memSentiment === 'positive') return 1;
    if (dominantMood === 'negative' && memSentiment === 'negative') return 1;
    if (dominantMood === 'positive' && memSentiment === 'negative') return -0.3;
    if (dominantMood === 'negative' && memSentiment === 'positive') return -0.3;
    return 0;
  }

  // ── Retrieval helpers ─────────────────────────────────────────────

  private computeAccessibility(mem: LeanMemory, emotionalCongruence: number = 0): number {
    const now = Date.now();
    const ageMs = now - new Date(mem.timestamp).getTime();
    const recencyFactor = Math.pow(0.5, ageMs / ACCESSIBILITY_HALF_LIFE_MS);
    const retrievalBonus = 1 + Math.log2(1 + (mem.retrievalCount || 0)) * 0.1;
    const congruenceBonus = 1 + emotionalCongruence * 0.3; // max 30% boost for mood-congruent memories
    return mem.importance * recencyFactor * retrievalBonus * congruenceBonus;
  }

  private async incrementRetrievalCount(ids: Types.ObjectId[]): Promise<void> {
    if (ids.length === 0) return;
    await Memory.updateMany({ _id: { $in: ids } }, { $inc: { retrievalCount: 1 } });
  }

  // ── Main retrieval: tier-based con accessibility scoring ──────────

  async getContextualMemories(botId: string, characterId: string, locationId: string, currentEmotions?: IPlutchikEmotions): Promise<IMemory[]> {
    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }
    if (typeof characterId !== 'string') {
      throw new Error('Invalid character ID format');
    }
    if (typeof locationId !== 'string') {
      throw new Error('Invalid location ID format');
    }

    const botOid = new Types.ObjectId(botId);
    const safeCharacterId = characterId.trim();
    const safeLocationId = locationId.trim();
    const charFilter = { botId: botOid, externalCharacterId: safeCharacterId, ...NOT_SUPERSEDED };

    // Parallel fetch per tier
    const [arcSummaries, patterns, contradictions, charMemories, importantMemories, locationMems] = await Promise.all([
      // Tier 0: arc_summary (max 1)
      Memory.find({ ...charFilter, type: 'arc_summary' }).sort({ timestamp: -1 }).limit(1).lean(),
      // Tier 1: pattern (max 2)
      Memory.find({ ...charFilter, type: 'pattern' }).sort({ timestamp: -1 }).limit(2).lean(),
      // Tier 2: contradiction (max 1, più recente)
      Memory.find({ ...charFilter, type: 'contradiction' }).sort({ timestamp: -1 }).limit(1).lean(),
      // Tier 3: character-specific (esclusi tipi speciali)
      Memory.find({
        ...charFilter,
        type: { $nin: ['arc_summary', 'pattern', 'contradiction'] },
      }).sort({ timestamp: -1 }).limit(20).lean(),
      // Tier 4: cross-character importanti
      Memory.find({
        botId: botOid,
        importance: { $gte: 60 },
        type: { $nin: ['arc_summary', 'pattern', 'contradiction'] },
        ...NOT_SUPERSEDED,
      }).sort({ importance: -1, timestamp: -1 }).limit(10).lean(),
      // Tier 5: location-specific
      safeLocationId ? Memory.find({
        botId: botOid,
        locationId: safeLocationId,
        type: { $nin: ['arc_summary', 'pattern', 'contradiction'] },
        ...NOT_SUPERSEDED,
      }).sort({ timestamp: -1 }).limit(5).lean() : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const result: IMemory[] = [];

    const addUnique = (mem: LeanMemory) => {
      const id = mem._id?.toString();
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(mem as IMemory);
      }
    };

    // Tier 0: arc_summary (sempre incluso)
    for (const mem of arcSummaries as LeanMemory[]) addUnique(mem);

    // Tier 1: pattern (sempre incluso)
    for (const mem of patterns as LeanMemory[]) addUnique(mem);

    // Tier 2: contradiction (sempre incluso)
    for (const mem of contradictions as LeanMemory[]) addUnique(mem);

    // Mood-congruent recall: compute dominant mood for scoring bias
    const dominantMood = this.deriveDominantMood(currentEmotions);

    // Tier 3: top 3 character-specific per accessibility (with mood congruence)
    const charScored = (charMemories as LeanMemory[])
      .filter(m => !seen.has(m._id?.toString()))
      .map(m => ({ mem: m, score: this.computeAccessibility(m, this.computeEmotionalCongruence(m.sentiment, dominantMood)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    for (const { mem } of charScored) addUnique(mem);

    // Tier 4: top 2 cross-character importanti per accessibility (with mood congruence)
    const importantScored = (importantMemories as LeanMemory[])
      .filter(m => !seen.has(m._id?.toString()))
      .map(m => ({ mem: m, score: this.computeAccessibility(m, this.computeEmotionalCongruence(m.sentiment, dominantMood)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    for (const { mem } of importantScored) addUnique(mem);

    // Tier 5: top 1 location-specific (with mood congruence)
    const locScored = (locationMems as LeanMemory[])
      .filter(m => !seen.has(m._id?.toString()))
      .map(m => ({ mem: m, score: this.computeAccessibility(m, this.computeEmotionalCongruence(m.sentiment, dominantMood)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1);
    for (const { mem } of locScored) addUnique(mem);

    // Rinforzo Ebbinghaus: incrementa retrievalCount per le memorie selezionate
    const ids = (result as unknown as LeanMemory[]).map(m => m._id).filter(Boolean);
    this.incrementRetrievalCount(ids).catch(() => {}); // fire-and-forget

    return result;
  }

  // ── Name learning ─────────────────────────────────────────────────

  async getLearnedName(botId: string, characterId: string): Promise<string | null> {
    if (!characterId) return null;

    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }

    const observations = await Memory.find({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      type: 'observation',
      ...NOT_SUPERSEDED,
    }).sort({ timestamp: -1 }).limit(10).lean();

    for (const mem of observations) {
      const namePatterns = [
        /(?:si chiama|il suo nome e|dice di chiamarsi|si presenta come|si e presentat[oa] come)\s+["']?([A-Z][a-zA-ZÀ-ÿ'\- ]+)/i,
        /(?:nome|name):\s*["']?([A-Z][a-zA-ZÀ-ÿ'\- ]+)/i,
      ];
      for (const regex of namePatterns) {
        const match = mem.summary.match(regex);
        if (match) return match[1].trim();
      }
    }

    return null;
  }

  // ── Write operations ──────────────────────────────────────────────

  async addMemory(
    botId: string,
    characterId: string,
    characterName: string,
    summary: string,
    options: { sentiment?: string; type?: MemoryType; importance?: number; locationId?: string; relatedMemoryId?: Types.ObjectId } = {},
  ): Promise<IMemory> {
    return Memory.create({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      characterName,
      summary,
      sentiment: options.sentiment || 'neutral',
      type: options.type || 'interaction',
      importance: options.importance || 50,
      locationId: options.locationId || '',
      relatedMemoryId: options.relatedMemoryId || null,
    });
  }

  // ── Bulk fetch per arc summarization ──────────────────────────────

  async getAllMemoriesForCharacter(botId: string, characterId: string, limit: number = 50): Promise<IMemory[]> {
    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }
    return Memory.find({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      type: { $nin: ['arc_summary'] },
      ...NOT_SUPERSEDED,
    }).sort({ timestamp: 1 }).limit(limit).lean();
  }

  async getActiveArcSummary(botId: string, characterId: string): Promise<IMemory | null> {
    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }
    // Validate characterId to ensure it is treated as a literal value
    if (typeof characterId !== 'string' || !characterId.trim()) {
      throw new Error('Invalid character ID format');
    }
    return Memory.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      type: 'arc_summary',
      ...NOT_SUPERSEDED,
    }).sort({ timestamp: -1 }).lean();
  }

  async supersedMemory(memoryId: Types.ObjectId, newMemoryId: Types.ObjectId): Promise<void> {
    await Memory.updateOne({ _id: memoryId }, { $set: { supersededBy: newMemoryId } });
  }
}
