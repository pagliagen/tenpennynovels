/**
 * TableFilters Component
 *
 * Reusable filter UI for ConfigurableDataTable.
 * Renders different input types based on filter configuration.
 *
 * Supported filter types:
 * - select: Dropdown with options
 * - text: Text input
 * - date: Single date picker
 * - daterange: From/To date pickers
 * - multiselect: Multiple selection dropdown
 *
 * @module components/shared/TableFilters
 */

import React from 'react';
import { TableFilter } from '@/lib/config/schemas';
import { FilterState } from './ConfigurableDataTable';
import styles from '@/styles/components/TableFilters.module.scss';

export interface TableFiltersProps {
  filters: TableFilter[];
  values: FilterState;
  onChange: (filters: FilterState) => void;
}

export function TableFilters({ filters, values, onChange }: TableFiltersProps): JSX.Element {
  const handleFilterChange = (filter: TableFilter, value: string | boolean | number) => {
    // CRITICAL: Use filter.field (API parameter name) instead of filter.key (UI identifier)
    // Example: filter.key="adminAccess", filter.field="canAccessAdminPanel" → send "canAccessAdminPanel" to API
    const fieldName = filter.field || filter.key;
    onChange({
      ...values,
      [fieldName]: value || undefined  // Convert empty string to undefined
    });
  };

  if (!filters || filters.length === 0) {
    return <></>;
  }

  return (
    <div className={styles.filtersContainer}>
      {filters.map(filter => (
        <div key={filter.key} className={styles.filterItem}>
          <label htmlFor={`filter-${filter.key}`}>{filter.label}</label>

          {/* Select Filter */}
          {filter.type === 'select' && (
            <select
              id={`filter-${filter.key}`}
              value={String(values[filter.field || filter.key] ?? '')}
              onChange={(e) => handleFilterChange(filter, e.target.value)}
            >
              {filter.options?.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Text Filter */}
          {filter.type === 'text' && (
            <input
              id={`filter-${filter.key}`}
              type="text"
              value={String(values[filter.field || filter.key] ?? '')}
              onChange={(e) => handleFilterChange(filter, e.target.value)}
              placeholder={filter.placeholder || `Filtra per ${filter.label.toLowerCase()}...`}
            />
          )}

          {/* Date Filter */}
          {filter.type === 'date' && (
            <input
              id={`filter-${filter.key}`}
              type="date"
              value={String(values[filter.field || filter.key] ?? '')}
              onChange={(e) => handleFilterChange(filter, e.target.value)}
            />
          )}

          {/* Date Range Filter */}
          {filter.type === 'daterange' && (
            <div className={styles.dateRange}>
              <input
                id={`filter-${filter.key}-from`}
                type="date"
                value={String(values[`${filter.field || filter.key}From`] ?? '')}
                onChange={(e) => handleFilterChange({ ...filter, field: `${filter.field || filter.key}From` }, e.target.value)}
                placeholder="Da"
              />
              <span className={styles.dateRangeSeparator}>-</span>
              <input
                id={`filter-${filter.key}-to`}
                type="date"
                value={String(values[`${filter.field || filter.key}To`] ?? '')}
                onChange={(e) => handleFilterChange({ ...filter, field: `${filter.field || filter.key}To` }, e.target.value)}
                placeholder="A"
              />
            </div>
          )}

          {/* Multiselect Filter */}
          {filter.type === 'multiselect' && (
            <select
              id={`filter-${filter.key}`}
              multiple
              value={(() => {
                const val = values[filter.field || filter.key];
                if (Array.isArray(val)) return val as string[];
                if (typeof val === 'string' && val) return val.split(',');
                return [];
              })()}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                handleFilterChange(filter, selected.join(','));
              }}
            >
              {filter.options?.map(opt => (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
