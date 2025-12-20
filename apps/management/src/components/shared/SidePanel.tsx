import React, { useState, useEffect, useMemo } from 'react';
import { FormField } from './FormField';
import styles from '@/styles/components/shared/SidePanel.module.scss';

interface SidePanelField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'checkbox' | 'select' | 'multi_checkbox' | 'textarea' | 'datetime' | 'number' | 'custom';
  required?: boolean;
  visible?: boolean;
  defaultVisible?: boolean;
  readonly?: boolean;
  placeholder?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    email?: boolean;
    min?: number;
    max?: number;
  };
  options?: Array<{ value: any; label: string }>;
  layout?: 'default' | 'grid';
  columns?: number;
  rows?: number;
  // Conditional field support
  condition?: {
    field: string;
    value: any;
  };
}

interface SidePanelAction {
  key: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  icon?: string;
  loading?: boolean;
}

interface SidePanelConfig {
  title: string;
  subtitle?: string;
  width?: 'small' | 'medium' | 'large';
  fields: SidePanelField[];
  actions: SidePanelAction[];
}

interface SidePanelProps {
  isOpen: boolean;
  config: SidePanelConfig;
  data?: Record<string, any>;
  loading?: boolean;
  columnVisibility?: Record<string, boolean>;
  getNestedValue?: (obj: any, path: string) => any;
  setNestedValue?: (obj: any, path: string, value: any) => any;
  onClose: () => void;
  onAction: (actionKey: string, formData: Record<string, any>) => void;
  customContent?: (formData: Record<string, any>, setFormData: React.Dispatch<React.SetStateAction<Record<string, any>>>) => React.ReactNode;
}

export function SidePanel({
  isOpen,
  config,
  data = {},
  loading = false,
  columnVisibility = {},
  getNestedValue,
  setNestedValue,
  onClose,
  onAction,
  customContent
}: SidePanelProps) {
  const [formData, setFormData] = useState<Record<string, any>>(data);
  const [isAnimating, setIsAnimating] = useState(false);

  // Update form data when data prop changes
  useEffect(() => {
    setFormData(data);
  }, [data]);

  // Handle animation state
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsAnimating(false);
    // Wait for animation to complete before actually closing
    setTimeout(onClose, 300);
  };

  const handleAction = (actionKey: string) => {
    onAction(actionKey, formData);
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    if (setNestedValue && fieldKey.includes('.')) {
      setFormData(prev => {
        const updated = { ...prev };
        setNestedValue(updated, fieldKey, value);
        return updated;
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [fieldKey]: value
      }));
    }
  };

  const getFieldValue = (fieldKey: string) => {
    if (getNestedValue && fieldKey.includes('.')) {
      return getNestedValue(formData, fieldKey);
    }
    return formData[fieldKey];
  };

  // Filter visible fields based on column visibility and conditions
  const visibleFields = useMemo(() => {
    if (!config?.fields) return [];

    return config.fields.filter(field => {
      // Exclude custom type fields - they're handled by customContent prop
      if (field.type === 'custom') return false;

      // Check static visibility first
      if (field.visible !== undefined && !field.visible) return false;

      // NEW: Check conditional fields
      if (field.condition) {
        const conditionFieldValue = formData[field.condition.field];
        if (conditionFieldValue !== field.condition.value) {
          return false; // Hide field if condition not met
        }
      }

      // For SidePanel fields, if we have column visibility settings, use them
      // Otherwise, show all fields since they're in an edit context
      if (columnVisibility && Object.keys(columnVisibility).length > 0) {
        // Check if this field key exists in column visibility (respects user preferences)
        if (field.key in columnVisibility) {
          return columnVisibility[field.key];
        }
      }

      // For fields not in column visibility (like nested fields), use defaultVisible
      // Default to true for edit context - all configured fields should be editable
      return field.defaultVisible !== false;
    });
  }, [config?.fields, formData, columnVisibility]);

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`${styles.backdrop} ${isOpen && isAnimating ? styles.visible : ''}`}
        onClick={handleClose}
      />

      {/* Side Panel */}
      <div className={`${styles.sidePanel} ${isOpen && isAnimating ? styles.open : ''} ${styles[config.width || 'medium']}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <h2 className={styles.title}>{config.title}</h2>
            {config.subtitle && (
              <p className={styles.subtitle}>{config.subtitle}</p>
            )}
          </div>
          
          <button 
            onClick={handleClose}
            className={styles.closeButton}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.form}>
            {visibleFields.map((field) => (
              <FormField
                key={field.key}
                type={field.type as Exclude<typeof field.type, 'custom'>}
                label={field.label}
                value={getFieldValue(field.key)}
                onChange={(value) => handleFieldChange(field.key, value)}
                required={field.required}
                placeholder={field.placeholder}
                options={field.options}
                layout={field.layout}
                columns={field.columns}
                rows={field.rows}
                validation={field.validation}
                disabled={loading || field.readonly}
              />
            ))}

            {/* Custom Content Section */}
            {customContent && customContent(formData, setFormData)}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.actions}>
            {/* Cancel Button (always present) */}
            <button
              onClick={handleClose}
              className={`${styles.actionButton} ${styles.secondary}`}
              disabled={loading}
            >
              Annulla
            </button>

            {/* Dynamic Action Buttons */}
            {config.actions.map((action) => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className={`${styles.actionButton} ${styles[action.type]}`}
                disabled={loading || action.loading}
              >
                {action.loading ? (
                  <span className={styles.spinner}>⏳</span>
                ) : (
                  <>
                    {action.icon && <span className={styles.icon}>{action.icon}</span>}
                    {action.label}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}