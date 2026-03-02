/**
 * Weather Display Component
 *
 * Shows current weather conditions and temperature from real London weather data.
 * Fetches data from EnvironmentContext which updates every 5 minutes.
 *
 * @module components/sidebar/WeatherDisplay
 * @since 2.0.0
 */

'use client';

import { useEnvironment } from '@/contexts/EnvironmentContext';
import styles from '@/styles/components/WeatherDisplay.module.scss';

/**
 * Weather Display Component
 *
 * Renders weather icon and temperature based on real-time London weather.
 * Falls back to 'fog' and 5°C if data not available.
 *
 * @component
 * @returns {JSX.Element} Weather display
 * @since 2.0.0
 */
export function WeatherDisplay(): JSX.Element {
  const { environment } = useEnvironment();
  const condition = environment?.condition || 'fog';
  const temperature = environment?.temperature ?? 5;

  const weatherIconUrl = `/images/sidebar/weather-${condition}.png`;

  return (
    <div className={styles.weather}>
      <img
        src={weatherIconUrl}
        alt={`Weather: ${condition}`}
        className={styles.weatherIcon}
        onError={(e) => {
          (e.target as HTMLImageElement).src = '/images/sidebar/weather-fog.png';
        }}
      />
      <div className={styles.temperature}>{temperature}°C</div>
    </div>
  );
}
