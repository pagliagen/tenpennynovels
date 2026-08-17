/**
 * DocumentSection Component
 *
 * Renders a single document section with sanitized HTML content.
 * Victorian-styled typography for article-like reading experience.
 *
 * @module components/documents/DocumentSection
 * @since 1.0.0
 */

'use client';

import DOMPurify from 'isomorphic-dompurify';

import styles from '@/styles/components/documents/DocumentDetail.module.scss';
import type { DocumentSection as DocumentSectionType } from '@/types/document';

interface DocumentSectionProps {
  section: DocumentSectionType;
  showTitle?: boolean;
}

export function DocumentSection({ section, showTitle = true }: DocumentSectionProps): JSX.Element {
  // Sanitize HTML content (backend already sanitizes, but double-check for safety)
  const sanitizedContent = DOMPurify.sanitize(section.content, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',  // Added H1 support (now using H1 for chunks instead of H2/H3)
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'img',
      'code',
      'pre',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      's',        // Added strikethrough support
      'mark',     // Added highlight support
      'sub',      // Added subscript support
      'sup',      // Added superscript support
      'span',     // Added span for text styles
    ],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel', 'style'],  // Added style for text colors/sizes
  });

  return (
    <section className={styles.section} id={section.slug}>
      {showTitle && section.title && <h2 className={styles.sectionTitle}>{section.title}</h2>}

      <div
        className={styles.sectionContent}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      />
    </section>
  );
}
