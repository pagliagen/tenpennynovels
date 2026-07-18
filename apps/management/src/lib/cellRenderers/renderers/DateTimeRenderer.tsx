/**
 * DateTime Cell Renderer - Format dates/times
 */

import React from 'react';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CellRendererProps } from '../registry';

import styles from './CellRenderers.module.scss';
import { logger } from '@/lib/logger';

export function DateTimeRenderer({ value, column }: CellRendererProps): React.ReactNode {
  if (!value) {
    return <span className={styles.empty}>-</span>;
  }

  try {
    // Parse date
    const date = typeof value === 'string' ? parseISO(value) : new Date(value as string | number | Date);

    if (!isValid(date)) {
      return <span className={styles.empty}>Data non valida</span>;
    }

    // Get format from column config
    const formatType = column.render?.format || 'datetime';

    // Handle different format types
    if (formatType === 'relative') {
      // Show only relative time
      const relativeTime = formatDistanceToNow(date, { addSuffix: true, locale: it });
      return <span>{relativeTime}</span>;
    }

    // Map format shortcuts to date-fns patterns
    const formatPatterns: Record<string, string> = {
      'date': 'dd/MM/yyyy',
      'datetime': 'dd/MM/yyyy HH:mm',
      'time': 'HH:mm'
    };

    const datePattern = formatPatterns[formatType] || formatType;
    const formattedDate = format(date, datePattern, { locale: it });

    return <span>{formattedDate}</span>;
  } catch (error) {
    logger.error('Error formatting date:', { error });
    return <span className={styles.empty}>Errore formato</span>;
  }
}
