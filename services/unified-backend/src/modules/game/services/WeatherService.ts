/**
 * Weather Service - Real-time weather and moon phase data
 *
 * Fetches real weather data from Open-Meteo API for London and calculates
 * moon phase using astronomical calculations. Data is cached in-memory
 * for 30 minutes to minimize API calls and ensure all users see identical data.
 *
 * @module modules/game/services/WeatherService
 * @since 2.0.0
 */

import * as SunCalc from 'suncalc';
import { logger } from '../logger';

// London coordinates
const LONDON_LAT = 51.5074;
const LONDON_LON = -0.1278;

// Cache configuration
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Temperature modifiers based on weather condition
const CONDITION_MODIFIERS: Record<WeatherCondition, number> = {
  clear: +2,   // Sun warms
  fog: -1,     // Fog cools
  rain: 0,     // Neutral
  cloudy: +1,  // Clouds trap heat
};

/**
 * Weather condition types
 */
export type WeatherCondition = 'clear' | 'fog' | 'rain' | 'cloudy';

/**
 * Moon phase types (8 phases)
 */
export type MoonPhase =
  | 'new'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

/**
 * Environment data returned to clients
 */
export interface EnvironmentData {
  condition: WeatherCondition;
  temperature: number;
  moonPhase: MoonPhase;
  moonIllumination: number;  // 0-1 (0% to 100%)
  lastUpdated: string;       // ISO timestamp
}

/**
 * Open-Meteo API response structure
 */
interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    weather_code: number;
  };
}

// In-memory cache
let weatherCache: EnvironmentData | null = null;
let cacheExpiry: number = 0;

/**
 * Map Open-Meteo WMO weather code to game weather condition
 *
 * @param code - WMO weather code from Open-Meteo
 * @returns Game weather condition
 */
function mapWeatherCode(code: number): WeatherCondition {
  // 0-1: Clear sky, mainly clear
  if (code <= 1) return 'clear';

  // 2-3: Partly cloudy, overcast
  if (code <= 3) return 'cloudy';

  // 45-48: Fog, depositing rime fog
  if (code >= 45 && code <= 48) return 'fog';

  // 51-67: Drizzle, rain, freezing rain
  // 71-77: Snow (treat as rain for Victorian London)
  // 80-99: Rain showers, thunderstorm
  if ((code >= 51 && code <= 67) ||
      (code >= 71 && code <= 77) ||
      (code >= 80 && code <= 99)) {
    return 'rain';
  }

  // Fallback to fog (Victorian London default)
  return 'fog';
}

/**
 * Calculate moon phase from date using astronomical calculations
 *
 * @param date - Date to calculate moon phase for
 * @returns Moon phase data
 */
function calculateMoonPhase(date: Date): { phase: MoonPhase; fraction: number } {
  const illumination = SunCalc.getMoonIllumination(date);
  const phaseValue = illumination.phase; // 0-1

  // Map phase value (0-1) to 8 named phases
  // Phase value represents lunar cycle: 0 = new moon, 0.5 = full moon, 1 = new moon
  let phase: MoonPhase;

  if (phaseValue < 0.0625) {
    phase = 'new';
  } else if (phaseValue < 0.1875) {
    phase = 'waxing_crescent';
  } else if (phaseValue < 0.3125) {
    phase = 'first_quarter';
  } else if (phaseValue < 0.4375) {
    phase = 'waxing_gibbous';
  } else if (phaseValue < 0.5625) {
    phase = 'full';
  } else if (phaseValue < 0.6875) {
    phase = 'waning_gibbous';
  } else if (phaseValue < 0.8125) {
    phase = 'last_quarter';
  } else if (phaseValue < 0.9375) {
    phase = 'waning_crescent';
  } else {
    phase = 'new';
  }

  return {
    phase,
    fraction: illumination.fraction, // 0-1 (percentage illuminated)
  };
}

/**
 * Fetch weather data from Open-Meteo API
 *
 * @returns Weather data from API
 * @throws Error if API call fails
 */
async function fetchOpenMeteo(): Promise<OpenMeteoResponse> {
  const url =
    `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${LONDON_LAT}&longitude=${LONDON_LON}&` +
    `current=temperature_2m,weather_code&` +
    `timezone=Europe/London`;

  logger.info('[WeatherService] Fetching weather from Open-Meteo API');

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as OpenMeteoResponse;
  return data;
}

/**
 * Get current environment data (weather + moon phase)
 *
 * Uses in-memory cache with 30-minute TTL. All users see identical data
 * because cache is shared across requests.
 *
 * @returns Environment data
 */
export async function getWeather(): Promise<EnvironmentData> {
  const now = Date.now();

  // Cache hit - return cached data
  if (weatherCache && now < cacheExpiry) {
    logger.debug('[WeatherService] Cache hit');
    return weatherCache;
  }

  logger.info('[WeatherService] Cache miss - fetching fresh data');

  try {
    // Fetch weather from Open-Meteo
    const openMeteoData = await fetchOpenMeteo();
    const condition = mapWeatherCode(openMeteoData.current.weather_code);

    // Calculate modified temperature
    const baseTemp = openMeteoData.current.temperature_2m;
    const modifier = CONDITION_MODIFIERS[condition];
    const temperature = Math.round(baseTemp + modifier);

    // Calculate moon phase
    const moonData = calculateMoonPhase(new Date());

    // Build environment data
    weatherCache = {
      condition,
      temperature,
      moonPhase: moonData.phase,
      moonIllumination: moonData.fraction,
      lastUpdated: new Date().toISOString(),
    };

    // Set cache expiry
    cacheExpiry = now + CACHE_TTL_MS;

    logger.info('[WeatherService] Weather cached', {
      condition,
      temperature,
      moonPhase: moonData.phase,
      cacheExpiresIn: `${CACHE_TTL_MS / 1000 / 60} minutes`,
    });

    return weatherCache;

  } catch (error: any) {
    logger.error('[WeatherService] Failed to fetch weather:', error);

    // If we have stale cache, return it as fallback
    if (weatherCache) {
      logger.warn('[WeatherService] Returning stale cache due to API error');
      return weatherCache;
    }

    // No cache - return default Victorian London weather
    logger.warn('[WeatherService] Returning default fallback weather');
    return {
      condition: 'fog',
      temperature: 5,
      moonPhase: 'waning_crescent',
      moonIllumination: 0.3,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Clear the weather cache (for testing or manual refresh)
 */
export function clearWeatherCache(): void {
  weatherCache = null;
  cacheExpiry = 0;
  logger.info('[WeatherService] Cache cleared');
}

