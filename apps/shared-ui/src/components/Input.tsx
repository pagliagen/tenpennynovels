import React from 'react';
import classNames from 'classnames';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error' | 'success';
  inputSize?: 'small' | 'base' | 'large';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  label?: string;
  helpText?: string;
  errorMessage?: string;
  successMessage?: string;
  required?: boolean;
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  inputSize = 'base',
  icon,
  iconPosition = 'left',
  label,
  helpText,
  errorMessage,
  successMessage,
  required = false,
  className,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  const inputClasses = classNames(
    'input',
    {
      [`input-${inputSize}`]: inputSize !== 'base',
      [`input-${variant}`]: variant !== 'default',
      'input-icon': icon,
    },
    className
  );

  const finalVariant = errorMessage ? 'error' : successMessage ? 'success' : variant;
  const message = errorMessage || successMessage;

  if (icon) {
    return (
      <div className="field">
        {label && (
          <label htmlFor={inputId} className={classNames('label', { required })}>
            {label}
          </label>
        )}
        <div className="input-group">
          {iconPosition === 'left' && (
            <span className="input-icon-left">{icon}</span>
          )}
          <input
            id={inputId}
            className={classNames(inputClasses, {
              [`input-${finalVariant}`]: finalVariant !== 'default'
            })}
            {...props}
          />
          {iconPosition === 'right' && (
            <span className="input-icon-right">{icon}</span>
          )}
        </div>
        {helpText && <span className="help-text">{helpText}</span>}
        {message && (
          <span className={classNames({
            'error-message': errorMessage,
            'success-message': successMessage
          })}>
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="field">
      {label && (
        <label htmlFor={inputId} className={classNames('label', { required })}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={classNames(inputClasses, {
          [`input-${finalVariant}`]: finalVariant !== 'default'
        })}
        {...props}
      />
      {helpText && <span className="help-text">{helpText}</span>}
      {message && (
        <span className={classNames({
          'error-message': errorMessage,
          'success-message': successMessage
        })}>
          {message}
        </span>
      )}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'error' | 'success';
  label?: string;
  helpText?: string;
  errorMessage?: string;
  successMessage?: string;
  required?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  variant = 'default',
  label,
  helpText,
  errorMessage,
  successMessage,
  required = false,
  className,
  id,
  ...props
}) => {
  const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
  
  const textareaClasses = classNames(
    'textarea',
    {
      [`input-${variant}`]: variant !== 'default',
    },
    className
  );

  const finalVariant = errorMessage ? 'error' : successMessage ? 'success' : variant;
  const message = errorMessage || successMessage;

  return (
    <div className="field">
      {label && (
        <label htmlFor={textareaId} className={classNames('label', { required })}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={classNames(textareaClasses, {
          [`input-${finalVariant}`]: finalVariant !== 'default'
        })}
        {...props}
      />
      {helpText && <span className="help-text">{helpText}</span>}
      {message && (
        <span className={classNames({
          'error-message': errorMessage,
          'success-message': successMessage
        })}>
          {message}
        </span>
      )}
    </div>
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'default' | 'error' | 'success';
  label?: string;
  helpText?: string;
  errorMessage?: string;
  successMessage?: string;
  required?: boolean;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  variant = 'default',
  label,
  helpText,
  errorMessage,
  successMessage,
  required = false,
  options,
  className,
  id,
  ...props
}) => {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  
  const selectClasses = classNames(
    'select',
    {
      [`input-${variant}`]: variant !== 'default',
    },
    className
  );

  const finalVariant = errorMessage ? 'error' : successMessage ? 'success' : variant;
  const message = errorMessage || successMessage;

  return (
    <div className="field">
      {label && (
        <label htmlFor={selectId} className={classNames('label', { required })}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={classNames(selectClasses, {
          [`input-${finalVariant}`]: finalVariant !== 'default'
        })}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && <span className="help-text">{helpText}</span>}
      {message && (
        <span className={classNames({
          'error-message': errorMessage,
          'success-message': successMessage
        })}>
          {message}
        </span>
      )}
    </div>
  );
};

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  className,
  id,
  ...props
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <label className={classNames('checkbox', className)} htmlFor={checkboxId}>
      <input
        type="checkbox"
        id={checkboxId}
        {...props}
      />
      <span className="checkmark"></span>
      {label}
    </label>
  );
};

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Radio: React.FC<RadioProps> = ({
  label,
  className,
  id,
  ...props
}) => {
  const radioId = id || `radio-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <label className={classNames('radio', className)} htmlFor={radioId}>
      <input
        type="radio"
        id={radioId}
        {...props}
      />
      <span className="checkmark"></span>
      {label}
    </label>
  );
};