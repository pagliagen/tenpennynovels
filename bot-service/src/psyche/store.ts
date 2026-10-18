import { MongoClient, type Collection } from 'mongodb';
import type { MoodState, Relation } from './types';

/** Stato persistente del servizio: l'umore di ogni bot e cosa sa di ogni giocatore. */
export interface StateStore {
  getMood(botId: string): Promise<MoodState | null>;
  saveMood(mood: MoodState): Promise<void>;
  getRelations(botId: string, playerIds: string[]): Promise<Map<string, Relation>>;
  saveRelation(rel: Relation): Promise<void>;
  close(): Promise<void>;
}

export class MemoryStore implements StateStore {
  private moods = new Map<string, MoodState>();
  private relations = new Map<string, Relation>();

  async getMood(botId: string): Promise<MoodState | null> {
    return this.moods.get(botId) ?? null;
  }
  async saveMood(mood: MoodState): Promise<void> {
    this.moods.set(mood.botId, mood);
  }
  async getRelations(botId: string, playerIds: string[]): Promise<Map<string, Relation>> {
    const out = new Map<string, Relation>();
    for (const id of playerIds) {
      const rel = this.relations.get(`${botId}:${id}`);
      if (rel) out.set(id, rel);
    }
    return out;
  }
  async saveRelation(rel: Relation): Promise<void> {
    this.relations.set(`${rel.botId}:${rel.playerId}`, rel);
  }
  async close(): Promise<void> {}
}

type MoodDoc = Omit<MoodState, 'botId'> & { _id: string };

export class MongoStore implements StateStore {
  private constructor(
    private readonly client: MongoClient,
    private readonly moods: Collection<MoodDoc>,
    private readonly relations: Collection<Relation>,
  ) {}

  /** Il database è quello dell'URI (`botservice`): separato da quello del game. */
  static async connect(uri: string): Promise<MongoStore> {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    const relations = db.collection<Relation>('relations');
    await relations.createIndex({ botId: 1, playerId: 1 }, { unique: true });
    return new MongoStore(client, db.collection<MoodDoc>('bot_moods'), relations);
  }

  async getMood(botId: string): Promise<MoodState | null> {
    const doc = await this.moods.findOne({ _id: botId });
    return doc ? { botId, pad: doc.pad, updatedAt: doc.updatedAt } : null;
  }

  async saveMood(mood: MoodState): Promise<void> {
    await this.moods.replaceOne({ _id: mood.botId }, { pad: mood.pad, updatedAt: mood.updatedAt }, { upsert: true });
  }

  async getRelations(botId: string, playerIds: string[]): Promise<Map<string, Relation>> {
    if (playerIds.length === 0) return new Map();
    const docs = await this.relations.find({ botId, playerId: { $in: playerIds } }, { projection: { _id: 0 } }).toArray();
    return new Map(docs.map((d) => [d.playerId, d]));
  }

  async saveRelation(rel: Relation): Promise<void> {
    await this.relations.replaceOne({ botId: rel.botId, playerId: rel.playerId }, rel, { upsert: true });
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
