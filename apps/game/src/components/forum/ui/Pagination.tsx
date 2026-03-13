'use client';

import styles from '@/styles/components/forum/Pagination.module.scss';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  const maxVisible = 7;
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | 'ellipsis')[] = [];
  pages.push(1);
  if (page > 3) pages.push('ellipsis');
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  if (page < totalPages - 2) pages.push('ellipsis');
  if (totalPages > 1) pages.push(totalPages);
  return pages;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps): JSX.Element {
  if (totalPages <= 1) return <></>;

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav className={styles.pagination} aria-label="Paginazione">
      <button
        type="button"
        className={styles.prevBtn}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Pagina precedente"
      >
        ← Precedente
      </button>
      <div className={styles.pages}>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className={styles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${styles.pageBtn} ${p === page ? styles.active : ''}`}
              onClick={() => onPageChange(p)}
              aria-label={`Pagina ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
      </div>
      <button
        type="button"
        className={styles.nextBtn}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Pagina successiva"
      >
        Successiva →
      </button>
    </nav>
  );
}
