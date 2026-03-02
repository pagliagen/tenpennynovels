/**
 * Preview panel showing rendered document (WYSIWYG accuracy)
 * Matches public documents frontend styling
 */
import React, { useMemo } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { tiptapDeltaToHTML } from '@/lib/tiptap/htmlRenderer';
import styles from './DocumentPreview.module.scss';

interface DocumentPreviewProps {
  contentDelta: any;
  title: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  contentDelta,
  title
}) => {
  // Convert Delta → HTML
  const rawHTML = useMemo(() => tiptapDeltaToHTML(contentDelta), [contentDelta]);

  // Sanitize HTML (same as public frontend)
  const sanitizedHTML = useMemo(() => {
    return DOMPurify.sanitize(rawHTML, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u',
        'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote',
        'a', 'code', 'pre', 'hr'
      ],
      ALLOWED_ATTR: ['href', 'title', 'class']
    });
  }, [rawHTML]);

  return (
    <div className={styles.previewContainer}>
      <header className={styles.previewHeader}>
        <h1>{title}</h1>
        <span className={styles.badge}>Preview</span>
      </header>

      <div
        className={styles.previewContent}
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      />
    </div>
  );
};
