import type { Llm } from '../ollama';
import { buildMessages, sanitizeReply } from '../prompt';
import { findIssues, issueFeedback, type Issue } from '../quality';
import { planReply } from './plan';
import { critiqueReply } from './critique';
import { rewriteReply } from './rewrite';
import { formatReply } from './format';
import type { Plan, StepTrace, TurnContext } from './types';

export interface PipelineOptions {
  /** Step 1: scaletta. */
  plan: boolean;
  /** Step 3: critico di contenuto; se trova problemi, riscrive (max `maxRewrites` volte). */
  critique: boolean;
  maxRewrites: number;
  /** Step 4: riscrittura nel formato corretto (ultimo, così garantisce la forma finale). */
  format: boolean;
  /** Rigenerazioni (via step formato + feedback) se restano difetti. */
  maxRevisions: number;
}

/**
 * Il critico è spento di default: misurato con qwen3.5:9b-q8_0 su 8 prove,
 * segnala problemi inesistenti in 8/8 casi e la riscrittura che ne segue
 * peggiora il testo (pulite 6/8 contro 8/8 senza, a 18,6 s invece di 9,6).
 * Un modello più grande, o un critico su un modello diverso, potrebbe servire.
 */
export const DEFAULT_PIPELINE: PipelineOptions = { plan: true, critique: false, maxRewrites: 1, format: true, maxRevisions: 2 };

export interface PipelineResult {
  content: string;
  /** Difetti rimasti nella battuta finale. */
  issues: Issue[];
  /** Problemi di contenuto trovati dal critico (anche se poi corretti). */
  critique: string[];
  plan: Plan | null;
  trace: StepTrace[];
}

/**
 * Pipeline a step: scaletta → bozza → critico (+ riscrittura) → formato → controllo (+ revisione).
 * Ogni step ha un compito solo; il contesto del turno è `TurnContext`, dove
 * si aggiungono umore e rapporto col personaggio.
 */
export async function generateReply(
  llm: Llm,
  ctx: TurnContext,
  options: PipelineOptions = DEFAULT_PIPELINE,
): Promise<PipelineResult | null> {
  const trace: StepTrace[] = [];
  const timed = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
    const startedAt = Date.now();
    try {
      return await fn();
    } finally {
      trace.push({ step, ms: Date.now() - startedAt });
    }
  };
  const { bot } = ctx;

  const plan = options.plan ? await timed('plan', () => planReply(llm, ctx)) : null;

  const draftRaw = await timed('draft', () =>
    llm.generate(buildMessages(bot, ctx.history, { ...(plan ? { plan } : {}), psycheLines: ctx.psycheLines, genderKnown: ctx.genderKnown }), {
      temperature: bot.temperature,
      numPredict: Math.max(200, bot.targetWords * 4),
    }),
  );
  let content = sanitizeReply(draftRaw, bot.name);
  if (!content) return null;

  const critiqueFound: string[] = [];
  if (options.critique) {
    for (let i = 0; i < options.maxRewrites; i++) {
      const problems = await timed(`critique${i + 1}`, () => critiqueReply(llm, ctx, content, plan));
      if (problems.length === 0) break;
      critiqueFound.push(...problems);
      const rewritten = sanitizeReply(await timed(`rewrite${i + 1}`, () => rewriteReply(llm, ctx, content, problems)), bot.name);
      if (!rewritten) break;
      content = rewritten;
    }
  }

  if (options.format) {
    const formatted = sanitizeReply(await timed('format', () => formatReply(llm, ctx, content)), bot.name);
    if (formatted) content = formatted;
  }

  let issues = findIssues(content, ctx.previousOwn, ctx.knownText);
  for (let i = 0; i < options.maxRevisions && issues.length > 0; i++) {
    const revised = sanitizeReply(
      await timed(`revise${i + 1}`, () => formatReply(llm, ctx, content, issueFeedback(issues))),
      bot.name,
    );
    if (!revised) break;
    const revisedIssues = findIssues(revised, ctx.previousOwn, ctx.knownText);
    // Si tiene la versione migliore, non necessariamente l'ultima.
    if (revisedIssues.length <= issues.length) {
      content = revised;
      issues = revisedIssues;
    }
  }

  return { content, issues, critique: critiqueFound, plan, trace };
}
