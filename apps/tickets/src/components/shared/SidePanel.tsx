import React, { useState, useEffect } from 'react';
import { FormField } from './FormField';

interface SidePanelField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'checkbox' | 'select' | 'multi_checkbox' | 'textarea' | 'datetime' | 'number';
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
  onAction
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

  // Filter visible fields based on column visibility
  const visibleFields = config.fields.filter(field => {
    // If field has explicit visibility configuration, respect it
    if (field.visible !== undefined) return field.visible;
    
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

  if (!isOpen && !isAnimating) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`${"backdrop"} ${isOpen && isAnimating ? "visible" : ''}`}
        onClick={handleClose}
      />

      {/* Side Panel */}
      <div className={`${"sidePanel"} ${isOpen && isAnimating ? "open" : ''} ${config.width || 'medium'}`}>
        {/* Header */}
        <div className={"header"}>
          <div className={"titleSection"}>
            <h2 className={"title"}>{config.title}</h2>
            {config.subtitle && (
              <p className={"subtitle"}>{config.subtitle}</p>
            )}
          </div>
          
          <button 
            onClick={handleClose}
            className={"closeButton"}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={"content"}>
          <div className={"form"}>
            {visibleFields.map((field) => (
              <FormField
                key={field.key}
                type={field.type}
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
          </div>
        </div>

        {/* Footer */}
        <div className={"footer"}>
          <div className={"actions"}>
            {/* Cancel Button (always present) */}
            <button
              onClick={handleClose}
              className={`${"actionButton"} ${"secondary"}`}
              disabled={loading}
            >
              Annulla
            </button>

            {/* Dynamic Action Buttons */}
            {config.actions.map((action) => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className={`${"actionButton"} ${action.type}`}
                disabled={loading || action.loading}
              >
                {action.loading ? (
                  <span className={"spinner"}>⏳</span>
                ) : (
                  <>
                    {action.icon && <span className={"icon"}>{action.icon}</span>}
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