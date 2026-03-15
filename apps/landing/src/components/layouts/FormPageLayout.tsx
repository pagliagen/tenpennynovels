/**
 * Form Page Layout Component
 *
 * Layout wrapper for form pages (login, register, character creation, etc.).
 * Extends PageLayout and adds Alert handling for global form messages.
 *
 * **Benefits**:
 * - **DRY**: Eliminates 20-25 lines of Alert boilerplate per form page
 * - **Consistency**: All forms show errors/success the same way
 * - **Automatic**: Alert only renders when there's a message
 *
 * **Wrapped Components**:
 * - PageLayout (SEO + VictorianLayout)
 * - Alert (for globalError / globalSuccess messages)
 *
 * @module components/layouts/FormPageLayout
 */

import React from 'react';
import { PageLayout, type PageLayoutProps } from './PageLayout';
import { Alert } from '../Alert';

/**
 * FormPageLayout component props
 *
 * @interface FormPageLayoutProps
 * @extends Omit<PageLayoutProps, 'children'>
 */
export interface FormPageLayoutProps extends Omit<PageLayoutProps, 'children'> {
  /** Page content (typically a form) */
  children: React.ReactNode;
  /** Optional info panel rendered above page content (e.g. terms, privacy inline) */
  pageInfo?: React.ReactNode;
  /** Optional active info type (for controlling info modal) */
  activeInfo?: 'terms' | 'privacy' | 'credits' | null;
  /** Optional callback to set active info */
  onSetActiveInfo?: (info: 'terms' | 'privacy' | 'credits' | null) => void;
  /** Global error message (null if no error) */
  globalError?: string | null;
  /** Global success message (null if no success) */
  globalSuccess?: string | null;
  /** Callback to dismiss error message */
  onDismissError?: () => void;
  /** Callback to dismiss success message */
  onDismissSuccess?: () => void;
  /** Auto-hide duration for success message in ms (0 = don't auto-hide) */
  successAutoHide?: number;
}

/**
 * Form Page Layout Component
 *
 * Renders a page layout with automatic Alert handling for form messages.
 * Use this for all form pages (login, register, forgot-password, etc.).
 *
 * **Structure**:
 * ```
 * <PageLayout {...seoProps}>
 *   {globalError && <Alert type="error" message={globalError} />}
 *   {globalSuccess && <Alert type="success" message={globalSuccess} />}
 *   {children}
 * </PageLayout>
 * ```
 *
 * **Eliminated Boilerplate**:
 * - Alert component import
 * - Conditional Alert rendering for error
 * - Conditional Alert rendering for success
 * - Alert onDismiss handlers
 * Total: ~20-25 lines per form page
 *
 * **Integration with useFormState**:
 * ```typescript
 * const { globalError, globalSuccess, clearMessages, handleApiError } = useFormState();
 *
 * return (
 *   <FormPageLayout
 *     title="Login"
 *     description="..."
 *     globalError={globalError}
 *     globalSuccess={globalSuccess}
 *   >
 *     <form>...</form>
 *   </FormPageLayout>
 * );
 * ```
 *
 * @param {FormPageLayoutProps} props - Component props
 * @returns {JSX.Element} Rendered form page layout
 *
 * @example
 * ```typescript
 * import { FormPageLayout } from '@/components/layouts/FormPageLayout';
 * import { useFormState } from '@/hooks/useFormState';
 *
 * function LoginPage() {
 *   const { globalError, globalSuccess, handleApiError } = useFormState();
 *
 *   const onSubmit = async (data) => {
 *     const response = await apiPost('/auth/login', data);
 *     if (!response.result) {
 *       handleApiError(response);
 *     }
 *   };
 *
 *   return (
 *     <FormPageLayout
 *       title="Login | TenPennyNovels"
 *       description="Accedi a TenPennyNovels"
 *       globalError={globalError}
 *       globalSuccess={globalSuccess}
 *     >
 *       <form onSubmit={handleSubmit(onSubmit)}>
 *         {/* Form fields... *\/}
 *       </form>
 *     </FormPageLayout>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With success auto-hide (5 seconds)
 * <FormPageLayout
 *   title="Register"
 *   description="Crea un account"
 *   globalSuccess="Account created successfully!"
 *   successAutoHide={5000}
 * >
 *   <RegisterForm />
 * </FormPageLayout>
 * ```
 *
 * @example
 * ```typescript
 * // Error only (no success)
 * <FormPageLayout
 *   title="Forgot Password"
 *   description="Reset your password"
 *   globalError="Email not found"
 * >
 *   <ForgotPasswordForm />
 * </FormPageLayout>
 * ```
 */
export const FormPageLayout: React.FC<FormPageLayoutProps> = ({
  title,
  description,
  canonical,
  ogType,
  ogImage,
  noindex = true, // Forms are typically noindex (private pages)
  nofollow,
  schema,
  subtitle,
  pageInfo,
  activeInfo,
  onSetActiveInfo,
  globalError,
  globalSuccess,
  successAutoHide = 0,
  children,
}) => {
  return (
    <PageLayout
      title={title}
      description={description}
      canonical={canonical}
      ogType={ogType}
      ogImage={ogImage}
      noindex={noindex}
      nofollow={nofollow}
      schema={schema}
      subtitle={subtitle}
      pageInfo={pageInfo}
      activeInfo={activeInfo}
      onSetActiveInfo={onSetActiveInfo}
    >
      <div className="form-page">
        {/* Global error alert */}
        {globalError && (
          <Alert
            type="error"
            message={globalError}
            dismissible={true}
          />
        )}

        {/* Global success alert */}
        {globalSuccess && (
          <Alert
            type="success"
            message={globalSuccess}
            dismissible={true}
            autoHideDuration={successAutoHide}
          />
        )}

        {/* Form content */}
        {children}
      </div>
    </PageLayout>
  );
};
