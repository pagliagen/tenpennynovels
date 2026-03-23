/**
 * SEO Schema Definitions
 *
 * JSON-LD schemas for structured data markup.
 * Improves search engine visibility and rich snippets.
 *
 * **Schemas**:
 * - Organization: Defines TenPennyNovels organization
 * - WebSite: Defines website metadata
 * - WebApplication: Defines app as a game application
 * - VideoGame: Defines app as a video game
 * - Breadcrumb: Navigation breadcrumbs for pages
 *
 * @module utils/schemas
 */

/**
 * Organization Schema
 *
 * Identifies TenPennyNovels organization for search engines.
 *
 * @constant
 */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://tenpennynovels.com/#organization",
  "name": "Ten Penny Novels",
  "url": "https://tenpennynovels.com",
  "logo": {
    "@type": "ImageObject",
    "url": "https://tenpennynovels.com/images/title.png",
    "width": 512,
    "height": 512
  },
  "description": "Gioco di ruolo online ambientato nella Londra Vittoriana. Esperienza GDR Call of Cthulhu via chat con narrazione stile Agatha Christie.",
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "privacy@tenpennynovels.com",
    "contactType": "customer support"
  }
};

/**
 * WebSite Schema
 *
 * Identifies website metadata and search functionality.
 *
 * @constant
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://tenpennynovels.com/#website",
  "name": "Ten Penny Novels",
  "url": "https://tenpennynovels.com",
  "inLanguage": "it",
  "publisher": {
    "@id": "https://tenpennynovels.com/#organization"
  },
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://documenti.tenpennynovels.com/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

/**
 * WebApplication Schema
 *
 * Defines TenPennyNovels as a web application game.
 *
 * @constant
 */
export const webApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Ten Penny Novels - Londra Vittoriana",
  "url": "https://tenpennynovels.com",
  "applicationCategory": "Game",
  "applicationSubCategory": "Role-Playing Game",
  "description": "Gioco di ruolo online gratuito ambientato nella Londra Vittoriana degli anni 1890. Sistema Call of Cthulhu via chat con narrazione investigativa in stile Agatha Christie. Crea il tuo personaggio ed esplora i misteri della capitale inglese.",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR"
  },
  "genre": ["Horror", "Mystery", "Victorian Era", "Role-Playing Game"],
  "gamePlatform": "Web",
  "inLanguage": "it"
};

/**
 * VideoGame Schema
 *
 * Alternative schema defining TenPennyNovels as a video game.
 *
 * @constant
 */
export const videoGameSchema = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "Ten Penny Novels - Londra Vittoriana",
  "description": "Gioco di ruolo online gratuito basato su Call of Cthulhu. Ambientazione Londra Vittoriana 1890. Narrazione investigativa via chat.",
  "url": "https://tenpennynovels.com",
  "genre": ["Horror", "Mystery", "Role-Playing"],
  "gamePlatform": "Web Browser",
  "operatingSystem": "Web",
  "applicationCategory": "Game",
  "inLanguage": "it",
  "playMode": "MultiPlayer",
  "author": {
    "@type": "Organization",
    "name": "Ten Penny Novels"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  }
};

/**
 * Homepage Schema
 *
 * Combined schema for homepage with all metadata.
 *
 * @constant
 */
export const homeSchema = {
  "@context": "https://schema.org",
  "@graph": [
    organizationSchema,
    websiteSchema,
    webApplicationSchema
  ]
};

/**
 * Create Breadcrumb Schema
 *
 * Generate breadcrumb navigation schema for pages.
 *
 * @param {Array<{name: string, url: string}>} items - Breadcrumb items
 * @returns {Object} Breadcrumb schema object
 *
 * @example
 * ```typescript
 * const breadcrumb = createBreadcrumbSchema([
 *   { name: "Home", url: "https://tenpennynovels.com/" },
 *   { name: "Privacy", url: "https://tenpennynovels.com/privacy/" }
 * ]);
 * ```
 */
export const createBreadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

/**
 * Credits Page Breadcrumb
 *
 * @constant
 */
export const creditsBreadcrumb = createBreadcrumbSchema([
  { name: "Home", url: "https://tenpennynovels.com/" },
  { name: "Crediti", url: "https://tenpennynovels.com/credits/" }
]);

/**
 * Create Article Schema (for Documents)
 *
 * Generate Article schema for document pages with complete metadata.
 *
 * @param {Object} document - Document data
 * @returns {Object} Article schema object
 *
 * @example
 * ```typescript
 * const schema = createArticleSchema({
 *   title: "Londra Vittoriana",
 *   description: "Guida alla Londra del 1890",
 *   type: "ambientazione",
 *   path: "introduzione/londra",
 *   createdAt: new Date("2026-01-15"),
 *   lastUpdated: new Date("2026-03-20"),
 *   content: "..."
 * });
 * ```
 */
export function createArticleSchema(document: {
  title: string;
  description: string;
  type: string;
  path: string;
  createdAt: Date;
  lastUpdated?: Date;
  content?: string;
}): object {
  const url = `https://documenti.tenpennynovels.com/${document.type}/${document.path}`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    "headline": document.title,
    "description": document.description,
    "url": url,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url
    },
    "datePublished": document.createdAt.toISOString(),
    "dateModified": (document.lastUpdated || document.createdAt).toISOString(),
    "author": {
      "@id": "https://tenpennynovels.com/#organization"
    },
    "publisher": {
      "@id": "https://tenpennynovels.com/#organization"
    },
    "image": {
      "@type": "ImageObject",
      "url": "https://documenti.tenpennynovels.com/images/og-image.jpg",
      "width": 1200,
      "height": 630
    },
    "articleSection": document.type === 'ambientazione' ? 'Ambientazione' : 'Regolamento',
    "wordCount": document.content ? document.content.split(/\s+/).length : undefined,
    "inLanguage": "it-IT"
  };
}

/**
 * Create Hierarchical Breadcrumb Schema (for Documents)
 *
 * Generate breadcrumb schema for hierarchical document paths.
 *
 * @param {string} type - Document type (ambientazione/regolamento)
 * @param {string[]} pathSegments - Path segments array
 * @param {string[]} titles - Title for each segment
 * @returns {Object} BreadcrumbList schema object
 *
 * @example
 * ```typescript
 * const schema = createDocumentBreadcrumbSchema(
 *   'ambientazione',
 *   ['introduzione', 'londra'],
 *   ['Introduzione', 'Londra Vittoriana']
 * );
 * // Generates:
 * // Home → Ambientazione → Introduzione → Londra Vittoriana
 * ```
 */
export function createDocumentBreadcrumbSchema(
  type: string,
  pathSegments: string[],
  titles: string[]
): object {
  const BASE_URL = 'https://documenti.tenpennynovels.com';

  const items = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": BASE_URL
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": type === 'ambientazione' ? 'Ambientazione' : 'Regolamento',
      "item": `${BASE_URL}/${type}`
    },
    ...pathSegments.map((segment, idx) => ({
      "@type": "ListItem",
      "position": idx + 3,
      "name": titles[idx] || segment,
      "item": `${BASE_URL}/${type}/${pathSegments.slice(0, idx + 1).join('/')}`
    }))
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items
  };
}