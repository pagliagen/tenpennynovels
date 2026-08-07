import { HydratedDocument } from 'mongoose';
import { Chat, ChatScene, IChatScene } from '@database/models';
import { logger } from '../logger';
import { EmbeddingService } from '@modules/documents/services/EmbeddingService';

/**
 * Segmenta la chat "standard" di una location in scene narrative per
 * personaggio. Al più UNA scena può essere aperta per location alla volta.
 * Si chiude deterministicamente dopo SCENE_TIMEOUT_MS di silenzio
 * (closeStaleScenes, via cron), oppure subito quando un personaggio nuovo
 * scrive un messaggio classificato come narrativamente indipendente da
 * quella in corso — in tal caso la vecchia scena si chiude immediatamente
 * (non resta aperta in parallelo) e se ne apre una nuova per il messaggio
 * indipendente. Le sottoposizioni (Chat.position) sono cosmetiche e non
 * intervengono qui.
 *
 * `ChatScene.participantCharacterIds` NON viene mantenuto incrementalmente:
 * all'apertura la scena è "battezzata" (solo id/location/orari), alla
 * chiusura viene "popolata" derivando i partecipanti direttamente dai
 * messaggi taggati (Chat.chatSceneId) — Chat resta l'unica fonte di verità,
 * niente push concorrenti su un array da mantenere a mano.
 */

const SCENE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minuti
const CONTEXT_MESSAGES_PER_SCENE = 15;
const MIN_CONFIDENCE = 0.5;

interface HandleStandardMessageInput {
  chatMessageId: string;
  locationId: string;
  locationName?: string;
  characterId: string;
  characterName: string;
  content: string;
  timestamp: Date;
}

export class ChatSceneService {
  /**
   * Chiamata fire-and-forget da ChatController dopo il salvataggio di ogni
   * azione "standard". Non deve mai ritardare la risposta HTTP o il
   * broadcast WebSocket del messaggio: eventuali errori restano interni.
   */
  static async handleStandardMessage(input: HandleStandardMessageInput): Promise<void> {
    const { chatMessageId, locationId, locationName, characterId, characterName, content, timestamp } = input;

    const openScene = await ChatScene.findOne({ locationId: { $eq: locationId }, status: 'open' });

    if (!openScene) {
      const scene = await ChatSceneService.openScene(locationId, locationName, timestamp);
      await ChatSceneService.tagMessage(chatMessageId, scene._id.toString());
      return;
    }

    const alreadyIn = await Chat.exists({
      chatSceneId: { $eq: openScene._id.toString() },
      characterId: { $eq: characterId }
    });

    if (alreadyIn) {
      openScene.lastActivityAt = timestamp;
      await openScene.save();
      await ChatSceneService.tagMessage(chatMessageId, openScene._id.toString());
      return;
    }

    // Unico ramo IA: personaggio nuovo, una scena è già aperta in questa location.
    const continuesOpenScene = await ChatSceneService.classifyContinuation(openScene, characterName, content);

    if (continuesOpenScene) {
      openScene.lastActivityAt = timestamp;
      await openScene.save();
      await ChatSceneService.tagMessage(chatMessageId, openScene._id.toString());
      return;
    }

    // Indipendente (o errore/timeout della classificazione — si preferisce
    // sempre il rischio di spezzettare una conversazione unica piuttosto che
    // fondere RP di gruppi diversi): la scena in corso si chiude SUBITO — al
    // più una sola scena aperta per location — e se ne apre una nuova.
    await ChatSceneService.closeScene(openScene);
    const newScene = await ChatSceneService.openScene(locationId, locationName, timestamp);
    await ChatSceneService.tagMessage(chatMessageId, newScene._id.toString());
  }

  private static async openScene(
    locationId: string,
    locationName: string | undefined,
    timestamp: Date
  ): Promise<HydratedDocument<IChatScene>> {
    return ChatScene.create({
      locationId,
      locationName,
      startedAt: timestamp,
      lastActivityAt: timestamp,
      status: 'open'
    });
  }

  /** Chiude una scena "popolandola": deriva i partecipanti dai messaggi reali (Chat.chatSceneId). */
  private static async closeScene(scene: HydratedDocument<IChatScene>): Promise<void> {
    const participantCharacterIds = await Chat.distinct('characterId', {
      chatSceneId: scene._id.toString()
    });
    scene.participantCharacterIds = participantCharacterIds;
    scene.status = 'closed';
    scene.closedAt = new Date();
    await scene.save();
  }

  private static async tagMessage(chatMessageId: string, chatSceneId: string): Promise<void> {
    // { new: true }: senza, l'hook post('findOneAndUpdate') di Chat.ts riceve
    // il documento PRE-update e specchia su ChatBackup il chatSceneId vecchio,
    // disallineando le due tabelle (vedi Chat.ts:571-619).
    await Chat.findByIdAndUpdate(chatMessageId, { chatSceneId }, { new: true });
  }

  private static async classifyContinuation(
    openScene: HydratedDocument<IChatScene>,
    newCharacterName: string,
    newContent: string
  ): Promise<boolean> {
    try {
      const recent = await Chat.find({ chatSceneId: { $eq: openScene._id.toString() } })
        .sort({ timestamp: -1 })
        .limit(CONTEXT_MESSAGES_PER_SCENE)
        .select('characterName content')
        .lean();

      const candidateScenes = [{
        sceneId: openScene._id.toString(),
        recentMessages: recent
          .reverse()
          .map((m) => ({ characterName: m.characterName, content: m.content }))
      }];

      const response = await EmbeddingService.classifySceneContinuation(
        { characterName: newCharacterName, content: newContent },
        candidateScenes
      );

      const matchedSceneId = response?.result?.matchedSceneId;
      const confidence = response?.result?.confidence ?? 0;
      return !!response?.success && matchedSceneId === openScene._id.toString() && confidence >= MIN_CONFIDENCE;
    } catch (error) {
      logger.error('[ChatScene] Classification failed, treating as independent', { error });
      return false;
    }
  }

  /**
   * Chiamata dal cron ogni 5 minuti: chiude le scene ferme da troppo tempo
   * (nessun personaggio nuovo le ha mai chiuse per indipendenza narrativa).
   * Ritorna il numero di scene chiuse.
   */
  static async closeStaleScenes(): Promise<number> {
    const cutoff = new Date(Date.now() - SCENE_TIMEOUT_MS);
    const staleScenes = await ChatScene.find({ status: 'open', lastActivityAt: { $lt: cutoff } });

    for (const scene of staleScenes) {
      await ChatSceneService.closeScene(scene);
    }

    if (staleScenes.length > 0) {
      logger.info(`[ChatScene] Closed ${staleScenes.length} stale scene(s)`);
    }
    return staleScenes.length;
  }

  static async getScenesForCharacter(characterId: string) {
    return ChatScene.find({ participantCharacterIds: { $eq: characterId } })
      .sort({ startedAt: -1 })
      .lean();
  }

  /**
   * Ritorna null se la scena non esiste o se il personaggio non ne è
   * partecipante (il controller traduce entrambi i casi in 404, senza
   * distinguerli: non deve rivelare l'esistenza di scene altrui).
   */
  static async getSceneTranscript(sceneId: string, characterId: string) {
    const scene = await ChatScene.findById(sceneId).lean();
    if (!scene || !scene.participantCharacterIds.includes(characterId)) {
      return null;
    }

    const messages = await Chat.find({ chatSceneId: { $eq: sceneId } })
      .sort({ timestamp: 1 })
      .lean();

    const transcript = messages
      .map((m) => `[${new Date(m.timestamp).toLocaleString('it-IT')}] ${m.characterName}: ${m.content}`)
      .join('\n');

    return { scene, transcript, messageCount: messages.length };
  }
}
