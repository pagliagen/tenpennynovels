import { IBot, INeed, IGoal, NeedType, IPlutchikEmotions } from '../models/Bot';

// Half-lives for need satisfaction decay (Victorian context)
const NEED_HALF_LIFE_MS: Record<NeedType, number> = {
  belonging:   12 * 60 * 60 * 1000,  // 12h — social isolation acutely felt
  status:      24 * 60 * 60 * 1000,  // 24h — status anxiety persistent in Victorian society
  security:    48 * 60 * 60 * 1000,  // 48h — security concerns linger
  autonomy:    36 * 60 * 60 * 1000,  // 36h — sense of agency erodes moderately
  purpose:     72 * 60 * 60 * 1000,  // 72h — existential purpose decays slowly
};

// Keyword rules for deriving need salience from personality traits
const SALIENCE_RULES: Array<{ keywords: string[]; need: NeedType; boost: number }> = [
  { keywords: ['ambizioso', 'ambiziosa', 'orgoglioso', 'orgogliosa', 'vanitoso', 'vanitosa', 'nobile', 'aristocratico', 'aristocratica'], need: 'status', boost: 0.3 },
  { keywords: ['prudente', 'ansioso', 'ansiosa', 'povero', 'povera', 'orfano', 'orfana', 'timoroso', 'timorosa'], need: 'security', boost: 0.3 },
  { keywords: ['socievole', 'leale', 'affettuoso', 'affettuosa', 'solitario', 'solitaria', 'empatico', 'empatica'], need: 'belonging', boost: 0.3 },
  { keywords: ['indipendente', 'ribelle', 'testardo', 'testarda', 'libero', 'libera', 'insofferente'], need: 'autonomy', boost: 0.3 },
  { keywords: ['devoto', 'devota', 'idealista', 'determinato', 'determinata', 'missionario', 'fervente'], need: 'purpose', boost: 0.3 },
];

/** Apply exponential decay to needs based on time since last satisfaction */
export function getDecayedNeeds(bot: IBot): INeed[] {
  if (!bot.needs || bot.needs.length === 0) return [];
  const now = Date.now();
  return bot.needs.map(need => {
    const ageMs = now - new Date(need.lastSatisfied).getTime();
    if (ageMs <= 0) return need;
    const halfLife = NEED_HALF_LIFE_MS[need.type];
    const decayFactor = Math.pow(0.5, ageMs / halfLife);
    return { ...need, satisfaction: need.satisfaction * decayFactor };
  });
}

/** Derive need salience from personality traits */
export function deriveNeedSalience(traits: string[]): Map<NeedType, number> {
  const lowerTraits = traits.map(t => t.toLowerCase());
  const salience = new Map<NeedType, number>();
  const allNeeds: NeedType[] = ['status', 'security', 'belonging', 'autonomy', 'purpose'];
  for (const need of allNeeds) salience.set(need, 0.5); // default
  for (const rule of SALIENCE_RULES) {
    if (rule.keywords.some(kw => lowerTraits.some(t => t.includes(kw)))) {
      salience.set(rule.need, Math.min(1.0, (salience.get(rule.need) || 0.5) + rule.boost));
    }
  }
  return salience;
}

/** Compute emotional pressure from critically unmet needs (satisfaction < 0.2) */
export function computeEmotionalPressure(needs: INeed[]): Partial<IPlutchikEmotions> {
  const pressure: Partial<IPlutchikEmotions> = {};
  for (const need of needs) {
    if (need.satisfaction >= 0.2) continue;
    const intensity = (0.2 - need.satisfaction) / 0.2; // 0-1 based on how far below threshold
    switch (need.type) {
      case 'belonging':
        pressure.tristezza = (pressure.tristezza || 0) + 0.2 * intensity * need.salience;
        pressure.anticipazione = (pressure.anticipazione || 0) + 0.1 * intensity * need.salience;
        break;
      case 'status':
        pressure.rabbia = (pressure.rabbia || 0) + 0.1 * intensity * need.salience;
        pressure.disgusto = (pressure.disgusto || 0) + 0.1 * intensity * need.salience;
        break;
      case 'security':
        pressure.paura = (pressure.paura || 0) + 0.2 * intensity * need.salience;
        break;
      case 'autonomy':
        pressure.rabbia = (pressure.rabbia || 0) + 0.2 * intensity * need.salience;
        break;
      case 'purpose':
        pressure.tristezza = (pressure.tristezza || 0) + 0.3 * intensity * need.salience;
        break;
    }
  }
  return pressure;
}

/** Describe active goals in Italian for prompt injection */
export function describeGoals(goals: IGoal[]): string {
  const active = goals.filter(g => g.status === 'active');
  if (active.length === 0) return '';
  return active.map(g => `- ${g.description} (progresso: ${Math.round(g.progress * 100)}%)`).join('\n');
}

/** Update need satisfaction with deltas, reset lastSatisfied timestamp */
export function updateNeedSatisfaction(
  needs: INeed[],
  deltas: Array<{ need: NeedType; delta: number }>,
): INeed[] {
  return needs.map(n => {
    const delta = deltas.find(d => d.need === n.type);
    if (!delta) return n;
    const newSatisfaction = Math.max(0, Math.min(1, n.satisfaction + delta.delta));
    return {
      ...n,
      satisfaction: newSatisfaction,
      lastSatisfied: delta.delta > 0 ? new Date() : n.lastSatisfied,
    };
  });
}

/** Initialize default needs for a bot based on personality */
export function initializeNeeds(traits: string[]): INeed[] {
  const salience = deriveNeedSalience(traits);
  const allNeeds: NeedType[] = ['status', 'security', 'belonging', 'autonomy', 'purpose'];
  return allNeeds.map(type => ({
    type,
    satisfaction: 0.5,
    salience: salience.get(type) || 0.5,
    lastSatisfied: new Date(),
  }));
}
