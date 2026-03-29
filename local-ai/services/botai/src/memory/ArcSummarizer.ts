import { IAgent } from '../agent/IAgent';
import { MemoryStore } from './MemoryStore';
import { IRelationship } from '../models/Relationship';
import { Types } from 'mongoose';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('ArcSummarizer');

export class ArcSummarizer {
  constructor(private agent: IAgent, private memoryStore: MemoryStore) {}

  /**
   * Genera un riassunto dell'arco relazionale tra bot e character.
   * Triggered ogni 10 interazioni (in background, dopo il callback).
   *
   * 1. Carica tutte le memorie non-superseded per la coppia (max 50)
   * 2. Genera un summary LLM di 3-5 frasi
   * 3. Marca la vecchia arc_summary come superseded
   * 4. Salva la nuova
   */
  async generateArcSummary(
    botId: string,
    botName: string,
    characterId: string,
    characterName: string,
    relationship: IRelationship,
  ): Promise<void> {
    try {
      const memories = await this.memoryStore.getAllMemoriesForCharacter(botId, characterId);
      if (memories.length < 3) {
        logger.debug(`[ArcSummarizer] Troppo poche memorie (${memories.length}) per ${characterName} — skip`);
        return;
      }

      const existingArc = await this.memoryStore.getActiveArcSummary(botId, characterId);

      const sentimentLabel = relationship.sentiment > 0.2 ? 'positivo'
        : relationship.sentiment < -0.2 ? 'negativo' : 'neutro';

      const memoriesList = memories
        .map(m => `- [${m.type}] ${m.summary} (${m.sentiment})`)
        .join('\n');

      const systemPrompt = `Sei un narratore. Riassumi l'ARCO RELAZIONALE tra "${botName}" e "${characterName}" basandoti sulle seguenti interazioni.

Produci un riassunto in 3-5 frasi che cattura:
- Quante volte si sono incontrati e l'evoluzione del rapporto
- Pattern comportamentali ricorrenti dell'interlocutore
- Momenti chiave (tradimenti, aiuti, rivelazioni, conflitti)
- Lo stato attuale del rapporto

Rispondi con una SOLA stringa di testo (non JSON), in italiano, dal punto di vista di ${botName}.`;

      const userMessage = `Statistiche relazione:
- Interazioni totali: ${relationship.interactionCount}
- Fiducia: ${Math.round(relationship.trust * 100)}%
- Familiarità: ${Math.round(relationship.familiarity * 100)}%
- Sentimento: ${sentimentLabel} (${relationship.sentiment.toFixed(2)})
- Tipo rapporto: ${relationship.relationshipType || 'sconosciuto'}
- Status percepito: ${relationship.perceivedStatus || 'sconosciuto'}
${(relationship.turningPoints?.length ?? 0) > 0 ? `- Momenti chiave: ${relationship.turningPoints!.sort((a: any, b: any) => b.importanceWeight - a.importanceWeight).slice(0, 5).map((tp: any) => tp.description).join('; ')}` : (relationship.significantEvents?.length ?? 0) > 0 ? `- Eventi significativi: ${relationship.significantEvents!.join('; ')}` : ''}

Memorie (ordine cronologico):
${memoriesList}`;

      const { text: summary } = await this.agent.generate(systemPrompt, userMessage, 400, 0.3);

      if (!summary || summary.length < 30) {
        logger.warn(`[ArcSummarizer] Summary troppo corto per ${characterName} — skip`);
        return;
      }

      const newMemory = await this.memoryStore.addMemory(botId, characterId, characterName, summary, {
        type: 'arc_summary',
        importance: 85,
      });

      // Marca la vecchia arc_summary come superseded
      if (existingArc?._id && newMemory?._id) {
        await this.memoryStore.supersedMemory(existingArc._id, newMemory._id);
      }

      logger.info(`[ArcSummarizer] Arc summary generato per ${characterName} (${summary.length} chars)`);
    } catch (err: any) {
      logger.error(`[ArcSummarizer] Failed for ${characterName}: ${err.message}`);
    }
  }
}
