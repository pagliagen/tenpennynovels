/**
 * FormField - Form input component with React Hook Form integration
 *
 * Integrates with:
 * - React Hook Form via forwardRef + register()
 * - Zod validation via zodResolver
 * - Error display from formState.errors
 */

import React, { forwardRef } from 'react';
import classNames from 'classnames';
import styles from '@/styles/components/FormField.module.scss';

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'checkbox-group'
  | 'date'
  | 'datetime-local';

export interface FormFieldOption {
  value: string | number | boolean;
  label: string;
}

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, 'type'> {
  label?: string;
  type?: FormFieldType;
  error?: string;
  helpText?: string;
  options?: FormFieldOption[];
  className?: string;
}

export const FormField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  FormFieldProps
>(function FormField(
  {
    label,
    type = 'text',
    error,
    helpText,
    options,
    className,
    required,
    disabled,
    ...props
  },
  ref
) {
  const fieldId = props.id || props.name || `field-${Math.random().toString(36).substring(7)}`;

  const renderInput = () => {
    const baseClassName = classNames(
      styles.input,
      error && styles.error,
      className
    );

    if (type === 'textarea') {
      return (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={fieldId}
          className={baseClassName}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
          {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      );
    }

    if (type === 'select') {
      return (
        <select
          ref={ref as React.Ref<HTMLSelectElement>}
          id={fieldId}
          className={baseClassName}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
          {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
        >
          {options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (type === 'checkbox') {
      return (
        <div className={styles.checkboxWrapper}>
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type="checkbox"
            id={fieldId}
            className={styles.checkbox}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          {label && (
            <label htmlFor={fieldId} className={styles.checkboxLabel}>
              {label}
              {required && <span className={styles.required}>*</span>}
            </label>
          )}
        </div>
      );
    }

    if (type === 'checkbox-group') {
      const currentValue = (props.value as string[]) || [];
      const handleCheckboxChange = (optionValue: string, checked: boolean) => {
        const newValue = checked
          ? [...currentValue, optionValue]
          : currentValue.filter(v => v !== optionValue);

        // Call onChange from register() if provided
        if (props.onChange) {
          props.onChange({
            target: { value: newValue },
          } as unknown as React.ChangeEvent<HTMLInputElement>);
        }
      };

      return (
        <div className={styles.checkboxGroup}>
          {options?.map((option) => {
            const optionId = `${fieldId}-${String(option.value)}`;
            const optionValue = String(option.value);
            const isChecked = currentValue.includes(optionValue);
            return (
              <label key={optionValue} htmlFor={optionId} className={styles.checkboxGroupItem}>
                <input
                  type="checkbox"
                  id={optionId}
                  checked={isChecked}
                  disabled={disabled}
                  className={styles.checkbox}
                  onChange={(e) => handleCheckboxChange(optionValue, e.target.checked)}
                />
                <span className={styles.checkboxGroupLabel}>{option.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <input
        ref={ref as React.Ref<HTMLInputElement>}
        type={type}
        id={fieldId}
        className={baseClassName}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${fieldId}-error` : helpText ? `${fieldId}-help` : undefined}
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
      />
    );
  };

  if (type === 'checkbox') {
    return (
      <div className={styles.formField}>
        {renderInput()}
        {error && (
          <div id={`${fieldId}-error`} className={styles.errorText} role="alert">
            {error}
          </div>
        )}
        {helpText && !error && (
          <div id={`${fieldId}-help`} className={styles.helpText}>
            {helpText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.formField}>
      {label && (
        <label htmlFor={fieldId} className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      {renderInput()}
      {error && (
        <div id={`${fieldId}-error`} className={styles.errorText} role="alert">
          {error}
        </div>
      )}
      {helpText && !error && (
        <div id={`${fieldId}-help`} className={styles.helpText}>
          {helpText}
        </div>
      )}
    </div>
  );
});
