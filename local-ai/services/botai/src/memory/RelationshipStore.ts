import { Relationship, IRelationship } from '../models/Relationship';
import { Types } from 'mongoose';

const MAX_SIGNIFICANT_EVENTS = 5;

export class RelationshipStore {
  async getRelationship(botId: string, characterId: string): Promise<IRelationship | null> {
    return Relationship.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
    }).lean();
  }

  async getRelationships(botId: string): Promise<IRelationship[]> {
    return Relationship.find({
      botId: new Types.ObjectId(botId),
    }).sort({ lastInteraction: -1 }).limit(10).lean();
  }

  async updateRelationship(
    botId: string,
    characterId: string,
    characterName: string,
    deltas: { trust?: number; familiarity?: number; sentiment?: number } = {},
  ): Promise<IRelationship> {
    const existing = await Relationship.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
    });

    if (existing) {
      existing.trust = clamp(existing.trust + (deltas.trust || 0), 0, 1);
      existing.familiarity = clamp(existing.familiarity + (deltas.familiarity || 0.05), 0, 1);
      existing.sentiment = clamp(existing.sentiment + (deltas.sentiment || 0), -1, 1);
      existing.interactionCount += 1;
      existing.lastInteraction = new Date();
      return existing.save();
    }

    return Relationship.create({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      characterName,
      trust: clamp(0.5 + (deltas.trust || 0), 0, 1),
      familiarity: clamp(deltas.familiarity || 0.05, 0, 1),
      sentiment: clamp(deltas.sentiment || 0, -1, 1),
      interactionCount: 1,
    });
  }

  async addSignificantEvent(botId: string, characterId: string, event: string): Promise<void> {
    await Relationship.updateOne(
      { botId: new Types.ObjectId(botId), externalCharacterId: characterId },
      {
        $push: {
          significantEvents: { $each: [event], $slice: -MAX_SIGNIFICANT_EVENTS },
        },
      },
    );
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
