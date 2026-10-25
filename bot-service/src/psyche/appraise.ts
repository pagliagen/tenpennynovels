import type { Llm } from '../ollama';
import type { TurnContext } from '../pipeline/types';
import { formatTranscript } from '../prompt';
import { APPRAISAL_EVENTS, type AppraisalEvent } from './events';
import { NO_REQUEST, validateInfoRequest, type InfoRequest, type LocationTagOption } from '../knowledge';

function buildSchema(tags: readonly string[]) {
  return {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          properties: { type: { type: 'string', enum: APPRAISAL_EVENTS.map((e) => e) }, intensity: { type: 'integer', minimum: 1, maximum: 3 } },
          required: ['type', 'intensity'],
        },
      },
      introducedName: { type: ['string', 'null'] },
      facts: { type: 'array', items: { type: 'string' }, maxItems: 2 },
      infoRequest: {
        type: 'object',
        properties: {
          tags: { type: 'array', maxItems: 3, items: tags.length > 0 ? { type: 'string', enum: [...tags] } : { type: 'string' } },
          placeName: { type: ['string', 'null'] },
          needsLore: { type: 'boolean' },
        },
        required: ['tags', 'placeName', 'needsLore'],
      },
    },
    required: ['events', 'introducedName', 'facts', 'infoRequest'],
  };
}

export interface Appraisal {
  events: AppraisalEvent[];
  /** Non fidato: va validato col testo del giocatore (validateIntroducedName). */
  introducedName: unknown;
  facts: unknown;
  /** Cosa chiede del mondo (luoghi, ambientazione), già verificato contro l'elenco dei tag e il testo del giocatore. */
  infoRequest: InfoRequest;
}

const EVENT_HELP: Record<(typeof APPRAISAL_EVENTS)[number], string> = {
  ordinario: 'scambio normale, una domanda o un saluto',
  gentilezza: 'cortesia, ringraziamento, gesto cortese',
  complimento: 'lode o lusinga',
  mancia: `l'altro dà soldi AL personaggio, paga o gli offre da bere (NON se è lui a chiedere soldi o un giro, e non se dice solo che pagherà)`,
  aiuto: 'offre aiuto o un favore',
  scuse: 'chiede scusa',
  confidenza: 'si confida o racconta qualcosa di personale',
  flirt: 'corteggia o fa allusioni',
  richiesta_aiuto: 'chiede aiuto, un favore, soldi, credito o un giro gratis',
  scherno: 'prende in giro, sminuisce, tono sprezzante',
  accusa: 'accusa di qualcosa o insinua colpe',
  insulto: 'offende apertamente',
  minaccia: 'minaccia o usa violenza',
};

/**
 * PRIMA della risposta: cosa ha fatto l'altro, scelto da un elenco chiuso. L'AI
 * classifica, non misura: i numeri li decide il codice (psyche/events.ts), così
 * l'umore è prevedibile e testabile. Un fallimento qui non blocca la risposta.
 */
export async function appraiseIncoming(llm: Llm, ctx: TurnContext, playerText: string, locationTags: readonly LocationTagOption[] = []): Promise<Appraisal | null> {
  const { bot } = ctx;
  const other = ctx.otherName ?? 'lo straniero';

  const system = [
    `Classifichi cosa ha appena fatto o detto ${other} a ${bot.name}, in una chat di gioco di ruolo ambientata nella Londra vittoriana. ${bot.persona}`,
    '',
    'Produci SOLO un JSON:',
    '- "events": da 1 a 3 eventi, scelti SOLO da questo elenco, con "intensity" 1 (lieve), 2 (netta), 3 (forte):',
    ...APPRAISAL_EVENTS.map((e) => `  - ${e}: ${EVENT_HELP[e]}`),
    `  Giudica ciò che fa ${other} verso ${bot.name} (non verso terzi). Un saluto o una domanda normale è "ordinario" con intensity 1.`,
    `- "introducedName": il nome che ${other} ha detto esplicitamente di sé ("mi chiamo...", "sono..."), altrimenti null. Non dedurlo.`,
    `- "facts": fino a 2 fatti brevi e certi su ${other}, esplicitati in QUESTO messaggio (es. "è un marinaio"). Lista vuota se non c'è nulla.`,
    ...(locationTags.length > 0
      ? [
          `- "infoRequest": cosa ${other} CHIEDE di sapere sul mondo, altrimenti {"tags": [], "placeName": null, "needsLore": false}:`,
          '  - "tags": se cerca un TIPO di luogo (dove dormire, mangiare, passeggiare…), da 1 a 3 tra:',
          ...locationTags.map((t) => `    - ${t.tag}: ${t.hint}`),
          '  - "placeName": il nome di un luogo preciso di cui chiede, ESATTAMENTE come lo ha scritto, altrimenti null.',
          '  - "needsLore": true solo se chiede di storia, leggende, usi o com\'è fatta la città o il mondo (non di un luogo da raggiungere).',
        ]
      : []),
  ].join('\n');

  const user = [
    '[Chat]',
    formatTranscript(ctx.history),
    '',
    `[Da classificare: ciò che ha detto o fatto ora ${other}]`,
    playerText,
  ].join('\n');

  try {
    const raw = (await llm.generateJson(
      [{ role: 'system', content: system }, { role: 'user', content: user }],
      buildSchema(locationTags.map((t) => t.tag)),
      { temperature: 0.1, numPredict: 320 },
    )) as { events?: unknown; introducedName?: unknown; facts?: unknown; infoRequest?: unknown };

    const events: AppraisalEvent[] = (Array.isArray(raw.events) ? raw.events : []).flatMap((e: unknown) => {
      const { type, intensity } = (e ?? {}) as { type?: unknown; intensity?: unknown };
      if (typeof type !== 'string' || !(APPRAISAL_EVENTS as readonly string[]).includes(type)) return [];
      const n = typeof intensity === 'number' ? Math.min(3, Math.max(1, Math.round(intensity))) : 1;
      return [{ type: type as AppraisalEvent['type'], intensity: n as 1 | 2 | 3 }];
    });
    return {
      events,
      introducedName: raw.introducedName,
      facts: raw.facts,
      infoRequest: locationTags.length > 0 ? validateInfoRequest(raw.infoRequest, locationTags.map((t) => t.tag), playerText) : NO_REQUEST,
    };
  } catch {
    return null;
  }
}
