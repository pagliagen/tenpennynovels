import { OllamaChat } from './OllamaChat';
import { logger } from '../../utils/logger';

interface SceneSummarizationInput {
  locationName?: string;
  transcript: string;
}

interface SceneSummarizationResult {
  title: string;
  summary: string;
}

const ollamaChat = new OllamaChat();

const SYSTEM_PROMPT = `Sei un cronista che riassume scene di gioco di ruolo ambientate nella Londra vittoriana di fine '800 (stile Call of Cthulhu).
Riceverai il trascritto di una scena di chat tra personaggi. Il tuo compito: scrivere un titolo breve (max 80 caratteri, evocativo ma sobrio, senza virgolette) e un riassunto oggettivo in terza persona (3-6 frasi) di cosa e successo nella scena, in italiano.
Rispondi SOLO con un JSON valido nel formato: {"title": "...", "summary": "..."}.`;

function buildUserMessage(input: SceneSummarizationInput): string {
  const location = input.locationName ? `Location: ${input.locationName}\n\n` : '';
  return `${location}${input.transcript}`;
}

function fallbackTitle(locationName?: string): string {
  return `Giocata a ${locationName || 'location sconosciuta'}`;
}

export async function summarizeScene(input: SceneSummarizationInput): Promise<SceneSummarizationResult> {
  const startMs = Date.now();
  const { text, tokensUsed } = await ollamaChat.chatJSON(SYSTEM_PROMPT, buildUserMessage(input), 500);
  const elapsed = Date.now() - startMs;

  logger.info('Scene summarization completed', { elapsedMs: elapsed, tokensUsed });

  let parsed: Partial<SceneSummarizationResult>;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      logger.warn('Failed to parse scene summarization response, using fallback title/empty summary');
      return { title: fallbackTitle(input.locationName), summary: '' };
    }
  }

  const title = typeof parsed.title === 'string' && parsed.title.trim()
    ? parsed.title.trim().slice(0, 150)
    : fallbackTitle(input.locationName);
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 10000) : '';

  return { title, summary };
}
