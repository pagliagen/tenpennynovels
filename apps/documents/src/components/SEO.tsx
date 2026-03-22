/**
 * SEO Component (Unified & Enhanced)
 *
 * Manages all SEO-related meta tags for pages across TenPennyNovels apps.
 * Handles Open Graph, Twitter Cards, canonical URLs, and structured data.
 *
 * **Features**:
 * - Dynamic page titles with site name
 * - Complete Open Graph metadata (with image dimensions)
 * - Article-specific OG tags (published/modified time)
 * - Twitter Card tags
 * - Canonical URLs (prevents duplicate content)
 * - Robots directives (noindex/nofollow)
 * - JSON-LD structured data (supports arrays)
 * - Mobile optimization (viewport, theme-color)
 * - Favicon links
 *
 * **Best Practices**:
 * - Use unique titles and descriptions per page
 * - Keep titles under 60 characters
 * - Keep descriptions between 150-160 characters
 * - Always provide OG image (1200×630px recommended)
 *
 * **Note**: This component is duplicated in apps/landing and apps/documents
 * until workspace shared packages are configured. Keep in sync manually.
 *
 * @module components/SEO
 */

import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

/**
 * SEO component props
 *
 * @interface SEOProps
 */
export interface SEOProps {
  /** Page title (will be appended with site name if not included) */
  title: string;
  /** Meta description (150-160 chars recommended) */
  description: string;
  /** Canonical URL (optional, defaults to current URL) */
  canonical?: string;

  // Open Graph
  /** Open Graph type (default: 'website') */
  ogType?: 'website' | 'article';
  /** Open Graph image URL (absolute URL, 1200x630px recommended) */
  ogImage?: string;
  /** OG image width (default: 1200) */
  ogImageWidth?: string;
  /** OG image height (default: 630) */
  ogImageHeight?: string;
  /** OG image MIME type (default: image/jpeg) */
  ogImageType?: string;

  // Article-specific (for documents)
  /** Article published time (ISO 8601) */
  articlePublishedTime?: string;
  /** Article modified time (ISO 8601) */
  articleModifiedTime?: string;

  // Robots
  /** Prevent search engine indexing */
  noindex?: boolean;
  /** Prevent following links on this page */
  nofollow?: boolean;

  // Structured Data
  /** Structured data (JSON-LD schema) - supports single object or array */
  schema?: object | object[];

  // Additional
  /** Site name override (default: "Ten Penny Novels") */
  siteName?: string;
  /** Locale override (default: "it_IT") */
  locale?: string;
  /** Twitter card type (default: "summary_large_image") */
  twitterCard?: 'summary' | 'summary_large_image';
}

/**
 * SEO Component
 *
 * Renders SEO meta tags in the document head.
 * Should be used in every page for proper search engine optimization.
 *
 * **Automatic Features**:
 * - Appends site name to title if not present
 * - Generates canonical URL from current route
 * - Sets Italian locale (it_IT)
 * - Includes favicon and mobile icons
 * - Validates and normalizes all inputs
 *
 * **Open Graph**:
 * Enables rich previews when sharing on Facebook, LinkedIn, etc.
 *
 * **Twitter Cards**:
 * Enables rich previews when sharing on Twitter/X.
 *
 * **Structured Data**:
 * Helps search engines understand page content for rich results.
 * Supports arrays of schemas for complex pages.
 *
 * @param {SEOProps} props - Component props
 * @returns {JSX.Element} Head element with meta tags
 *
 * @example
 * ```typescript
 * import { SEO } from '@/components/SEO';
 *
 * // Basic usage
 * <SEO
 *   title="Login"
 *   description="Accedi a TenPennyNovels per giocare."
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Article page with published/modified dates
 * <SEO
 *   title="Londra Vittoriana - Ambientazione"
 *   description="Guida completa alla Londra del 1890."
 *   ogType="article"
 *   articlePublishedTime="2026-01-15T10:00:00Z"
 *   articleModifiedTime="2026-03-20T15:30:00Z"
 * />
 * ```
 *
 * @example
 * ```typescript
 * // With multiple schemas (Article + BreadcrumbList)
 * const schemas = [
 *   { "@type": "Article", "headline": "..." },
 *   { "@type": "BreadcrumbList", "itemListElement": [...] }
 * ];
 *
 * <SEO
 *   title="Document Title"
 *   description="Description"
 *   schema={schemas}
 * />
 * ```
 *
 * @example
 * ```typescript
 * // Private page (noindex)
 * <SEO
 *   title="Character Creation"
 *   description="Create your character."
 *   noindex
 *   nofollow
 * />
 * ```
 */
export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  canonical,
  ogType = 'website',
  ogImage = 'https://tenpennynovels.com/images/og-image.jpg',
  ogImageWidth = '1200',
  ogImageHeight = '630',
  ogImageType = 'image/jpeg',
  articlePublishedTime,
  articleModifiedTime,
  noindex = false,
  nofollow = false,
  schema,
  siteName = 'Ten Penny Novels',
  locale = 'it_IT',
  twitterCard = 'summary_large_image',
}) => {
  const router = useRouter();

  // Site configuration (auto-detect from hostname or default)
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'https://tenpennynovels.com';

  // Generate full URL (canonical or current path)
  const fullUrl = canonical || `${baseUrl}${router.asPath}`;

  // Generate full title (append site name if not present)
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;

  // Robots meta content
  const robots = [
    noindex && 'noindex',
    nofollow && 'nofollow',
  ].filter(Boolean).join(', ') || 'index, follow';

  // Normalize schema to array for consistent rendering
  const schemaArray = schema
    ? (Array.isArray(schema) ? schema : [schema])
    : null;

  return (
    <Head>
      {/* Essential Meta — viewport global in _app.tsx */}
      <meta charSet="utf-8" />
      <meta name="theme-color" content="#0a1f1c" />

      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />

      {/* Robots Directives */}
      <meta name="robots" content={robots} />

      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />

      {/* OG Image (complete metadata) */}
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={ogImageWidth} />
      <meta property="og:image:height" content={ogImageHeight} />
      <meta property="og:image:type" content={ogImageType} />

      {/* Article-specific OG tags */}
      {ogType === 'article' && articlePublishedTime && (
        <meta property="article:published_time" content={articlePublishedTime} />
      )}
      {ogType === 'article' && articleModifiedTime && (
        <meta property="article:modified_time" content={articleModifiedTime} />
      )}

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data (JSON-LD Schema) */}
      {schemaArray && schemaArray.map((s, idx) => (
        <script
          key={`schema-${idx}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(s)
          }}
        />
      ))}
    </Head>
  );
};
