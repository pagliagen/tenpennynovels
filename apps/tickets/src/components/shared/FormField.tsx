import React from 'react';
import { Input, Textarea, Select } from './FormComponents';

interface Option {
  value: any;
  label: string;
}

interface FormFieldProps {
  type: 'text' | 'email' | 'checkbox' | 'select' | 'multi_checkbox' | 'textarea' | 'datetime' | 'number';
  label: string;
  value: any;
  onChange: (value: any) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  options?: Option[];
  layout?: 'default' | 'grid';
  columns?: number;
  rows?: number;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    email?: boolean;
    min?: number;
    max?: number;
  };
}

export function FormField({
  type,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  options = [],
  layout = 'default',
  columns = 2,
  rows = 3,
  validation
}: FormFieldProps) {
  
  // Handle multi-checkbox change
  const handleMultiCheckboxChange = (optionValue: any, checked: boolean) => {
    const currentValues = Array.isArray(value) ? value : [];
    
    if (checked) {
      // Add value if not already present
      if (!currentValues.includes(optionValue)) {
        onChange([...currentValues, optionValue]);
      }
    } else {
      // Remove value
      onChange(currentValues.filter(v => v !== optionValue));
    }
  };

  switch (type) {
    case 'text':
    case 'email':
      return (
        <Input
          label={label}
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          fullWidth={true}
        />
      );

    case 'number':
      return (
        <Input
          label={label}
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          min={validation?.min}
          max={validation?.max}
          fullWidth={true}
        />
      );

    case 'datetime':
      return (
        <Input
          label={label}
          type="datetime-local"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          fullWidth={true}
        />
      );

    case 'textarea':
      return (
        <Textarea
          label={label}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          fullWidth={true}
        />
      );

    case 'checkbox':
      return (
        <div className={"checkboxField"}>
          <label className={"checkboxLabel"}>
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              required={required}
              disabled={disabled}
              className={"checkbox"}
            />
            <span className={"checkboxText"}>{label}</span>
            {required && <span className={"required"}>*</span>}
          </label>
        </div>
      );

    case 'select':
      return (
        <Select
          label={label}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          options={options.map(opt => ({
            value: opt.value,
            label: opt.label
          }))}
          placeholder={placeholder}
          fullWidth={true}
        />
      );

    case 'multi_checkbox':
      const currentValues = Array.isArray(value) ? value : [];
      
      return (
        <div className={"multiCheckboxField"}>
          <label className={"fieldLabel"}>
            {label}
            {required && <span className={"required"}>*</span>}
          </label>
          <div className={`${"checkboxGrid"} ${`layout-${layout}`}`} 
               style={layout === 'grid' ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}>
            {options.map((option, index) => (
              <label key={index} className={"checkboxOption"}>
                <input
                  type="checkbox"
                  checked={currentValues.includes(option.value)}
                  onChange={(e) => handleMultiCheckboxChange(option.value, e.target.checked)}
                  className={"checkbox"}
                />
                <span className={"checkboxText"}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className={"unknownField"}>
          <span>Unsupported field type: {type}</span>
        </div>
      );
  }
}