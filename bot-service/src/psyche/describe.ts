import type { Psyche } from '../config';
import type { Pad, Relation, Stance } from './types';

/**
 * I numeri non arrivano mai al modello: un 12B non sa cosa farsene di
 * "Nevroticismo: 62". Qui diventano frasi italiane, con soglie fisse.
 */

const HIGH = 65;
const LOW = 35;

const TRAITS: Record<'O' | 'C' | 'E' | 'A' | 'N', { high: string; low: string }> = {
  O: {
    high: 'Sei curioso e fantasioso: le cose strane ti incuriosiscono.',
    low: 'Sei pragmatico e poco incline alle novità: diffidi di ciò che è strano o stravagante.',
  },
  C: {
    high: 'Sei metodico e preciso, ci tieni all\'ordine e alle cose fatte bene.',
    low: 'Sei sbrigativo e disordinato, non ti curi dei dettagli.',
  },
  E: {
    high: 'Sei loquace e socievole, ti piace stare in mezzo alla gente.',
    low: 'Sei di poche parole: parli solo quando serve e non riempi i silenzi.',
  },
  A: {
    high: 'Sei accomodante e cortese, eviti gli scontri.',
    low: 'Sei diretto e brusco, non fai sconti a nessuno e non temi lo scontro.',
  },
  N: {
    high: 'Sei ansioso e ti irriti in fretta, anche per poco.',
    low: 'Sei imperturbabile: poco ti scompone.',
  },
};

export function describePsyche(psyche: Psyche): string[] {
  const lines: string[] = [];
  for (const key of ['O', 'C', 'E', 'A', 'N'] as const) {
    const value = psyche.ocean[key];
    if (value >= HIGH) lines.push(TRAITS[key].high);
    else if (value <= LOW) lines.push(TRAITS[key].low);
  }
  lines.push(`Ciò che desideri più di tutto: ${psyche.enneagram.desire}.`);
  lines.push(`Ciò che temi di più: ${psyche.enneagram.fear}.`);
  return lines;
}

/** Gli otto ottanti dello spazio PAD (Mehrabian), in italiano. */
const OCTANTS: Record<string, string> = {
  '+++': 'allegro e vivace',
  '++-': 'entusiasta e ansioso di piacere',
  '+-+': 'rilassato e padrone di te',
  '+--': 'tranquillo e accondiscendente',
  '-++': 'irritato e ostile',
  '-+-': 'teso e a disagio',
  '--+': 'distaccato e sprezzante',
  '---': 'annoiato e svogliato',
};

const NEUTRAL_RADIUS = 0.2;

export function describeMood(pad: Pad): string {
  const magnitude = Math.sqrt(pad.p ** 2 + pad.a ** 2 + pad.d ** 2) / Math.sqrt(3);
  if (magnitude < NEUTRAL_RADIUS) return 'Il tuo umore è neutro.';
  const key = `${pad.p >= 0 ? '+' : '-'}${pad.a >= 0 ? '+' : '-'}${pad.d >= 0 ? '+' : '-'}`;
  const intensity = magnitude > 0.55 ? 'molto ' : magnitude < 0.35 ? 'un po\' ' : '';
  return `In questo momento sei ${intensity}${OCTANTS[key]}.`;
}

export const STRANGER_LABEL = 'Straniero';

/**
 * Come il bot chiama (e vede nel testo) un giocatore: solo col nome che gli è stato
 * detto, o che già conosce per rapporto autorato (allora è il nome in chat).
 */
export function labelFor(rel: Relation | null, stance?: Stance, chatName?: string): string {
  if (rel?.knownName) return rel.knownName;
  if (stance?.knowsName && chatName) return chatName;
  return STRANGER_LABEL;
}

function sinceText(from: Date, now: Date): string {
  const minutes = (now.getTime() - from.getTime()) / 60_000;
  if (minutes < 10) return 'poco fa';
  if (minutes < 180) return 'meno di un\'ora o due fa';
  if (minutes < 60 * 24) return 'qualche ora fa';
  if (minutes < 60 * 48) return 'ieri';
  if (minutes < 60 * 24 * 7) return 'qualche giorno fa';
  return 'molto tempo fa';
}

/** Il rapporto autorato e gli atteggiamenti di categoria, in frasi. */
function describeStance(stance: Stance | undefined): string[] {
  if (!stance) return [];
  const lines: string[] = [];
  if (stance.label) lines.push(`Per te è ${stance.label}.`);
  if (stance.backstory) lines.push(stance.backstory);
  lines.push(...stance.hints);
  return lines;
}

/**
 * @param name come il bot chiama la persona (il nome visibile solo se lo sa)
 */
export function describeRelation(rel: Relation | null, now: Date, stance?: Stance, name?: string, gender?: 'male' | 'female'): string[] {
  const who = gender === 'male' ? 'lui' : gender === 'female' ? 'lei' : 'questa persona';
  const knows = rel?.knownName ?? (stance?.knowsName ? name : undefined);
  const firstTime = !rel || rel.interactions === 0;

  const lines: string[] = [];
  if (firstTime && !stance?.authored) {
    lines.push(`È la prima volta che parli con ${who}: non la conosci.`);
    lines.push(
      knows
        ? `Ha appena detto di chiamarsi ${knows}.`
        : 'Non sai come si chiama. Non inventare un nome: chiama così «straniero» o simili finché non si presenta.',
    );
  } else if (rel && rel.interactions > 0) {
    lines.push(
      rel.interactions === 1
        ? `Hai già scambiato qualche parola con ${who} una volta, ${sinceText(rel.lastSeenAt, now)}.`
        : `Hai già incontrato ${who} ${rel.interactions} volte; l'ultima ${sinceText(rel.lastSeenAt, now)}.`,
    );
    lines.push(knows ? `Sai che si chiama ${knows}.` : 'Non sai come si chiama: non si è mai presentato. Non inventare un nome, usa «straniero» o simili.');
  } else if (knows) {
    lines.push(`Sai che si chiama ${knows}.`);
  }
  lines.push(...describeStance(stance));
  if (!rel) return lines;

  if (rel.trust >= HIGH) lines.push(`Ti fidi di ${who}.`);
  else if (rel.trust <= LOW) lines.push(`Non ti fidi di ${who}.`);
  if (rel.respect >= HIGH) lines.push(`Provi rispetto per ${who}.`);
  else if (rel.respect <= LOW) lines.push(`Non hai alcun rispetto per ${who}.`);
  if (rel.suspicion >= HIGH) lines.push(`Sei molto sospettoso nei confronti di ${who}.`);
  else if (rel.suspicion >= 50) lines.push(`Tieni d'occhio ${who}.`);
  else if (rel.suspicion <= LOW) lines.push(`Non hai alcun motivo di sospettare di ${who}.`);

  if (rel.summary) lines.push(`Ricordi: ${rel.summary}`);
  if (rel.lastEvent) lines.push(`L'ultima cosa che conta: ${rel.lastEvent}.`);
  if (rel.facts.length > 0) lines.push(`Sai di ${who}: ${rel.facts.join('; ')}.`);
  return lines;
}
