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
  const { document, sections, childDocuments } = data;
  const showTOC = sections && sections.length >= 2;

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const timeoutId = setTimeout(() => {
      const elementId = hash.substring(1);
      const element = window.document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [document.content]);

  return (
    <article className={styles.article}>
      <DocumentHeader document={document} />

      {document.description && (
        <p className={styles.description}>{document.description}</p>
      )}

      <div className={showTOC ? styles.bodyLayout : styles.bodyLayoutFullWidth}>
        <div className={styles.body}>
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

          {childDocuments && childDocuments.length > 0 && (
            <div className={styles.categoryContent}>
              <h2>Documenti correlati:</h2>
              <ul className={styles.subRoutesList}>
                {childDocuments.map((child) => (
                  <li key={child._id}>
                    {child.hasOwnPage && child.path ? (
                      <Link href={`/${document.type}/${child.path}`}>
                        <div className={styles.subRouteItem}>
                          <h3>{child.title}</h3>
                        </div>
                      </Link>
                    ) : (
                      <div className={styles.subRouteItem}>
                        <h3>{child.title}</h3>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!document.content && (!childDocuments || childDocuments.length === 0) && (
            <div className={styles.emptyState}>
              <p>Questo documento non contiene ancora contenuto.</p>
            </div>
          )}
        </div>

        {showTOC && (
          <aside className={styles.tocAside}>
            <TableOfContents mode="anchors" sections={sections} />
          </aside>
        )}
      </div>
    </article>
  );
}
