import React from 'react';
import styles from '../styles/components/ChartBadge.module.scss';

export interface ChartDataItem {
  name: string;           // Browser name, Location name, etc.
  version?: string;       // Browser version (optional)
  location?: string;      // For geographic data
  country?: string;       // For geographic data
  code?: string;          // Country/region code
  count: number;
  percentage: number;
  color: string;
}

interface ChartBadgeProps {
  title: string;
  icon: string;
  data: ChartDataItem[];
  displayField: keyof ChartDataItem;  // What to show in legend (name, location, etc.)
  secondaryField?: keyof ChartDataItem; // Optional secondary info (version, country, etc.)
  topCount?: number;      // How many items to show in legend (default 5)
}

export const ChartBadge: React.FC<ChartBadgeProps> = ({
  title,
  icon,
  data,
  displayField,
  secondaryField,
  topCount = 5
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={styles.chartCard}>
        <div className={styles.cardHeader}>
          <h3>{icon} {title}</h3>
        </div>
        <div className={styles.emptyState}>
          <p>Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartCard}>
      <div className={styles.cardHeader}>
        <h3>{icon} {title}</h3>
      </div>
      <div className={styles.chartContainer}>
        {/* Donut Chart */}
        <div className={styles.donutChart}>
          <svg viewBox="0 0 200 200" className={styles.donutSvg}>
            {data.map((item, index) => {
              const startAngle = data
                .slice(0, index)
                .reduce((sum, b) => sum + (b.percentage * 3.6), 0);
              const endAngle = startAngle + (item.percentage * 3.6);

              // Calculate path for donut segment
              const innerRadius = 60;
              const outerRadius = 90;
              const startAngleRad = (startAngle - 90) * Math.PI / 180;
              const endAngleRad = (endAngle - 90) * Math.PI / 180;

              const x1 = 100 + outerRadius * Math.cos(startAngleRad);
              const y1 = 100 + outerRadius * Math.sin(startAngleRad);
              const x2 = 100 + outerRadius * Math.cos(endAngleRad);
              const y2 = 100 + outerRadius * Math.sin(endAngleRad);
              const x3 = 100 + innerRadius * Math.cos(endAngleRad);
              const y3 = 100 + innerRadius * Math.sin(endAngleRad);
              const x4 = 100 + innerRadius * Math.cos(startAngleRad);
              const y4 = 100 + innerRadius * Math.sin(startAngleRad);

              const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
              const pathData = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;

              return (
                <path
                  key={`${item[displayField]}-${index}`}
                  d={pathData}
                  fill={item.color}
                  stroke="#2C2C2E"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className={styles.chartLegend}>
          <div className={styles.legendHeader}>
            <span>Top {topCount}</span>
            {displayField === 'location' ? <span>Localizzazione</span> : <span></span>}
            <span>Percentuale</span>
          </div>
          {data.slice(0, topCount).map((item) => (
            <div key={`${item[displayField]}-${item.code || item.version || ''}`} className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: item.color }}></div>
              {displayField === 'location' ? (
                <span className={styles.itemName}>
                  {item[displayField] as string}
                  {secondaryField && item[secondaryField] && (
                    <span className={styles.secondaryInfo}> {item[secondaryField] as string}</span>
                  )}
                  {item.country === 'Italia' && item.location !== 'Non Italiano' && (
                    <span className={styles.flag}> 🇮🇹</span>
                  )}
                  {item.country === 'Non Italiano' && (
                    <span className={styles.flag}> 🌍</span>
                  )}
                </span>
              ) : (<span></span>)}
              <span className={styles.itemPercentage}>{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};