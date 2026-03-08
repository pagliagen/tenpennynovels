import { Memory, IMemory, MemoryType } from '../models/Memory';
import { Types } from 'mongoose';

export class MemoryStore {
  async getRecentMemories(botId: string, characterId: string, limit: number = 5): Promise<IMemory[]> {
    const filter: any = { botId: new Types.ObjectId(botId) };
    if (characterId) {
      filter.externalCharacterId = characterId;
    }
    return Memory.find(filter).sort({ timestamp: -1 }).limit(limit).lean();
  }

  async getImportantMemories(botId: string, minImportance: number = 70, limit: number = 3): Promise<IMemory[]> {
    return Memory.find({
      botId: new Types.ObjectId(botId),
      importance: { $gte: minImportance },
    }).sort({ importance: -1, timestamp: -1 }).limit(limit).lean();
  }

  async getLocationMemories(botId: string, locationId: string, limit: number = 3): Promise<IMemory[]> {
    if (!locationId) return [];
    return Memory.find({
      botId: new Types.ObjectId(botId),
      locationId,
    }).sort({ timestamp: -1 }).limit(limit).lean();
  }

  async getContextualMemories(botId: string, characterId: string, locationId: string): Promise<IMemory[]> {
    const [recentWithChar, important, locationMems] = await Promise.all([
      this.getRecentMemories(botId, characterId, 3),
      this.getImportantMemories(botId, 70, 3),
      this.getLocationMemories(botId, locationId, 2),
    ]);

    const seen = new Set<string>();
    const result: IMemory[] = [];

    for (const mem of [...recentWithChar, ...important, ...locationMems]) {
      const id = (mem as any)._id?.toString();
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(mem);
      }
    }

    return result;
  }

  async getLearnedName(botId: string, characterId: string): Promise<string | null> {
    if (!characterId) return null;

    const observations = await Memory.find({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      type: 'observation',
    }).sort({ timestamp: -1 }).limit(10).lean();

    for (const mem of observations) {
      const patterns = [
        /(?:si chiama|il suo nome e|dice di chiamarsi|si presenta come|si e presentat[oa] come)\s+["']?([A-Z][a-zA-ZÀ-ÿ'\- ]+)/i,
        /(?:nome|name):\s*["']?([A-Z][a-zA-ZÀ-ÿ'\- ]+)/i,
      ];
      for (const regex of patterns) {
        const match = mem.summary.match(regex);
        if (match) return match[1].trim();
      }
    }

    return null;
  }

  async addMemory(
    botId: string,
    characterId: string,
    characterName: string,
    summary: string,
    options: { sentiment?: string; type?: MemoryType; importance?: number; locationId?: string } = {},
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
    });
  }
}
