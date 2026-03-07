/**
 * TableOfContents Component
 *
 * Sticky table of contents with two modes:
 * - 'routes': Links to child document pages (parent view)
 * - 'anchors': Anchor links within same page (child view)
 *
 * @module components/documents/TableOfContents
 * @since 1.0.0
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DocumentSection, HierarchicalChild } from '@/types/document';
import styles from '@/styles/components/documents/TableOfContents.module.scss';

interface TableOfContentsProps {
  mode: 'routes' | 'anchors' | 'hierarchical';
  items?: Array<{  // For 'routes' mode
    _id: string;
    slug: string;
    title: string;
    depth: number;
    order: number;
  }>;
  sections?: DocumentSection[];  // For 'anchors' mode
  childDocuments?: HierarchicalChild[];  // For 'hierarchical' mode
  currentPath?: string;  // Current document path
  baseUrl?: string;  // For constructing route URLs
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

const SCROLL_OFFSET = 30;

export function TableOfContents({ mode, items, sections, childDocuments, currentPath, baseUrl, scrollContainerRef }: TableOfContentsProps): JSX.Element {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'anchors' || !sections) return;

    const container = scrollContainerRef?.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop + SCROLL_OFFSET;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (!section) continue;

        const element = document.getElementById(section.slug);

        if (element && element.offsetTop <= scrollTop) {
          setActiveSection(section.slug);
          break;
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [mode, sections, scrollContainerRef]);

  const scrollToSection = (slug: string) => {
    const element = document.getElementById(slug);
    const container = scrollContainerRef?.current;
    if (element && container) {
      container.scrollTo({ top: element.offsetTop - SCROLL_OFFSET, behavior: 'smooth' });
      window.history.pushState(null, '', `#${slug}`);
    }
  };

  // Routes mode: TOC with links to child document pages
  if (mode === 'routes' && items && baseUrl) {
    if (items.length === 0) return <></>;

    return (
      <nav className={styles.toc}>
        <h3 className={styles.tocTitle}>Indice</h3>
        <ul className={styles.tocList}>
          {items.map(item => (
            <li
              key={item._id}
              className={styles.tocItem}
              style={{ '--depth': item.depth - 1 } as React.CSSProperties}
            >
              <Link href={`${baseUrl}/${item.slug}`} className={styles.tocLink}>
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // Anchors mode: TOC with anchor links within same page
  if (mode === 'anchors' && sections) {
    // Filter out root chunks, only show document titles and child sections
    const tocSections = sections.filter(s => !s.isRootChunk);

    if (tocSections.length === 0) return <></>;

    return (
      <nav className={styles.toc}>
        <h3 className={styles.tocTitle}>Indice</h3>
        <ul className={styles.tocList}>
          {tocSections.map(section => (
            <li
              key={section._id}
              className={`${styles.tocItem} ${activeSection === section.slug ? styles.active : ''}`}
              style={{ '--depth': section.depth || 0 } as React.CSSProperties}
            >
              <a
                href={`#${section.slug}`}
                className={styles.tocLink}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(section.slug);
                }}
              >
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  // Hierarchical mode: Mixed links (external routes + anchors) in hierarchical structure
  if (mode === 'hierarchical' && childDocuments) {
    if (childDocuments.length === 0) return <></>;

    // Recursive function to render hierarchical structure
    const renderHierarchical = (docs: HierarchicalChild[], parentPath?: string): JSX.Element[] => {
      return docs.map(doc => {
        return (
          <li key={doc._id} className={styles.tocItem} style={{ '--depth': doc.depth - 1 } as React.CSSProperties}>
            {doc.hasOwnPage ? (
              <Link href={doc.path!} className={styles.tocLink}>
                {doc.title}
              </Link>
            ) : (
              // Anchor link (document will be embedded in parent)
              <a
                href={`${parentPath}#${doc.slug}`}
                className={styles.tocLink}
                onClick={(e) => {
                  e.preventDefault();
                  // Only scroll if we're already on the parent page
                  if (window.location.pathname === parentPath) {
                    scrollToSection(doc.slug);
                  } else {
                    // Navigate to parent page with anchor
                    window.location.href = `${parentPath}#${doc.slug}`;
                  }
                }}
              >
                {doc.title}
              </a>
            )}
            {/* Recursively render children */}
            {doc.children && doc.children.length > 0 && (
              <ul className={styles.tocList}>
                {renderHierarchical(doc.children, doc.hasOwnPage ? doc.path : parentPath)}
              </ul>
            )}
          </li>
        );
      });
    };

    return (
      <nav className={styles.toc}>
        <h3 className={styles.tocTitle}>Indice</h3>
        <ul className={styles.tocList}>
          {renderHierarchical(childDocuments, currentPath)}
        </ul>
      </nav>
    );
  }

  return <></>;
}
