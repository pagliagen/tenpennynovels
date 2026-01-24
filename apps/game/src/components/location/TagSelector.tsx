import React, { useState, useEffect } from 'react';
import styles from './TagSelector.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

interface TagSelectorProps {
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
}

interface Tag {
  _id: string;
  name: string;
  category?: string;
}

export default function TagSelector({ selectedTag, onTagChange }: TagSelectorProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/game/location-tags`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result && data.data?.tags) {
          setAvailableTags(data.data.tags);
        }
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagToggle = (tagName: string) => {
    if (selectedTag === tagName) {
      // Deselect if already selected
      onTagChange(null);
    } else {
      // Select new tag
      onTagChange(tagName);
    }
  };

  return (
    <div className={styles.tagSelector}>
      {selectedTag && (
        <div className={styles.selectedTag}>
          <span className={styles.tag}>
            {selectedTag}
            <button
              type="button"
              onClick={() => onTagChange(null)}
              className={styles.removeTag}
              aria-label={`Rimuovi tag ${selectedTag}`}
            >
              ×
            </button>
          </span>
        </div>
      )}

      <div className={styles.availableTags}>
        <label className={styles.label}>Tag disponibili:</label>
        {isLoading ? (
          <div className={styles.loading}>Caricamento tag...</div>
        ) : (
          <div className={styles.tagList}>
            {availableTags.map(tag => (
              <button
                key={tag._id}
                type="button"
                onClick={() => handleTagToggle(tag.name)}
                className={`${styles.tagButton} ${selectedTag === tag.name ? styles.selected : ''}`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

