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
  "name": "TenPennyNovels",
  "url": "https://tenpennynovels.com",
  "logo": "https://tenpennynovels.com/images/title.png",
  "description": "Gioco di ruolo online ambientato nella Londra Vittoriana. Esperienza GDR Call of Cthulhu via chat con narrazione stile Agatha Christie.",
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "privacy@tenpennynovels.com",
    "contactType": "Privacy and Support"
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
  "name": "TenPennyNovels",
  "url": "https://tenpennynovels.com",
  "inLanguage": "it",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://tenpennynovels.com/?q={search_term_string}"
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
  "name": "TenPennyNovels - Londra Vittoriana",
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
  "inLanguage": "it",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "ratingCount": "47"
  }
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
  "name": "TenPennyNovels - Londra Vittoriana",
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
    "name": "TenPennyNovels"
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
 * Privacy Page Breadcrumb
 *
 * @constant
 */
export const privacyBreadcrumb = createBreadcrumbSchema([
  { name: "Home", url: "https://tenpennynovels.com/" },
  { name: "Privacy Policy", url: "https://tenpennynovels.com/privacy/" }
]);

/**
 * Terms Page Breadcrumb
 *
 * @constant
 */
export const termsBreadcrumb = createBreadcrumbSchema([
  { name: "Home", url: "https://tenpennynovels.com/" },
  { name: "Termini e Condizioni", url: "https://tenpennynovels.com/terms/" }
]);

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
 * About Page Breadcrumb
 *
 * @constant
 */
export const aboutBreadcrumb = createBreadcrumbSchema([
  { name: "Home", url: "https://tenpennynovels.com/" },
  { name: "Chi Siamo", url: "https://tenpennynovels.com/about/" }
]);
