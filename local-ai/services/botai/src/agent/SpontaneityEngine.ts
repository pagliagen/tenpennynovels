/**
 * SpontaneityEngine — Adds emotional noise to prevent deterministic behavior.
 *
 * Humans are not perfect state machines. Even a calm person has random emotional
 * fluctuations — a fleeting worry, a moment of unexpected joy, a brief irritation
 * at nothing in particular. This engine injects small, psychologically grounded
 * perturbations into the bot's felt emotions before prompt construction.
 *
 * Noise magnitude scales inversely with emotional control: a stoic character
 * has minimal noise, while an impulsive character has more volatility.
 */

import { IPlutchikEmotions } from '../models/Bot';

const PLUTCHIK_AXES: (keyof IPlutchikEmotions)[] = [
  'gioia', 'fiducia', 'paura', 'sorpresa', 'tristezza', 'disgusto', 'rabbia', 'anticipazione',
];

/**
 * Box-Muller transform for Gaussian noise.
 */
function gaussianNoise(mean: number, sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z;
}

/**
 * Apply emotional noise to felt emotions.
 *
 * @param felt - Current felt Plutchik axes
 * @param emotionalControl - 0-1 personality control factor (higher = less noise)
 * @returns Perturbed felt emotions (clamped to [0, 1])
 */
export function applyEmotionalNoise(
  felt: IPlutchikEmotions,
  emotionalControl: number,
): IPlutchikEmotions {
  const noised = { ...felt };
  const volatility = (1 - emotionalControl) * 0.08;

  for (const axis of PLUTCHIK_AXES) {
    const current = noised[axis] || 0;

    if (current > 0.1) {
      // Perturb existing emotions
      noised[axis] = Math.max(0, Math.min(1, current + gaussianNoise(0, volatility)));
    } else {
      // Small chance of spontaneous micro-emotion (random thought/mood)
      const spawnChance = 0.03 * (1 - emotionalControl);
      if (Math.random() < spawnChance) {
        noised[axis] = 0.05 + Math.random() * 0.07; // 0.05-0.12
      }
    }
  }

  return noised;
}
