import { IActiveEmotion, IBot } from '../models/Bot';

const EMOTION_TTL_MS = 60 * 60 * 1000; // 1 ora
const MIN_INTENSITY = 0.15;
const MAX_ACTIVE_EMOTIONS = 4;

export function getActiveEmotions(bot: IBot): IActiveEmotion[] {
  const now = Date.now();
  return (bot.activeEmotions || []).filter((e) => {
    const ageMs = now - new Date(e.createdAt).getTime();
    return ageMs < EMOTION_TTL_MS && e.intensity >= MIN_INTENSITY;
  });
}

export function describeEmotions(emotions: IActiveEmotion[]): string {
  if (emotions.length === 0) return '';

  const sorted = [...emotions].sort((a, b) => b.intensity - a.intensity);
  const descriptions = sorted.map((e) => {
    const level = e.intensity > 0.7 ? 'fortemente' : e.intensity > 0.4 ? '' : 'leggermente';
    return `${level} ${e.emotion}${e.trigger ? ` (a causa di: ${e.trigger})` : ''}`.trim();
  });

  return `In questo momento ti senti: ${descriptions.join('; ')}.`;
}

export function buildUpdatedEmotions(
  existing: IActiveEmotion[],
  newReaction: { emotion: string; intensity: number; trigger: string } | null,
): IActiveEmotion[] {
  const active = existing.filter((e) => {
    const ageMs = Date.now() - new Date(e.createdAt).getTime();
    return ageMs < EMOTION_TTL_MS && e.intensity >= MIN_INTENSITY;
  });

  if (!newReaction || !newReaction.emotion) return active;

  const existingIdx = active.findIndex(
    (e) => e.emotion.toLowerCase() === newReaction.emotion.toLowerCase(),
  );

  if (existingIdx >= 0) {
    active[existingIdx] = {
      emotion: newReaction.emotion,
      intensity: Math.min(1, (active[existingIdx].intensity + newReaction.intensity) / 1.5),
      trigger: newReaction.trigger,
      createdAt: new Date(),
    };
  } else {
    active.push({
      emotion: newReaction.emotion,
      intensity: newReaction.intensity,
      trigger: newReaction.trigger,
      createdAt: new Date(),
    });
  }

  return active
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, MAX_ACTIVE_EMOTIONS);
}

export function deriveMood(emotions: IActiveEmotion[]): string {
  if (emotions.length === 0) return 'neutro';

  const dominant = emotions.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const positiveEmotions = ['contento', 'felice', 'soddisfatto', 'divertito', 'grato', 'sereno', 'entusiasta'];
  const negativeEmotions = ['irritato', 'arrabbiato', 'triste', 'offeso', 'deluso', 'ansioso', 'sospettoso', 'infastidito'];

  const lower = dominant.emotion.toLowerCase();
  if (positiveEmotions.some((p) => lower.includes(p))) return 'positivo';
  if (negativeEmotions.some((n) => lower.includes(n))) return 'cupo';
  return 'neutro';
}
