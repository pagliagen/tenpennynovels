/**
 * Category Filter Component
 *
 * Dropdown filter for occupation categories with Victorian dark theme.
 * Shows current filter label and toggles a dropdown to select categories.
 *
 * @module components/character/wizard/shared/CategoryFilter
 * @since 2.1.0
 */

'use client';

import Image from 'next/image';
import { useRef, useEffect, useState } from 'react';

import styles from '@/styles/components/character/wizard/CategoryFilter.module.scss';

import { CATEGORY_LABELS } from './OccupationIconMap';


function FilterIcon() {
  return (
    <Image
      src="/images/icons/filter_icon.png"
      alt="Filtra"
      width={16}
      height={16}
      className={styles.filterIcon}
    />
  );
}

/**
 * Props for CategoryFilter
 */
interface CategoryFilterProps {
  /** Available category keys */
  categories: string[];
  /** Currently selected category or null for all */
  selectedCategory: string | null;
  /** Callback when category is selected */
  onSelect: (category: string | null) => void;
}

/**
 * Category Filter Component
 *
 * Renders a button that toggles a dropdown with category options.
 *
 * @param {CategoryFilterProps} props - Component props
 * @returns {JSX.Element} Category filter
 */
export function CategoryFilter({ categories, selectedCategory, onSelect }: CategoryFilterProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLabel = selectedCategory
    ? CATEGORY_LABELS[selectedCategory] ?? selectedCategory
    : 'Tutte le categorie';

  const handleSelect = (category: string | null) => {
    onSelect(category);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.triggerIcon}>
          <FilterIcon />
        </span>
        <span className={styles.triggerLabel}>{currentLabel}</span>
      </button>

      {isOpen && (
        <ul
          className={styles.dropdown}
          role="listbox"
          aria-label="Seleziona categoria"
        >
          <li role="option">
            <button
              type="button"
              className={styles.dropdownItem}
              onClick={() => handleSelect(null)}
            >
              Tutte le categorie
            </button>
          </li>
          {categories.map((category) => {
            const label = CATEGORY_LABELS[category] ?? category;
            return (
              <li key={category} role="option">
                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => handleSelect(category)}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
