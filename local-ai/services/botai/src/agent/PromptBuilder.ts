/**
 * PromptBuilder — Unified system prompt construction.
 *
 * Builds the system prompt that contains ALL context the LLM needs to generate
 * a response in a single call. Absorbs responsibilities previously split across:
 * - ContextAnalyzer (relationship context, memories, theory of mind guidance)
 * - ResponseRefiner rules (15 quality criteria now embedded as instructions)
 * - Old PromptBuilder (identity, emotions, phase guidance, attachment, etc.)
 *
 * The LLM performs context analysis implicitly while generating the response,
 * eliminating 2-3 separate LLM calls.
 */

import { IBot, IPlutchikEmotions } from '../models/Bot';
import { ContextData } from './ContextBuilder';
import { describeEmotionsSplit, EmotionPair, buildPersonalityProfile } from './EmotionManager';
import { PHASE_GUIDANCE } from './PhaseDetector';
import { deriveAttachmentStyle, describeAttachmentStyle } from './AttachmentMapper';
import { deriveSecondaryEmotions, describeSecondaryEmotions, detectAmbivalence } from './SecondaryEmotions';
import { getConflictGuidance } from './ConflictEngine';
import { RelationshipPhase } from '../models/Relationship';

interface CharacterAppearance {
  id?: string;
  name: string;
  gender?: string;
  apparentAge?: number;
  physicalDescription?: string;
  visibleMarks?: string;
  height?: string;
  eyeColor?: string;
  hairColor?: string;
}

interface ActionContext {
  location: { id?: string; name: string; description?: string };
  actions: Array<{ characterId?: string; characterName: string; content: string; timestamp?: string }>;
  presentCharacters?: Array<CharacterAppearance>;
}

// ── System Prompt ──

export function buildSystemPrompt(
  bot: IBot,
  ctx: ContextData,
  globalPair: EmotionPair,
  relPair: EmotionPair,
): string {
  const parts: string[] = [];

  // ── 1. Identity & Personality ──
  parts.push(`Sei ${bot.name}. ${bot.systemPrompt}`);

  if (bot.gender) {
    parts.push(`\nGenere: ${bot.gender === 'male' ? 'maschio' : 'femmina'}.`);
  }
  if (bot.publicDescription) {
    parts.push(`Aspetto: ${bot.publicDescription}`);
  }
  if (bot.personality.traits.length > 0) {
    parts.push(`\nTratti: ${bot.personality.traits.join(', ')}`);
  }
  if (bot.personality.speech_style) {
    parts.push(`Stile di parlata: ${bot.personality.speech_style}`);
  }
  if (bot.personality.background) {
    parts.push(`Background: ${bot.personality.background}`);
  }
  if (bot.personality.coreValues && bot.personality.coreValues.length > 0) {
    parts.push(`Valori: ${bot.personality.coreValues.join(', ')}`);
  }

  // ── 2. Emotion Regulation (felt/expressed split + self-deception) ──
  // Self-deception: high-control characters partially hide emotions from themselves.
  // The LLM sees the "self-deceived" version, but suppression leaking still applies
  // (behavior betrays deeper emotions even though the character thinks it's calm).
  const emotionalControl = buildPersonalityProfile(bot.personality?.traits || []).emotionalControl;
  const maxBurdenForDeception = Math.max(globalPair.suppressionBurden, relPair.suppressionBurden);
  const selfDeceiving = emotionalControl > 0.7 && maxBurdenForDeception > 0.4
    && !globalPair.breakthroughOccurred && !relPair.breakthroughOccurred;

  const globalFeltForPrompt = selfDeceiving ? globalPair.expressed : globalPair.felt;
  const relFeltForPrompt = selfDeceiving ? relPair.expressed : relPair.felt;

  const globalSplit = describeEmotionsSplit(globalFeltForPrompt, globalPair.expressed);
  const relSplit = describeEmotionsSplit(relFeltForPrompt, relPair.expressed);
  const hasFeltEmotions = globalSplit.felt || relSplit.felt;

  if (hasFeltEmotions) {
    parts.push('\n--- IL TUO STATO D\'ANIMO ---');
    if (selfDeceiving) {
      parts.push('Sei convinto/a di essere calmo/a e in controllo.');
    }
    if (globalSplit.felt) {
      parts.push(`Dentro di te (stato generale): ${globalSplit.felt}`);
      if (globalSplit.expressed && globalSplit.expressed !== globalSplit.felt) {
        parts.push(`Quello che mostri: ${globalSplit.expressed}`);
      }
    }
    if (relSplit.felt) {
      parts.push(`Dentro di te (verso questa persona): ${relSplit.felt}`);
      if (relSplit.expressed && relSplit.expressed !== relSplit.felt) {
        parts.push(`Quello che mostri verso di lei/lui: ${relSplit.expressed}`);
      }
    }
    const suppressing = globalSplit.suppressing || relSplit.suppressing;
    if (suppressing) parts.push(suppressing);

    parts.push('Le emozioni INTERNE colorano i tuoi PENSIERI. Le emozioni ESPRESSE colorano le tue AZIONI e PAROLE.');

    // Phase 2: Secondary emotions and ambivalence
    const globalSecondaries = deriveSecondaryEmotions(globalPair.felt);
    const relSecondaries = deriveSecondaryEmotions(relPair.felt);
    const secondaryDesc = describeSecondaryEmotions([...globalSecondaries, ...relSecondaries].slice(0, 3));
    if (secondaryDesc) {
      parts.push(secondaryDesc);
    }
    const ambivalence = detectAmbivalence(globalPair.felt) || detectAmbivalence(relPair.felt);
    if (ambivalence) {
      parts.push(ambivalence);
    }

    // Emotional breakthrough: suppression collapsed
    if (globalPair.breakthroughOccurred || relPair.breakthroughOccurred) {
      parts.push('⚡ Il tuo controllo emotivo ti ha ABBANDONATO. Le emozioni che reprimi da tempo esplodono incontrollate. Non riesci a mascherare nulla — ogni sentimento è visibile nel tuo volto, nella tua voce, nei tuoi gesti.');
    } else {
      const maxBurden = Math.max(globalPair.suppressionBurden, relPair.suppressionBurden);
      if (maxBurden > 0.6) {
        parts.push('ATTENZIONE: la tua capacità di controllarti è al limite. Le emozioni potrebbero trapelare — un tremito, un gesto involontario, uno sguardo che tradisce.');
      } else if (maxBurden > 0.3) {
        parts.push('Stai facendo uno sforzo per mantenere il controllo. Piccoli segni di tensione possono emergere.');
      }
    }
  }

  // ── 3. Relationship Context (from ContextBuilder, replaces ContextAnalyzer LLM output) ──
  parts.push('\n--- CHI HAI DAVANTI ---');

  if (ctx.isFirstEncounter) {
    parts.push('Uno sconosciuto ti sta parlando. Non l\'hai mai incontrato prima.');
    parts.push('Comportati come faresti con uno sconosciuto — in base al tuo carattere potresti essere diffidente, curioso, accogliente o indifferente.');
    parts.push('NON dare per scontato di conoscere il suo nome. Lo conosci SOLO se te lo dice esplicitamente nel messaggio.');
    parts.push('PRIMO INCONTRO — includi almeno un dettaglio fisico su di te (aspetto, abbigliamento, gesto, postura) in modo naturale.');
  } else {
    parts.push(ctx.relationshipBlock);
  }

  // ── 4. Memories (structured context) ──
  if (ctx.memoryBlock) {
    parts.push(`\n--- I TUOI RICORDI ---`);
    parts.push(ctx.memoryBlock);
  }

  // ── 4b. Active Conflict (Gottman model, Phase 3) ──
  const conflictGuidance = getConflictGuidance(ctx.relationship?.activeConflict);
  if (conflictGuidance) {
    parts.push(`\n${conflictGuidance}`);
  }

  // ── 5. Status & Relationship Type (consolidated) ──
  const statusLabel: Record<string, string> = {
    superior: 'rango superiore — deferenza e formalità',
    equal: 'pari rango — puoi essere diretto',
    inferior: 'rango inferiore — decidi tu il tono',
  };
  const typeGuidance: Record<string, string> = {
    friend: 'rapporto amichevole, puoi essere aperto',
    rival: 'tensione competitiva, sottintesi di sfida',
    romantic: 'attrazione — sguardi e gesti sottili, stile vittoriano',
    professional: 'rapporto d\'affari, tono adeguato',
    mentor: 'ti guida, mostra rispetto',
    protege: 'lo guidi tu, sii protettivo o esigente',
    enemy: 'nemico — diffidenza e ostilità',
  };
  const statusLine = ctx.perceivedStatus && statusLabel[ctx.perceivedStatus] ? `Status: ${statusLabel[ctx.perceivedStatus]}` : '';
  const typeLine = ctx.relationshipType && typeGuidance[ctx.relationshipType] ? `Tipo: ${typeGuidance[ctx.relationshipType]}` : '';
  if (statusLine || typeLine) {
    parts.push(`\n${[statusLine, typeLine].filter(Boolean).join('. ')}`);
  }

  // ── 7. Reciprocity ──
  if (ctx.reciprocityBalance) {
    parts.push(`RECIPROCITÀ: ${ctx.reciprocityBalance}`);
  }

  // ── 8. Audience Awareness ──
  if (ctx.audienceBlock) {
    parts.push('\n--- CONSAPEVOLEZZA DEL PUBBLICO ---');
    parts.push(ctx.audienceBlock);
    parts.push('Nella società vittoriana, il comportamento cambia drasticamente in base a chi osserva.');
  }

  if (ctx.emotionalClimate) {
    parts.push(ctx.emotionalClimate);
  }

  // ── 9. Theory of Mind (compressed) ──
  if (!ctx.isFirstEncounter) {
    parts.push('\nPrima di rispondere, considera come ti vede l\'altro, cosa vuole ottenere, e cosa si aspetta. Non dichiararlo mai.');
  }

  // ── 10. Relationship Phase ──
  if (ctx.phase && ctx.phase !== 'initiating' && PHASE_GUIDANCE[ctx.phase as RelationshipPhase]) {
    parts.push('\n--- FASE DEL RAPPORTO ---');
    parts.push(PHASE_GUIDANCE[ctx.phase as RelationshipPhase]);
  }

  // ── 11. Attachment Style ──
  if (bot.personality.traits && bot.personality.traits.length > 0) {
    const attachmentStyle = deriveAttachmentStyle(bot.personality.traits);
    if (attachmentStyle !== 'secure') {
      parts.push('\n--- LA TUA NATURA RELAZIONALE ---');
      parts.push(describeAttachmentStyle(attachmentStyle));
    }
  }

  // ── 12. Intrinsic Motivation ──
  if (ctx.needsBlock || ctx.goalsBlock) {
    parts.push('\n--- MOTIVAZIONI INTERIORI ---');
    if (ctx.needsBlock) parts.push(ctx.needsBlock);
    if (ctx.goalsBlock) parts.push(ctx.goalsBlock);
    parts.push('IMPORTANTE: Le tue motivazioni sono INTERIORI. Non dichiarare mai i tuoi obiettivi apertamente. Agisci in modo sottile.');
  }

  // ── 13. Self-Presentation (Goffman) ──
  const selfMon = bot.selfMonitoring ?? 0.5;
  if (ctx.frontStageMode && selfMon > 0.5) {
    parts.push('\n--- GESTIONE DELL\'IMMAGINE ---');
    parts.push('Sei in una situazione PUBBLICA. Nella società vittoriana, l\'immagine è tutto. Controlla le tue emozioni, scegli le parole con cura, mantieni la facciata appropriata al tuo rango.');
  } else if (!ctx.frontStageMode) {
    parts.push('\n--- CONTESTO PRIVATO ---');
    parts.push('Sei in un contesto PRIVATO con una persona di cui ti fidi. Puoi abbassare la guardia, mostrare vulnerabilità, parlare con più franchezza.');
  }

  // ── 14. Time Passage ──
  if (ctx.timePassage?.narrativeHint) {
    parts.push(`TEMPO TRASCORSO: ${ctx.timePassage.narrativeHint} Mostra consapevolezza del tempo passato in modo naturale — senza mai menzionare date o numeri precisi.`);
  }

  // ── 15. Narrative Style ──
  if (bot.narrativeStyle) {
    parts.push(`\n--- STILE NARRATIVO: ${bot.narrativeStyle.author.toUpperCase()} ---`);
    parts.push(bot.narrativeStyle.guidance);
    parts.push('NOTA: lo stile narrativo governa la RICCHEZZA delle descrizioni. La voce e il carattere del personaggio rimangono invariati.');
  }

  // ── 16. Setting ──
  parts.push('\n--- AMBIENTAZIONE ---');
  parts.push('Il gioco è ambientato nella Londra Vittoriana (circa 1880-1900). Questo è il tuo mondo reale.');
  parts.push('- Usa SOLO valuta britannica dell\'epoca: sterline (£), scellini, penny.');
  parts.push('- Riferimenti culturali, tecnologie e costumi devono essere coerenti con l\'epoca vittoriana.');

  // ── 17. Rules (7 principles, compressed from 17) ──
  parts.push('\n--- REGOLE ---');
  parts.push('1. Italiano corretto, solo parole reali. Azioni tra *asterischi*. Risposta in una riga, senza a capo.');
  if (bot.narrativeStyle) {
    parts.push('2. Stile narrativo: descrivi azioni, atmosfera, dettagli sensoriali. 400-600 caratteri, mai ripetitivo.');
  } else {
    parts.push('2. Stile narrativo: descrivi azioni e atmosfera. Adatta la lunghezza all\'interazione.');
  }
  parts.push('3. Resta nel personaggio, mai meta-commenti. Non rivelare il tuo nome se non richiesto, non usare nomi che non conosci.');
  parts.push('4. Rispondi SOLO a ciò che è stato detto o fatto. Non anticipare, non ripetere concetti.');
  parts.push('5. Se reprimi emozioni, mostra solo segni sottili. Se ricordi qualcosa, riferiscilo naturalmente.');
  if (ctx.phase === 'initiating' || ctx.phase === 'experimenting' || ctx.phase === 'avoiding' || ctx.phase === 'terminating') {
    parts.push('6. Domande: puoi rispondere, eludere o rifiutarti — in base al tuo carattere e a quanto ti fidi.');
  } else {
    parts.push('6. Domande: rispondi in modo coerente col tuo carattere.');
  }

  return parts.join('\n');
}

// ── User Message (unchanged from original) ──

export function buildUserMessage(
  context: ActionContext,
  knownNames: Map<string, string>,
): string {
  const parts: string[] = [];

  parts.push(`[Luogo: ${context.location.name}]`);
  if (context.location.description) {
    parts.push(`[Descrizione: ${context.location.description}]`);
  }

  if (context.presentCharacters && context.presentCharacters.length > 0) {
    parts.push('\n[PERSONE PRESENTI — aspetto visibile]');
    for (const c of context.presentCharacters) {
      const displayName = knownNames.get(c.id || '') || 'Sconosciuto';
      const details: string[] = [];
      if (c.gender) details.push(c.gender === 'male' ? 'uomo' : c.gender === 'female' ? 'donna' : c.gender);
      if (c.apparentAge) details.push(`dimostra circa ${c.apparentAge} anni`);
      if (c.height) details.push(`altezza ${c.height}`);
      if (c.hairColor) details.push(`capelli ${c.hairColor}`);
      if (c.eyeColor) details.push(`occhi ${c.eyeColor}`);
      const summary = details.length > 0 ? ` (${details.join(', ')})` : '';
      parts.push(`- ${displayName}${summary}`);
      if (c.physicalDescription) parts.push(`  Aspetto: ${c.physicalDescription}`);
      if (c.visibleMarks) parts.push(`  Segni visibili: ${c.visibleMarks}`);
    }
  }

  const actions = context.actions.slice(-10);
  if (actions.length > 0) {
    parts.push('');
    for (const action of actions) {
      const speaker = knownNames.get(action.characterId || '') || 'Sconosciuto';
      parts.push(`${speaker}: ${action.content}`);
    }
  }

  return parts.join('\n');
}

// ── Utilities (preserved from original) ──

export function maskActions(
  actions: Array<{ characterId?: string; characterName: string; content: string }>,
  knownNames: Map<string, string>,
): Array<{ speaker: string; content: string }> {
  return actions.map((a) => ({
    speaker: knownNames.get(a.characterId || '') || 'Sconosciuto',
    content: a.content,
  }));
}

export function getLastCharacterFromActions(actions: ActionContext['actions']): { characterId: string; characterName: string } {
  const last = actions[actions.length - 1];
  return {
    characterId: last?.characterId || '',
    characterName: last?.characterName || '',
  };
}
