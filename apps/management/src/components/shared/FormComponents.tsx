import React, { useState } from 'react';
import styles from '@/styles/components/shared/FormComponents.module.scss';

// Base Input Component
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  fullWidth = false,
  className,
  ...props
}) => {
  return (
    <div className={`${styles.fieldContainer} ${fullWidth ? styles.fullWidth : ''}`}>
      {label && (
        <label className={styles.label} htmlFor={props.id}>
          {label}
          {props.required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      <div className={`${styles.inputContainer} ${error ? styles.hasError : ''}`}>
        {icon && <span className={styles.inputIcon}>{icon}</span>}
        <input
          {...props}
          className={`${styles.input} ${icon ? styles.hasIcon : ''} ${className || ''}`}
        />
      </div>
      
      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      )}
    </div>
  );
};

// Textarea Component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  resizable?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  fullWidth = false,
  resizable = true,
  className,
  ...props
}) => {
  return (
    <div className={`${styles.fieldContainer} ${fullWidth ? styles.fullWidth : ''}`}>
      {label && (
        <label className={styles.label} htmlFor={props.id}>
          {label}
          {props.required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      <div className={`${styles.inputContainer} ${error ? styles.hasError : ''}`}>
        <textarea
          {...props}
          className={`${styles.textarea} ${!resizable ? styles.noResize : ''} ${className || ''}`}
        />
      </div>
      
      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      )}
    </div>
  );
};

// Select Component
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  placeholder,
  fullWidth = false,
  className,
  ...props
}) => {
  return (
    <div className={`${styles.fieldContainer} ${fullWidth ? styles.fullWidth : ''}`}>
      {label && (
        <label className={styles.label} htmlFor={props.id}>
          {label}
          {props.required && <span className={styles.required}>*</span>}
        </label>
      )}
      
      <div className={`${styles.inputContainer} ${error ? styles.hasError : ''}`}>
        <select
          {...props}
          className={`${styles.select} ${className || ''}`}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span className={styles.selectArrow}>▼</span>
      </div>
      
      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      )}
    </div>
  );
};

// Checkbox Component
export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  helperText,
  className,
  ...props
}) => {
  return (
    <div className={styles.fieldContainer}>
      <div className={`${styles.checkboxContainer} ${error ? styles.hasError : ''}`}>
        <input
          type="checkbox"
          {...props}
          className={`${styles.checkbox} ${className || ''}`}
        />
        <label className={styles.checkboxLabel} htmlFor={props.id}>
          <span className={styles.checkboxCustom}></span>
          {label}
          {props.required && <span className={styles.required}>*</span>}
        </label>
      </div>
      
      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      )}
    </div>
  );
};

// Radio Group Component
export interface RadioOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  label?: string;
  options: RadioOption[];
  value?: string | number;
  onChange?: (value: string | number) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  inline?: boolean;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  label,
  options,
  value,
  onChange,
  error,
  helperText,
  required = false,
  inline = false
}) => {
  return (
    <div className={styles.fieldContainer}>
      {label && (
        <div className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </div>
      )}
      
      <div className={`${styles.radioGroup} ${inline ? styles.inline : ''}`}>
        {options.map((option) => (
          <div
            key={option.value}
            className={`${styles.radioContainer} ${error ? styles.hasError : ''}`}
          >
            <input
              type="radio"
              id={`${name}-${option.value}`}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              disabled={option.disabled}
              className={styles.radio}
            />
            <label
              className={styles.radioLabel}
              htmlFor={`${name}-${option.value}`}
            >
              <span className={styles.radioCustom}></span>
              {option.label}
            </label>
          </div>
        ))}
      </div>
      
      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      )}
    </div>
  );
};

// File Upload Component
export interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  onFilesSelected?: (files: FileList | null) => void;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  accept,
  multiple = false,
  maxSize,
  onFilesSelected,
  error,
  helperText,
  fullWidth = false
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files) {
      setSelectedFiles(files);
      onFilesSelected?.(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    setSelectedFiles(files);
    onFilesSelected?.(files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`${styles.fieldContainer} ${fullWidth ? styles.fullWidth : ''}`}>
      {label && (
        <div className={styles.label}>
          {label}
        </div>
      )}
      
      <div
        className={`${styles.fileUploadContainer} ${dragOver ? styles.dragOver : ''} ${error ? styles.hasError : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className={styles.fileInput}
          id="file-upload"
        />
        <label htmlFor="file-upload" className={styles.fileUploadLabel}>
          <span className={styles.uploadIcon}>📁</span>
          <div className={styles.uploadText}>
            <span className={styles.uploadPrimary}>
              Clicca per selezionare {multiple ? 'file' : 'un file'}
            </span>
            <span className={styles.uploadSecondary}>
              o trascina {multiple ? 'i file' : 'il file'} qui
            </span>
          </div>
        </label>
        
        {selectedFiles && (
          <div className={styles.selectedFiles}>
            {Array.from(selectedFiles).map((file, index) => (
              <div key={index} className={styles.selectedFile}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && (
            <span className={styles.helperText}>
              {helperText}
              {maxSize && ` (Max ${maxSize}MB per file)`}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Form Field Wrapper Component (for custom inputs)
export interface FormFieldProps {
  children: React.ReactNode;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  children,
  label,
  error,
  helperText,
  required = false,
  fullWidth = false,
  className
}) => {
  return (
    <div className={`${styles.fieldContainer} ${fullWidth ? styles.fullWidth : ''} ${className || ''}`}>
      {label && (
        <div className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </div>
      )}

      <div className={`${error ? styles.hasError : ''}`}>
        {children}
      </div>

      {(error || helperText) && (
        <div className={styles.fieldHelp}>
          {error && <span className={styles.errorText}>{error}</span>}
          {!error && helperText && <span className={styles.helperText}>{helperText}</span>}
        </div>
      )}
    </div>
  );
};

// Form Group Component
export interface FormGroupProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export const FormGroup: React.FC<FormGroupProps> = ({
  children,
  title,
  description,
  className
}) => {
  return (
    <div className={`${styles.formGroup} ${className || ''}`}>
      {(title || description) && (
        <div className={styles.formGroupHeader}>
          {title && <h3 className={styles.formGroupTitle}>{title}</h3>}
          {description && <p className={styles.formGroupDescription}>{description}</p>}
        </div>
      )}
      <div className={styles.formGroupContent}>
        {children}
      </div>
    </div>
  );
};