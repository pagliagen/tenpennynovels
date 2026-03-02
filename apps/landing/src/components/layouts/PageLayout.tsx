/**
 * Page Layout Component
 *
 * Base layout wrapper for all pages.
 * Combines SEO + VictorianLayout to eliminate 10-15 lines per page.
 *
 * **Benefits**:
 * - **DRY**: Single component wraps SEO + VictorianLayout
 * - **Consistency**: All pages use same base structure
 * - **Maintainability**: Change layout once, affects all pages
 *
 * **Wrapped Components**:
 * - SEO: Meta tags, Open Graph, Twitter Cards
 * - VictorianLayout: Victorian frame, navigation, background
 *
 * @module components/layouts/PageLayout
 */

import React from 'react';
import { SEO, type SEOProps } from '../SEO';
import { VictorianLayout } from '../VictorianLayout';

/**
 * PageLayout component props
 *
 * @interface PageLayoutProps
 * @extends SEOProps
 */
export interface PageLayoutProps extends Omit<SEOProps, 'title' | 'description'> {
  /** Page title (required) */
  title: string;
  /** Meta description (required) */
  description: string;
  /** Page content */
  children: React.ReactNode;
  /** Optional Victorian layout subtitle */
  subtitle?: string;
}

/**
 * Page Layout Component
 *
 * Renders a complete page with SEO metadata and Victorian layout.
 * Use this as the base wrapper for all pages.
 *
 * **Structure**:
 * ```
 * <SEO ... />
 * <VictorianLayout>
 *   {children}
 * </VictorianLayout>
 * ```
 *
 * **Eliminated Boilerplate**:
 * - SEO component import
 * - VictorianLayout component import
 * - SEO + VictorianLayout wrapping
 * Total: ~10 lines per page
 *
 * @param {PageLayoutProps} props - Component props
 * @returns {JSX.Element} Rendered page layout
 *
 * @example
 * ```typescript
 * import { PageLayout } from '@/components/layouts/PageLayout';
 *
 * function CreditsPage() {
 *   return (
 *     <PageLayout
 *       title="Crediti"
 *       description="Crediti e ringraziamenti per TenpennyNovels"
 *     >
 *       <div className="credits">
 *         <h1>Crediti</h1>
 *         <p>...</p>
 *       </div>
 *     </PageLayout>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom OG image
 * <PageLayout
 *   title="Privacy Policy"
 *   description="Informativa sulla privacy di TenpennyNovels"
 *   ogImage="https://tenpennynovels.com/images/privacy-og.jpg"
 * >
 *   <PrivacyContent />
 * </PageLayout>
 * ```
 *
 * @example
 * ```typescript
 * // With noindex (private page)
 * <PageLayout
 *   title="Dashboard"
 *   description="Character dashboard"
 *   noindex={true}
 * >
 *   <Dashboard />
 * </PageLayout>
 * ```
 */
export const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  description,
  canonical,
  ogType,
  ogImage,
  noindex,
  nofollow,
  schema,
  subtitle,
  children,
}) => {
  return (
    <>
      <SEO
        title={title}
        description={description}
        canonical={canonical}
        ogType={ogType}
        ogImage={ogImage}
        noindex={noindex}
        nofollow={nofollow}
        schema={schema}
      />

      <VictorianLayout subtitle={subtitle}>{children}</VictorianLayout>
    </>
  );
};
