import type { EnvironmentData, WeatherCondition } from '@modules/game/services/WeatherService';

/**
 * Il meteo come lo vede il bot: derivato da `getWeather()`, la STESSA sorgente della
 * sidebar del game (`/game/environment`). Se in gioco compare una condizione nuova,
 * i `Record<WeatherCondition, …>` qui sotto non compilano finché il bot non sa come
 * descriverla: il bot non deve mai vedere un tempo diverso da quello in sidebar.
 */
export interface BotEnvironment {
  condition: WeatherCondition;
  /** Frase breve per il prompt: «piove». */
  description: string;
  /** Com'è la temperatura a sentirla, senza numeri («fa freddo»). */
  feel: string;
  /** Parole che il bot può dire per questo tempo: tutte le altre del meteo restano inventate. */
  words: string[];
}

const CONDITION: Record<WeatherCondition, { description: string; words: string[] }> = {
  clear: { description: 'il cielo è sereno', words: ['sereno', 'sole'] },
  cloudy: { description: 'il cielo è coperto', words: ['coperto', 'nuvole', 'nuvoloso'] },
  fog: { description: 'c\'è nebbia', words: ['nebbia'] },
  rain: { description: 'piove', words: ['piove', 'pioggia', 'pioggerella'] },
};

export function feelsLike(temperature: number): string {
  if (temperature <= 2) return 'fa un freddo gelido';
  if (temperature <= 8) return 'fa freddo';
  if (temperature <= 14) return 'fa fresco';
  if (temperature <= 20) return 'il tempo è mite';
  return 'fa caldo';
}

export function toBotEnvironment(env: Pick<EnvironmentData, 'condition' | 'temperature'>): BotEnvironment {
  const { description, words } = CONDITION[env.condition];
  return { condition: env.condition, description, feel: feelsLike(env.temperature), words };
}
