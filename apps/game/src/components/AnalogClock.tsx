import React, { useState, useEffect } from 'react';
import styles from '../styles/components/AnalogClock.module.scss';

export const AnalogClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate angles for hands
  const minute = time.getMinutes();
  const hour = time.getHours() % 12;

  const minuteAngle = minute * 6; // 6 degrees per minute (0 = 12 o'clock)
  const hourAngle = (hour * 30) + (minute * 0.5); // 30 degrees per hour + smooth transition

  return (
    <div className={styles.clockContainer}>
      <div className={styles.clock}>
        {/* Clock face */}
        <div className={styles.face}>

          {/* Numbers */}
          {Array.from({ length: 12 }, (_, i) => {
            const number = i === 0 ? 12 : i;
            const angle = (i * 30) - 90; // Start from 12 o'clock position
            const radius = 48; // Increased radius to move numbers closer to edge
            const x = Math.cos(angle * Math.PI / 180) * radius;
            const y = Math.sin(angle * Math.PI / 180) * radius;
            
            return (
              <div
                key={i}
                className={styles.number}
                style={{
                  transform: `translate(${x}px, ${y}px)`
                }}
              >
                {number}
              </div>
            );
          })}

          {/* Clock hands */}
          <div
            className={styles.hourHand}
            style={{
              transform: `translate(-50%, -100%) rotate(${hourAngle}deg)`
            }}
          />
          <div
            className={styles.minuteHand}
            style={{
              transform: `translate(-50%, -100%) rotate(${minuteAngle}deg)`
            }}
          />

          {/* Center dot */}
          <div className={styles.center} />
        </div>

        {/* Digital time display */}
        <div className={styles.digitalTime}>
          {time.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};