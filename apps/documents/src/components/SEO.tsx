/**
 * SEO Component
 *
 * Manages all SEO-related meta tags for each page.
 * Handles Open Graph, Twitter Cards, canonical URLs, and structured data.
 *
 * **Features**:
 * - Dynamic page titles with site name
 * - Meta descriptions
 * - Open Graph tags (Facebook sharing)
 * - Twitter Card tags
 * - Canonical URLs (prevents duplicate content)
 * - Robots directives (noindex/nofollow)
 * - JSON-LD structured data for rich results
 *
 * **Best Practices**:
 * - Use unique titles and descriptions per page
 * - Keep titles under 60 characters
 * - Keep descriptions between 150-160 characters
 * - Always provide OG image (1200×630px recommended)
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
  /** Page title (will be appended with "| TenPennyNovels" if not included) */
  title: string;
  /** Meta description (150-160 chars recommended) */
  description: string;
  /** Canonical URL (optional, defaults to current URL) */
  canonical?: string;
  /** Open Graph type (default: 'article' for documents) */
  ogType?: 'website' | 'article';
  /** Open Graph image URL (absolute URL) */
  ogImage?: string;
  /** Prevent search engine indexing */
  noindex?: boolean;
  /** Prevent following links on this page */
  nofollow?: boolean;
  /** Structured data (JSON-LD schema) */
  schema?: object;
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
 * - Includes favicon reference
 *
 * **Open Graph**:
 * Enables rich previews when sharing on Facebook, LinkedIn, etc.
 *
 * **Twitter Cards**:
 * Enables rich previews when sharing on Twitter/X.
 *
 * **Structured Data**:
 * Helps search engines understand page content for rich results.
 *
 * @param {SEOProps} props - Component props
 * @returns {JSX.Element} Head element with meta tags
 *
 * @example
 * ```typescript
 * import { SEO } from '@/components/SEO';
 *
 * function DocumentPage() {
 *   return (
 *     <>
 *       <SEO
 *         title="Londra Vittoriana - Ambientazione"
 *         description="Guida completa alla Londra Vittoriana del 1890 per TenPennyNovels."
 *       />
 *       <DocumentContent />
 *     </>
 *   );
 * }
 * ```
 */
export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  canonical,
  ogType = 'article',
  ogImage = 'https://docs.tenpennynovels.com/images/og-image.jpg',
  noindex = false,
  nofollow = false,
  schema,
}) => {
  const router = useRouter();

  // Site configuration
  const siteName = 'TenPennyNovels';
  const baseUrl = 'https://docs.tenpennynovels.com';

  // Generate full URL (canonical or current path)
  const fullUrl = canonical || `${baseUrl}${router.asPath}`;

  // Generate full title (append site name if not present)
  const fullTitle = title.includes(siteName) ? title : `${title} - ${siteName}`;

  // Robots meta content
  const robotsContent = noindex || nofollow
    ? `${noindex ? 'noindex' : 'index'},${nofollow ? 'nofollow' : 'follow'}`
    : undefined;

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />

      {/* Viewport & Charset */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta charSet="UTF-8" />

      {/* Robots Directives */}
      {robotsContent && <meta name="robots" content={robotsContent} />}

      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="it_IT" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data (JSON-LD Schema) */}
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
    </Head>
  );
};
