/**
 * MarketShelf — schermata principale del Mercato: lo scaffale illustrato con le etichette dei reparti.
 *
 * Le etichette sono bottoni HTML (testo vero, accessibile) posizionati in percentuale sopra
 * l'immagine, quindi seguono il ridimensionamento della finestra. Posizioni e testi: `shelfConfig.ts`.
 */

import React, { useEffect, useState } from 'react';

import {
  SHELF_IMAGE,
  SHELF_IMAGE_HEIGHT,
  SHELF_IMAGE_WIDTH,
  SHELF_SECTIONS,
  type MarketSectionId,
} from './shelfConfig';
import styles from '@/styles/components/windows/market/Market.module.scss';

interface MarketShelfProps {
  /** Numero di voci per reparto; `undefined` finché i dati non sono arrivati. */
  counts: Partial<Record<MarketSectionId, number>>;
  onSelect: (section: MarketSectionId) => void;
}

function countLabel(id: MarketSectionId, count: number): string {
  if (id === 'servizi') return count === 1 ? '1 servizio' : `${count} servizi`;
  return count === 1 ? '1 oggetto' : `${count} oggetti`;
}

export function MarketShelf({ counts, onSelect }: MarketShelfProps): React.ReactElement {
  // Modalità di debug (solo sviluppo): disegna i riquadri per ritoccare le posizioni a occhio.
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    setDebug(new URLSearchParams(window.location.search).get('marketDebug') === '1');
  }, []);

  return (
    <div className={styles.shelfStage}>
      <div
        className={`${styles.shelf} ${debug ? styles.shelfDebug : ''}`}
        style={{ aspectRatio: `${SHELF_IMAGE_WIDTH} / ${SHELF_IMAGE_HEIGHT}` }}
      >
        <img src={SHELF_IMAGE} alt="" className={styles.shelfImage} draggable={false} />

        {SHELF_SECTIONS.map((section) => {
          const count = counts[section.id];
          return (
            <button
              key={section.id}
              type="button"
              className={`${styles.shelfLabel} ${section.tone === 'dark' ? styles.shelfLabelDark : ''}`}
              aria-label={section.title}
              onClick={() => onSelect(section.id)}
              style={{
                left: `${section.text.x}%`,
                top: `${section.text.y}%`,
                width: `${section.text.w}%`,
                height: `${section.text.h}%`,
                fontSize: `${section.fontCqw}cqw`,
              }}
            >
              <span
                className={styles.shelfLabelText}
                aria-hidden="true"
                style={section.rotateDeg ? { transform: `rotate(${section.rotateDeg}deg)` } : undefined}
              >
                {section.lines.map((line) => (
                  <span key={line} className={styles.shelfLabelLine}>
                    {line}
                  </span>
                ))}
              </span>
              {count !== undefined && (
                <span className={styles.shelfCount} aria-hidden="true">
                  {countLabel(section.id, count)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
