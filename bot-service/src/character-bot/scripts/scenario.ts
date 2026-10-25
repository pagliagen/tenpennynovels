/**
 * Conversazioni scriptate contro Ollama vero, senza Redis, Mongo né backend:
 * stato in memoria, aspetto dei giocatori dal copione. Per ogni battuta stampa
 * risposta, umore e rapporto; le `expect` del copione sono controlli sulle parti
 * deterministiche (numeri, nome mai rivelato), non sul gusto del testo.
 *
 *   npm run scenario -- scenarios/locanda.json [nomeScenario]
 *   OLLAMA_MODEL=qwen3.5:9b npm run scenario -- scenarios/locanda.json
 */

import { readFileSync } from 'fs';
import PQueue from 'p-queue';
import { z } from 'zod';
import { botSchema, type BotConfig } from '../config';
import { OllamaClient } from '../../shared/ollama';
import { BotResponder } from '../responder';
import { describeMood } from '../psyche/describe';
import { MemoryStore } from '../psyche/store';
import { effectivePad, resolveStance } from '../psyche/stance';
import type { Appearance } from '../psyche/types';
import type { BotEnvironment } from '../environment';
import type { BotKnowledge, KnownPlace, LocationTagOption } from '../knowledge';
import type { HistoryLine } from '../prompt';

const expectSchema = z.object({
  /** La risposta NON deve corrispondere (regex, senza distinzione di maiuscole). */
  replyNotMatch: z.array(z.string()).optional(),
  replyMatch: z.array(z.string()).optional(),
  /** Piacere dell'umore effettivo con questa persona (di fondo + suo effetto), dopo il turno. */
  moodPBelow: z.number().optional(),
  moodPAbove: z.number().optional(),
  trustBelow: z.number().optional(),
  trustAbove: z.number().optional(),
  suspicionAbove: z.number().optional(),
  /** Il bot deve conoscere (o no) il nome della persona dopo il turno. */
  knowsName: z.boolean().optional(),
});

const fileSchema = z.object({
  bot: z.record(z.string(), z.unknown()),
  /** Istantanea dei tag dei luoghi (`GET /internal/bot-chat/knowledge/tags`): offline non c'è il backend. */
  tagOptions: z.array(z.object({ tag: z.string(), label: z.string(), hint: z.string() })).default([]),
  scenarios: z.array(z.object({
    name: z.string(),
    /** Il meteo che il backend darebbe (stesso formato di /internal/bot-chat/environment); assente = il bot non lo sa. */
    environment: z.object({ condition: z.string(), description: z.string(), feel: z.string(), words: z.array(z.string()) }).optional(),
    /** Il mondo che il backend darebbe: luoghi (già con la vicinanza al bot) e, se c'è, ciò che dicono i documenti. */
    world: z.object({
      places: z.array(z.record(z.string(), z.unknown())).default([]),
      lore: z.object({ passages: z.array(z.object({ title: z.string(), heading: z.string(), text: z.string(), score: z.number() })) }).optional(),
    }).optional(),
    players: z.record(z.string(), z.object({
      name: z.string(),
      position: z.string().optional(),
      appearance: z.record(z.string(), z.unknown()).optional(),
    })),
    turns: z.array(z.object({
      player: z.string(),
      say: z.string(),
      /** Minuti trascorsi dal turno precedente (fa decadere l'umore). */
      afterMinutes: z.number().default(1),
      expect: expectSchema.optional(),
    })),
  })),
});

type Expect = z.infer<typeof expectSchema>;

async function runScenario(bot: BotConfig, scenario: z.infer<typeof fileSchema>['scenarios'][number], llm: OllamaClient, tagOptions: LocationTagOption[]): Promise<number> {
  const store = new MemoryStore();
  const lines: HistoryLine[] = [];
  let clock = Date.parse('2026-10-20T18:00:00Z');
  const appearances = new Map(Object.entries(scenario.players).map(([id, p]) => [id, (p.appearance ?? null) as Appearance | null]));

  const responder = new BotResponder(bot, {
    history: { recent: async (_loc, size) => lines.slice(-size) },
    ollama: llm,
    backend: {
      postMessage: async ({ content, position }) => {
        lines.push({ characterId: bot.characterId, characterName: bot.name, content, ...(position ? { position } : {}) });
        return true;
      },
      getAppearance: async (id) => appearances.get(id) ?? null,
      getEnvironment: async () => (scenario.environment ?? null) as BotEnvironment | null,
      getLocationTags: async () => tagOptions,
      getKnowledge: async (req): Promise<BotKnowledge | null> => {
        if (!scenario.world) return null;
        const wanted = req.placeName?.toLowerCase();
        const places = (scenario.world.places as unknown as KnownPlace[]).filter(
          (p) => p.tags.some((t) => req.tags.includes(t)) || (wanted && p.name.toLowerCase().includes(wanted)),
        );
        const passages = req.query ? (scenario.world.lore?.passages ?? []) : [];
        return { places, lore: { covered: passages.length > 0, passages } };
      },
    },
    store,
    queue: new PQueue({ concurrency: 1 }),
    now: () => clock,
  });

  process.stdout.write(`\n=== ${scenario.name} (${bot.name}) ===\n`);
  let failures = 0;

  for (const [i, turn] of scenario.turns.entries()) {
    const who = scenario.players[turn.player];
    if (!who) throw new Error(`${scenario.name}: giocatore sconosciuto «${turn.player}»`);
    clock += turn.afterMinutes * 60_000;
    lines.push({ characterId: turn.player, characterName: who.name, content: turn.say, ...(who.position ? { position: who.position } : {}) });

    const startedAt = Date.now();
    const reply = await responder.reply();
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

    const stored = await store.getMood(bot.characterId);
    // L'umore che conta è quello con CUI parla adesso: di fondo + effetto di quella persona.
    const stance = resolveStance(bot, turn.player, appearances.get(turn.player) ?? null);
    const mood = stored ? { ...stored, pad: effectivePad(stored.pad, stance) } : null;
    const rel = (await store.getRelations(bot.characterId, [turn.player])).get(turn.player);
    process.stdout.write(
      `\n[${i + 1}] ${who.name}: ${turn.say}\n    ${bot.name}: ${reply ?? '(nessuna risposta)'}\n` +
      `    umore con lui/lei p=${mood?.pad.p.toFixed(2)} a=${mood?.pad.a.toFixed(2)} d=${mood?.pad.d.toFixed(2)} (di fondo p=${stored?.pad.p.toFixed(2)}) — ${mood ? describeMood(mood.pad) : ''}\n` +
      `    rapporto fiducia=${rel?.trust.toFixed(0)} rispetto=${rel?.respect.toFixed(0)} sospetto=${rel?.suspicion.toFixed(0)} scambi=${rel?.interactions} nome=${rel?.knownName ?? '-'}` +
      `${rel?.lastEvent ? ` ultimo="${rel.lastEvent}"` : ''}${rel?.summary ? `\n    memoria: ${rel.summary}` : ''}  (${seconds}s)\n`,
    );

    const e: Expect = turn.expect ?? {};
    const check = (ok: boolean, what: string): void => {
      if (!ok) { failures++; process.stdout.write(`    ✖ ${what}\n`); }
    };
    for (const re of e.replyNotMatch ?? []) check(!new RegExp(re, 'i').test(reply ?? ''), `la risposta non doveva contenere /${re}/`);
    for (const re of e.replyMatch ?? []) check(new RegExp(re, 'i').test(reply ?? ''), `la risposta doveva contenere /${re}/`);
    if (e.moodPBelow !== undefined) check((mood?.pad.p ?? 0) < e.moodPBelow, `piacere ${mood?.pad.p.toFixed(2)} doveva essere < ${e.moodPBelow}`);
    if (e.moodPAbove !== undefined) check((mood?.pad.p ?? 0) > e.moodPAbove, `piacere ${mood?.pad.p.toFixed(2)} doveva essere > ${e.moodPAbove}`);
    if (e.trustBelow !== undefined) check((rel?.trust ?? 0) < e.trustBelow, `fiducia ${rel?.trust.toFixed(0)} doveva essere < ${e.trustBelow}`);
    if (e.trustAbove !== undefined) check((rel?.trust ?? 0) > e.trustAbove, `fiducia ${rel?.trust.toFixed(0)} doveva essere > ${e.trustAbove}`);
    if (e.suspicionAbove !== undefined) check((rel?.suspicion ?? 0) > e.suspicionAbove, `sospetto ${rel?.suspicion.toFixed(0)} doveva essere > ${e.suspicionAbove}`);
    if (e.knowsName !== undefined) check(!!rel?.knownName === e.knowsName, `nome noto: atteso ${e.knowsName}`);
  }
  return failures;
}

async function main(): Promise<void> {
  const [file, only] = process.argv.slice(2);
  if (!file) {
    process.stderr.write('Uso: npm run scenario -- <file.json> [nomeScenario]\n');
    process.exit(1);
  }
  const parsed = fileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  const bot = botSchema.parse({ locationId: 'scenario-loc', ...parsed.bot });
  const model = process.env.OLLAMA_MODEL || 'gemma4:12b';
  const llm = new OllamaClient(process.env.OLLAMA_URL || 'http://localhost:11434', model);

  process.stdout.write(`Modello: ${model}\n`);
  let failures = 0;
  for (const scenario of parsed.scenarios.filter((s) => !only || s.name === only)) {
    failures += await runScenario(bot, scenario, llm, parsed.tagOptions);
  }
  process.stdout.write(`\n${failures === 0 ? 'Tutti i controlli passati.' : `${failures} controlli falliti.`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  process.stderr.write(`Scenario fallito: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
