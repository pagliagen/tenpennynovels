/**
 * DocumentDetail Component
 *
 * Complete document view with header, TOC, and sections.
 * Victorian-styled article layout with ornate decorations.
 *
 * For categories: displays list of sub-routes as navigation links.
 * For documents: displays sections with TOC.
 *
 * @module components/documents/DocumentDetail
 * @since 1.0.0
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import type { DocumentDetail as DocumentDetailType } from '@/types/document';
import { DocumentHeader } from './DocumentHeader';
import { TableOfContents } from './TableOfContents';
import styles from '@/styles/components/documents/DocumentDetail.module.scss';

interface DocumentDetailProps {
  data: DocumentDetailType;
}

export function DocumentDetail({ data }: DocumentDetailProps): JSX.Element {
  const { document, sections, subRoutes } = data;

  // Show TOC only if there are 2+ sections
  const showTOC = sections && sections.length >= 2;

  // ✅ FIX: Scroll to anchor on page load (e.g., direct navigation to #scienza)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    // Wait for DOM to be fully rendered (dangerouslySetInnerHTML needs time)
    const timeoutId = setTimeout(() => {
      const elementId = hash.substring(1); // Remove '#' prefix
      const element = window.document.getElementById(elementId); // Use window.document to avoid conflict with destructured 'document' variable

      if (element) {
        // Scroll with smooth behavior
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100); // Small delay to ensure HTML is injected

    return () => clearTimeout(timeoutId);
  }, [document.content]); // Re-run if content changes

  return (
    <article className={styles.article}>
      <DocumentHeader document={document} />

      <div className={showTOC ? styles.bodyLayout : styles.bodyLayoutFullWidth}>
        {/* Main Content */}
        <div className={styles.body}>
          {/* Render HTML content with H2 anchors */}
          <div
            className={styles.documentContent}
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(document.content || '', {
                ALLOWED_TAGS: [
                  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'hr',
                  'table', 'thead', 'tbody', 'tr', 'th', 'td', 's', 'mark', 'sub', 'sup', 'span'
                ],
                ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel', 'style']
              })
            }}
          />

          {/* Sub-routes listing (if any) - shown AFTER main content */}
          {subRoutes && subRoutes.length > 0 && (
            <div className={styles.categoryContent}>
              <h2>Documenti correlati:</h2>
              <ul className={styles.subRoutesList}>
                {subRoutes.map((subRoute) => (
                  <li key={subRoute.path}>
                    <Link href={`/${document.type}/${subRoute.path}`}>
                      <div className={styles.subRouteItem}>
                        <h3>{subRoute.title}</h3>
                        {subRoute.description && (
                          <p className={styles.subRouteDescription}>{subRoute.description}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty State - only if NO content AND NO subRoutes */}
          {!document.content && (!subRoutes || subRoutes.length === 0) && (
            <div className={styles.emptyState}>
              <p>Questo documento non contiene ancora contenuto.</p>
            </div>
          )}
        </div>

        {/* Table of Contents - ONLY for sections (anchors mode) */}
        {showTOC && (
          <aside className={styles.tocAside}>
            <TableOfContents
              mode="anchors"
              sections={sections}
            />
          </aside>
        )}
      </div>
    </article>
  );
}
