import { OllamaChat } from './OllamaChat';
import { logger } from '../../utils/logger';

interface SceneMessage {
  characterName: string;
  content: string;
}

interface SceneCandidate {
  sceneId: string;
  recentMessages: SceneMessage[];
}

interface SceneClassificationInput {
  newMessage: SceneMessage;
  candidateScenes: SceneCandidate[];
}

interface SceneClassificationResult {
  matchedSceneId: string | null;
  confidence: number;
}

const ollamaChat = new OllamaChat();

const SYSTEM_PROMPT = `Sei un assistente che analizza una chat di gioco di ruolo ambientata a Londra vittoriana (fine '800, stile Call of Cthulhu).
Riceverai una o più "scene" in corso (sequenze recenti di messaggi tra personaggi) nella stessa location, e un nuovo messaggio scritto da un personaggio che non ha ancora partecipato a nessuna di esse.
Il tuo compito: stabilire se il nuovo messaggio CONTINUA narrativamente una delle scene esistenti (il personaggio si inserisce nella stessa conversazione/azione in corso) oppure è INDIPENDENTE (inizia una sua storia a parte, che capita solo di svolgersi nella stessa location, senza alcuna relazione con quanto già scritto).
Rispondi SOLO con un JSON valido nel formato: {"matchedSceneId": "<id della scena>" oppure null, "confidence": <numero da 0 a 1>}.
Se non sei sicuro, preferisci null piuttosto che un match debole: è meglio separare due scene per errore che fonderle.`;

function buildUserMessage(newMessage: SceneMessage, candidateScenes: SceneCandidate[]): string {
  const scenesBlock = candidateScenes
    .map((scene) => {
      const lines = scene.recentMessages.map((m) => `${m.characterName}: ${m.content}`).join('\n');
      return `--- Scena "${scene.sceneId}" ---\n${lines}`;
    })
    .join('\n\n');

  return `${scenesBlock}\n\n--- Nuovo messaggio ---\n${newMessage.characterName}: ${newMessage.content}`;
}

export async function classifySceneContinuation(input: SceneClassificationInput): Promise<SceneClassificationResult> {
  const { newMessage, candidateScenes } = input;

  const startMs = Date.now();
  const { text, tokensUsed } = await ollamaChat.chatJSON(
    SYSTEM_PROMPT,
    buildUserMessage(newMessage, candidateScenes),
    100
  );
  const elapsed = Date.now() - startMs;

  logger.info('Scene classification completed', { elapsedMs: elapsed, tokensUsed });

  let parsed: Partial<SceneClassificationResult>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      logger.warn('Failed to parse scene classification response, defaulting to independent');
      return { matchedSceneId: null, confidence: 0 };
    }
  }

  const validSceneIds = new Set(candidateScenes.map((s) => s.sceneId));
  const matchedSceneId = typeof parsed.matchedSceneId === 'string' && validSceneIds.has(parsed.matchedSceneId)
    ? parsed.matchedSceneId
    : null;
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;

  return { matchedSceneId, confidence };
}
