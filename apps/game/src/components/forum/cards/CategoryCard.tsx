'use client';

import type { CSSProperties } from 'react';

import { useForumStore } from '@/store/forumStore';
import styles from '@/styles/components/forum/CategoryCard.module.scss';
import type { ForumCategory } from '@/types/forum';

interface CategoryCardProps {
  category: ForumCategory;
}

export function CategoryCard({ category }: CategoryCardProps) {
  const navigateToTopicsInCategory = useForumStore((s) => s.navigateToTopicsInCategory);

  const handleClick = () => {
    navigateToTopicsInCategory(category.slug);
  };

  return (
    <article
      className={styles.card}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <div className={styles.header}>
        {category.color && (
          <div
            className={styles.colorBar}
            style={{ '--category-color': category.color } as CSSProperties}
          />
        )}
        {category.icon && <span className={styles.icon}>{category.icon}</span>}
        <div className={styles.headerContent}>
          <h2 className={styles.title}>{category.title}</h2>
        </div>
      </div>
      {category.description && (
        <p className={styles.description}>{category.description}</p>
      )}
    </article>
  );
}
