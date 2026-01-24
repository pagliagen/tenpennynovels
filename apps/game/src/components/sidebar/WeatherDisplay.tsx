import React from 'react';
import styles from '@/styles/components/sidebar/WeatherDisplay.module.scss';

interface WeatherDisplayProps {
  temperature?: number;
  condition?: 'fog' | 'clear' | 'rain' | 'cloudy';
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ 
  temperature = 5, 
  condition = 'fog' 
}) => {
  const getWeatherImage = () => {
    switch (condition) {
      case 'fog':
        return '/images/sidebar/weather-fog.png';
      default:
        return '/images/sidebar/weather-fog.png';
    }
  };

  return (
    <div className={styles.weatherDisplay}>
      <img 
        src={getWeatherImage()} 
        alt={`Condizioni meteo: ${condition}`}
        className={styles.weatherIcon}
      />
      <span className={styles.temperature}>{temperature}°</span>
    </div>
  );
};

