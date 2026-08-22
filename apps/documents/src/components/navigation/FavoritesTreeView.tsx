import Link from 'next/link';
import { useState } from 'react';

import type { FavoriteEntry } from '@/lib/api/favorites';

import styles from './RouteTreeView.module.scss';

interface FavoritesTreeViewProps {
  favorites: FavoriteEntry[];
  currentPath: string;
}

const TYPE_LABELS: Record<string, string> = {
  ambientazione: 'Ambientazione',
  regolamento: 'Regolamento',
  'manuale-master': 'Manuale Master',
};

export function FavoritesTreeView({ favorites, currentPath }: FavoritesTreeViewProps) {
  const grouped = favorites.reduce<Record<string, FavoriteEntry[]>>((acc, fav) => {
    const type = fav.document.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(fav);
    return acc;
  }, {});

  const types = Object.keys(TYPE_LABELS).filter((t) => grouped[t]?.length);

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(
    () => new Set(types)
  );

  const toggle = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className={styles.routeTree}>
      {types.map((type) => {
        const isExpanded = expandedTypes.has(type);
        const typeFavorites = grouped[type]!;

        return (
          <div key={type} className={styles.subtypeGroup}>
            <button
              type="button"
              className={`${styles.subtypeLabel} ${isExpanded ? styles.expanded : ''}`}
              onClick={() => toggle(type)}
            >
              {TYPE_LABELS[type]}
            </button>

            {isExpanded &&
              typeFavorites.map((fav) => {
                const favPath = `/preferiti/${fav.document.type}/${fav.document.path}`;
                const isActive = currentPath === favPath;

                return (
                  <div key={fav._id} className={styles.documentNode}>
                    <div className={styles.documentRow}>
                      <Link
                        href={favPath}
                        className={`${styles.docLink} ${isActive ? styles.active : ''}`}
                      >
                        <span className={styles.docTitle} title={fav.document.title}>
                          {fav.document.title}
                        </span>
                      </Link>
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
