/**
 * SidePanel - Slide-out panel for edit/detail
 *
 * Features:
 * - React Hook Form integration
 * - Conditional fields support
 * - Animation CSS transform (NO width animation)
 * - Dirty state warning (future)
 *
 * CRITICAL: Max 200 linee
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import classNames from 'classnames';
import { SidePanel as SidePanelConfig, SidePanelField } from '@/lib/config/schemas';
import { getNestedValue, setNestedValue } from '@/lib/config/loader';
import { FormField } from './FormField';
import { LoadingSpinner } from './LoadingSpinner';
import styles from '@/styles/components/SidePanel.module.scss';

export interface SidePanelProps<T = Record<string, unknown>> {
  isOpen: boolean;
  config: SidePanelConfig;
  data: T;
  loading?: boolean;
  customContent?: React.ReactNode; // Custom content instead of fields
  onClose: () => void;
  onAction: (actionKey: string, formData: Record<string, unknown>) => void;
}

export function SidePanel<T extends Record<string, unknown>>({
  isOpen,
  config,
  data,
  loading = false,
  customContent,
  onClose,
  onAction
}: SidePanelProps<T>): React.ReactElement | null {
  const [isAnimating, setIsAnimating] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    defaultValues: data as Record<string, unknown>
  });

  // Update form when data changes
  useEffect(() => {
    reset(data as Record<string, unknown>);
  }, [data, reset]);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300); // Match animation duration
  };

  const onSubmit = (formData: Record<string, unknown>) => {
    onAction('save', formData);
  };

  // Check if field should be visible based on condition
  const isFieldVisible = (field: SidePanelField): boolean => {
    if (!field.condition) return true;

    const conditionValue = watch(field.condition.field);
    return conditionValue === field.condition.value;
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={classNames(styles.backdrop, isAnimating && styles.visible)}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={classNames(
        styles.sidePanel,
        styles[config.width || 'medium'],
        isAnimating && styles.open
      )}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{config.title}</h2>
            {config.subtitle && (
              <p className={styles.subtitle}>{config.subtitle}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className={styles.closeButton}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <LoadingSpinner size="large" />
            </div>
          ) : customContent ? (
            // Custom content provided - render directly
            customContent
          ) : (
            // Standard form fields
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              {config.fields.filter(isFieldVisible).map(field => (
                <FormField
                  key={field.key}
                  label={field.label}
                  type={field.type as never}
                  error={errors[field.key]?.message as string}
                  helpText={field.helpText}
                  required={field.required}
                  disabled={field.disabled}
                  placeholder={field.placeholder}
                  options={field.options}
                  {...register(field.key, {
                    required: field.required ? `${field.label} è obbligatorio` : false
                  })}
                />
              ))}
            </form>
          )}
        </div>

        {/* Footer with actions */}
        <div className={styles.footer}>
          {config.actions.map(action => (
            <button
              key={action.key}
              onClick={() => {
                if (action.key === 'cancel') {
                  handleClose();
                } else {
                  handleSubmit((formData) => onAction(action.key, formData))();
                }
              }}
              className={classNames(
                styles.actionButton,
                styles[action.type]
              )}
              disabled={action.loading}
            >
              {action.loading ? <LoadingSpinner size="small" /> : action.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
