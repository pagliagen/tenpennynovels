import React, { useState } from 'react';

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
    <div className={`${"fieldContainer"} ${fullWidth ? "fullWidth" : ''}`}>
      {label && (
        <label className={"label"} htmlFor={props.id}>
          {label}
          {props.required && <span className={"required"}>*</span>}
        </label>
      )}
      
      <div className={`${"inputContainer"} ${error ? "hasError" : ''}`}>
        {icon && <span className={"inputIcon"}>{icon}</span>}
        <input
          {...props}
          className={`${"input"} ${icon ? "hasIcon" : ''} ${className || ''}`}
        />
      </div>
      
      {(error || helperText) && (
        <div className={"fieldHelp"}>
          {error && <span className={"errorText"}>{error}</span>}
          {!error && helperText && <span className={"helperText"}>{helperText}</span>}
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
    <div className={`${"fieldContainer"} ${fullWidth ? "fullWidth" : ''}`}>
      {label && (
        <label className={"label"} htmlFor={props.id}>
          {label}
          {props.required && <span className={"required"}>*</span>}
        </label>
      )}
      
      <div className={`${"inputContainer"} ${error ? "hasError" : ''}`}>
        <textarea
          {...props}
          className={`${"textarea"} ${!resizable ? "noResize" : ''} ${className || ''}`}
        />
      </div>
      
      {(error || helperText) && (
        <div className={"fieldHelp"}>
          {error && <span className={"errorText"}>{error}</span>}
          {!error && helperText && <span className={"helperText"}>{helperText}</span>}
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
    <div className={`${"fieldContainer"} ${fullWidth ? "fullWidth" : ''}`}>
      {label && (
        <label className={"label"} htmlFor={props.id}>
          {label}
          {props.required && <span className={"required"}>*</span>}
        </label>
      )}
      
      <div className={`${"inputContainer"} ${error ? "hasError" : ''}`}>
        <select
          {...props}
          className={`${"select"} ${className || ''}`}
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
        <span className={"selectArrow"}>▼</span>
      </div>
      
      {(error || helperText) && (
        <div className={"fieldHelp"}>
          {error && <span className={"errorText"}>{error}</span>}
          {!error && helperText && <span className={"helperText"}>{helperText}</span>}
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
    <div className={"fieldContainer"}>
      <div className={`${"checkboxContainer"} ${error ? "hasError" : ''}`}>
        <input
          type="checkbox"
          {...props}
          className={`${"checkbox"} ${className || ''}`}
        />
        <label className={"checkboxLabel"} htmlFor={props.id}>
          <span className={"checkboxCustom"}></span>
          {label}
          {props.required && <span className={"required"}>*</span>}
        </label>
      </div>
      
      {(error || helperText) && (
        <div className={"fieldHelp"}>
          {error && <span className={"errorText"}>{error}</span>}
          {!error && helperText && <span className={"helperText"}>{helperText}</span>}
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
    <div className={"fieldContainer"}>
      {label && (
        <div className={"label"}>
          {label}
          {required && <span className={"required"}>*</span>}
        </div>
      )}
      
      <div className={`${"radioGroup"} ${inline ? "inline" : ''}`}>
        {options.map((option) => (
          <div
            key={option.value}
            className={`${"radioContainer"} ${error ? "hasError" : ''}`}
          >
            <input
              type="radio"
              id={`${name}-${option.value}`}
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              disabled={option.disabled}
              className={"radio"}
            />
            <label
              className={"radioLabel"}
              htmlFor={`${name}-${option.value}`}
            >
              <span className={"radioCustom"}></span>
              {option.label}
            </label>
          </div>
        ))}
      </div>
      
      {(error || helperText) && (
        <div className={"fieldHelp"}>
          {error && <span className={"errorText"}>{error}</span>}
          {!error && helperText && <span className={"helperText"}>{helperText}</span>}
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
    <div className={`${"fieldContainer"} ${fullWidth ? "fullWidth" : ''}`}>
      {label && (
        <div className={"label"}>
          {label}
        </div>
      )}
      
      <div
        className={`${"fileUploadContainer"} ${dragOver ? "dragOver" : ''} ${error ? "hasError" : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className={"fileInput"}
          id="file-upload"
        />
        <label htmlFor="file-upload" className={"fileUploadLabel"}>
          <span className={"uploadIcon"}>📁</span>
          <div className={"uploadText"}>
            <span className={"uploadPrimary"}>
              Clicca per selezionare {multiple ? 'file' : 'un file'}
            </span>
            <span className={"uploadSecondary"}>
              o trascina {multiple ? 'i file' : 'il file'} qui
            </span>
          </div>
        </label>
        
        {selectedFiles && (
          <div className={"selectedFiles"}>
            {Array.from(selectedFiles).map((file, index) => (
              <div key={index} className={"selectedFile"}>
                <span className={"fileName"}>{file.name}</span>
                <span className={"fileSize"}>{formatFileSize(file.size)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <div className={"fieldHelp"}>
          {error && <span className={"errorText"}>{error}</span>}
          {!error && helperText && (
            <span className={"helperText"}>
              {helperText}
              {maxSize && ` (Max ${maxSize}MB per file)`}
            </span>
          )}
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
    <div className={`${"formGroup"} ${className || ''}`}>
      {(title || description) && (
        <div className={"formGroupHeader"}>
          {title && <h3 className={"formGroupTitle"}>{title}</h3>}
          {description && <p className={"formGroupDescription"}>{description}</p>}
        </div>
      )}
      <div className={"formGroupContent"}>
        {children}
      </div>
    </div>
  );
};