'use client';

import DOMPurify from 'isomorphic-dompurify';
import { useEffect, useRef } from 'react';

import { useIsDesktop } from '@/hooks/useIsDesktop';
import styles from '@/styles/components/documents/DocumentDetail.module.scss';
import type { DocumentDetail as DocumentDetailType } from '@/types/document'; 

import { TableOfContents } from './TableOfContents';


interface DocumentDetailProps {
  data: DocumentDetailType;
}

export function DocumentDetail({ data }: DocumentDetailProps): JSX.Element {
  const { document, sections, childDocuments } = data;
  const isDesktop = useIsDesktop(1024);
  // Lo spazio dell'indice sulla griglia resta riservato anche quando non c'è
  // abbastanza materiale per mostrarlo: altrimenti il contenuto si allarga a
  // piena larghezza e la larghezza dell'articolo cambia documento per
  // documento in modo inconsistente.
  const showTOC = isDesktop && sections && sections.length >= 2;
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hash = window.location.hash;

    if (hash) {
      const timeoutId = setTimeout(() => {
        const element = window.document.getElementById(hash.substring(1));
        if (element && articleRef.current) {
          articleRef.current.scrollTo({ top: element.offsetTop - 10, behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    articleRef.current?.scrollTo(0, 0);
  }, [document.content]);

  return ( 
      <article ref={articleRef} className={styles.article}>

        <div className={isDesktop ? styles.bodyLayout : styles.bodyLayoutFullWidth}>
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
                  ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel']
                })
              }}
            />
 
            {!document.content && (!childDocuments || childDocuments.length === 0) && (
              <div className={styles.emptyState}>
                <p>Questo documento non contiene ancora contenuto.</p>
              </div>
            )}
          </div>

          {showTOC && (
            <aside className={styles.tocAside}>
              <TableOfContents mode="anchors" sections={sections} scrollContainerRef={articleRef} />
            </aside>
          )}
        </div>
      </article>
  );
}
