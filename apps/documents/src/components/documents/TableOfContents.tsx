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

import { useState, useEffect } from 'react';
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
}

export function TableOfContents({ mode, items, sections, childDocuments, currentPath, baseUrl }: TableOfContentsProps): JSX.Element {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Scroll tracking (only for anchors mode)
  useEffect(() => {
    if (mode !== 'anchors' || !sections) return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (!section) continue;

        const element = document.getElementById(section.slug);

        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.slug);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [mode, sections]);

  const scrollToSection = (slug: string) => {
    const element = document.getElementById(slug);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL with hash (without triggering page reload)
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
              style={{ marginLeft: `${(item.depth - 1) * 20}px` }}
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
              style={{ marginLeft: `${(section.depth || 0) * 20}px` }}
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
        const indent = (doc.depth - 1) * 20;

        return (
          <li key={doc._id} className={styles.tocItem} style={{ marginLeft: `${indent}px` }}>
            {doc.hasRoute ? (
              // External link to route
              <Link href={doc.routePath!} className={styles.tocLink}>
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
                {renderHierarchical(doc.children, doc.hasRoute ? doc.routePath : parentPath)}
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
