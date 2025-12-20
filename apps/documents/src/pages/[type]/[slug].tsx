import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { DocumentsLayout } from '@/components/DocumentsLayout';
import { getDocument, Document, DocumentSection, DocumentType } from '@/lib/documentApi';
import { AuthContext } from '@/lib/auth';
import styles from '@/styles/pages/DocumentDetail.module.scss';
import layoutStyles from '@/styles/components/DocumentsLayout.module.scss';

interface DocumentDetailProps {
  document: Document;
  sections: DocumentSection[];
  authContext: AuthContext;
}

export default function DocumentDetail({
  document,
  sections = [],
  authContext = { isAuthenticated: false, tokens: {} }
}: DocumentDetailProps) {
  if (!document) {
    return (
      <DocumentsLayout authContext={authContext}>
        <div>Document not found</div>
      </DocumentsLayout>
    );
  }
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Data sconosciuta';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Data non valida';
    return dateObj.toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const extractSectionTitle = (content: string): string => {
    // Extract title from markdown headers (# or ##)
    const match = content.match(/^#{1,2}\s+(.+)$/m);
    return match ? match[1].trim() : `Sezione ${sections.indexOf(sections.find(s => s.content === content) || sections[0]) + 1}`;
  };

  const convertMarkdownToHtml = (content: string): string => {
    // Convert markdown headers to HTML
    return content
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.*)$/gm, (match, line) => {
        if (line.startsWith('<h') || line.startsWith('</p>') || line.startsWith('<p>')) {
          return line;
        }
        return `<p>${line}</p>`;
      })
      .replace(/<p><\/p>/g, '')
      .replace(/^<p>/, '')
      .replace(/<\/p>$/, '');
  };

  const getDocumentTypeInfo = (type: DocumentType) => {
    switch (type) {
      case 'ambientazione':
        return {
          icon: '🌍',
          label: 'Ambientazione',
          description: 'Ambientazione e storia della Londra Vittoriana',
          backLink: '/ambientazione',
          backText: 'Torna all\'Ambientazione',
          otherLink: '/regolamento',
          otherText: '📜 Vai al Regolamento'
        };
      case 'regolamento':
        return {
          icon: '📜',
          label: 'Regolamento',
          description: 'Regole e meccaniche per Call of Cthulhu',
          backLink: '/regolamento',
          backText: 'Torna al Regolamento',
          otherLink: '/ambientazione',
          otherText: '🌍 Vai all\'Ambientazione'
        };
      default:
        return {
          icon: '📄',
          label: 'Documento',
          description: 'Documento di gioco',
          backLink: '/',
          backText: 'Torna ai Documenti',
          otherLink: '/search',
          otherText: '🔍 Ricerca Documenti'
        };
    }
  };

  const typeInfo = getDocumentTypeInfo(document.type);

  // Create sidebar content with table of contents
  const sidebarContent = (
    <>
      {/* Table of Contents */}
      {sections.length > 1 && (
        <div className={layoutStyles.sidebarSection}>
          <h3>Indice dei Contenuti</h3>
          <ul className={layoutStyles.sidebarMenu}>
            {sections.map(section => (
              <li key={section.id}>
                <a
                  href={`#section-${section.order}`}
                  className={layoutStyles.sidebarLink}
                >
                  {extractSectionTitle(section.content)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <DocumentsLayout
      authContext={authContext}
      title={`${document.title} - ${typeInfo.label} - TenpennyNovels`}
      description={`Documento di ${document.type}: ${document.title}. ${typeInfo.description}`}
      sidebarContent={sidebarContent}
    >
      <article className={styles.documentDetail}>
        {/* Simplified Document Header */}
        <header className={styles.documentHeader}>
          <h1 className={styles.documentTitle}>
            {document.title}
          </h1>

          {document.description && (
            <p className={styles.documentDescription}>
              {document.description}
            </p>
          )}

          <div className={styles.headerMeta}>
            <small className={styles.lastUpdate}>
              Ultimo aggiornamento: {formatDate(document.lastUpdated)}
            </small>
          </div>
        </header>

        {/* Document Content */}
        <div className={styles.documentContent}>
          {sections.length === 0 ? (
            <div className={styles.emptyContent}>
              <div className={styles.emptyIcon}>📝</div>
              <h3>Contenuto non disponibile</h3>
              <p>Questo documento non ha ancora contenuti pubblicati.</p>
            </div>
          ) : (
            sections
              .sort((a, b) => a.order - b.order)
              .map(section => (
                <section
                  key={section.id}
                  className={styles.documentSection}
                  id={`section-${section.order}`}
                >
                  <div
                    className={styles.sectionContent}
                    dangerouslySetInnerHTML={{ __html: convertMarkdownToHtml(section.content) }}
                  />
                </section>
              ))
          )}
        </div>

        {/* Document Footer */}
        <footer className={styles.documentFooter}>
          <div className={styles.footerActions}>
            <Link href={typeInfo.backLink as string} className={styles.backButton}>
              ← {typeInfo.backText}
            </Link>

            <div className={styles.navigationButtons}>
              <Link href={typeInfo.otherLink as string} className={styles.navButton}>
                {typeInfo.otherText}
              </Link>
              <Link href="/search" className={styles.navButton}>
                🔍 Ricerca Documenti
              </Link>
            </div>
          </div>

          <div className={styles.documentInfo}>
            <p className={styles.lastUpdate}>
              Ultimo aggiornamento: {formatDate(document.lastUpdated)}
            </p>
            <p className={styles.version}>
              Versione del documento: {document.activeVersion}
            </p>
          </div>
        </footer>
      </article>
    </DocumentsLayout>
  );
}

