import React, { useState, useMemo } from 'react';
import { DataTable, Column } from './DataTable';
import { TableCellRenderer } from './TableCellRenderer';
import { useTableConfig, TableActionConfig, TableBulkActionConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/components/shared/ConfigurableDataTable.module.scss';

interface ConfigurableDataTableProps<T = any> {
  tableName: string;
  data: T[];
  loading?: boolean;
  selectedItems?: T[];
  onSelectionChange?: (items: T[]) => void;
  onRowClick?: (item: T) => void;
  onAction?: (action: string, item: T) => void;
  onBulkAction?: (action: string, items: T[]) => void;
  onCellClick?: (item: T, columnKey: string, value: any) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  className?: string;
  // Optional external config - if not provided, will use internal hook
  externalConfig?: {
    config: any;
    loading: boolean;
    error: string | null;
    visibleColumns: any[];
    getNestedValue: (obj: any, path: string) => any;
    resolveConditionalValue: (conditionalValue: any, item: any, fallback?: any) => any;
    interpolateTemplate?: (template: string, item: any) => string;
    customRenderers?: Record<string, (value: any, item: any) => React.ReactNode>;
  };
}

export function ConfigurableDataTable<T extends Record<string, any>>({
  tableName,
  data,
  loading = false,
  selectedItems = [],
  onSelectionChange,
  onRowClick,
  onAction,
  onBulkAction,
  onCellClick,
  pagination,
  className,
  externalConfig
}: ConfigurableDataTableProps<T>) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const internalConfig = useTableConfig(tableName);
  
  // Use external config if provided, otherwise use internal
  const configResult = externalConfig || internalConfig;
  const { 
    config, 
    loading: configLoading, 
    error: configError,
    getNestedValue,
    resolveConditionalValue,
    interpolateTemplate,
    visibleColumns
  } = configResult;
  
  const customRenderers = (externalConfig?.customRenderers) || {};

  // Filter data based on applied filters
  const filteredData = useMemo(() => {
    if (!config?.filters || Object.keys(filters).length === 0) {
      return data;
    }

    return data.filter(item => {
      return Object.entries(filters).every(([filterKey, filterValue]) => {
        if (!filterValue) return true;

        const filterConfig = config.filters.find((f: any) => f.key === filterKey);
        if (!filterConfig) return true;

        if (filterConfig.key === 'search' || filterConfig.field.includes(',')) {
          // Multi-field search
          const searchFields = filterConfig.field.split(',');
          return searchFields.some((field: string) => {
            const fieldValue = getNestedValue(item, field.trim());
            return String(fieldValue || '').toLowerCase().includes(filterValue.toLowerCase());
          });
        } else {
          // Specific field filter
          const fieldValue = getNestedValue(item, filterConfig.field);
          if (filterConfig.type === 'select' && filterValue === '') {
            return true; // Empty select means "show all"
          }
          return String(fieldValue || '').toLowerCase().includes(filterValue.toLowerCase());
        }
      });
    });
  }, [data, filters, config, getNestedValue]);

  if (configLoading) {
    return <div>Loading table configuration...</div>;
  }

  if (configError || !config) {
    return <div>Error loading table configuration: {configError}</div>;
  }

  // Convert config columns to DataTable columns
  const columns: Column<T>[] = visibleColumns.map(colConfig => ({
    key: colConfig.key,
    label: colConfig.label,
    sortable: colConfig.sortable,
    filterable: colConfig.filterable,
    width: colConfig.width,
    align: colConfig.align,
    className: colConfig.render?.className,
    render: (value, item) => {
      // Check if there's a custom renderer for this column (using template name for custom types)
      if (colConfig.render?.type === 'custom' && colConfig.render.template && customRenderers[colConfig.render.template]) {
        return customRenderers[colConfig.render.template](value, item);
      }
      
      // Check if there's a custom renderer by type
      if (colConfig.render?.type && customRenderers[colConfig.render.type]) {
        return customRenderers[colConfig.render.type](value, item);
      }
      
      // For nested fields, extract the correct value
      const actualValue = colConfig.key.includes('.') 
        ? getNestedValue(item, colConfig.key)
        : value;
      
      return (
        <TableCellRenderer
          value={actualValue}
          item={item}
          column={colConfig}
          getNestedValue={getNestedValue}
          onCellClick={onCellClick}
        />
      );
    }
  }));

  // Convert config actions to DataTable actions
  const actions = (config.actions || []).map((actionConfig: TableActionConfig) => ({
    label: typeof actionConfig.label === 'string' 
      ? actionConfig.label
      : (item: T) => resolveConditionalValue(actionConfig.label, item),
    icon: typeof actionConfig.icon === 'string'
      ? actionConfig.icon  
      : (item: T) => resolveConditionalValue(actionConfig.icon, item),
    onClick: (item: T) => {
      if (actionConfig.confirmMessage && interpolateTemplate) {
        const message = typeof actionConfig.confirmMessage === 'string'
          ? interpolateTemplate(actionConfig.confirmMessage, item)
          : interpolateTemplate(
              resolveConditionalValue(actionConfig.confirmMessage, item), 
              item
            );
        
        if (!confirm(message)) return;
      }
      
      onAction?.(actionConfig.key, item);
    },
    visible: () => actionConfig.visible,
    className: typeof actionConfig.className === 'string'
      ? actionConfig.className
      : (item: T) => resolveConditionalValue(actionConfig.className, item)
  }));

  // Convert config bulk actions to DataTable bulk actions
  const bulkActions = (config.bulkActions || []).map((bulkConfig: TableBulkActionConfig) => ({
    label: bulkConfig.label,
    icon: bulkConfig.icon,
    onClick: (items: T[]) => {
      // Apply filter if specified
      let filteredItems = items;
      if (bulkConfig.filter) {
        filteredItems = items.filter(item => {
          const fieldValue = getNestedValue(item, bulkConfig.filter!.field);
          return fieldValue === bulkConfig.filter!.value;
        });
      }

      if (filteredItems.length === 0) {
        alert('No items match the criteria for this action.');
        return;
      }

      if (bulkConfig.confirmMessage) {
        const message = bulkConfig.confirmMessage.replace('{count}', String(filteredItems.length));
        if (!confirm(message)) return;
      }

      onBulkAction?.(bulkConfig.key, filteredItems);
    },
    className: bulkConfig.className
  }));

  // Render filters if configured
  const renderFilters = () => {
    if (!config.filters || config.filters.length === 0) {
      return null;
    }

    return (
      <div className={styles.filtersContainer}>
        {config.filters.map((filterConfig: any) => {
          if (filterConfig.type === 'text') {
            return (
              <div key={filterConfig.key} className={styles.filterField}>
                <label className={styles.filterLabel}>{filterConfig.label}:</label>
                <input
                  type="text"
                  placeholder={filterConfig.placeholder}
                  value={filters[filterConfig.key] || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    [filterConfig.key]: e.target.value
                  }))}
                  className={styles.filterInput}
                />
              </div>
            );
          }

          if (filterConfig.type === 'select') {
            return (
              <div key={filterConfig.key} className={styles.filterField}>
                <label className={styles.filterLabel}>{filterConfig.label}:</label>
                <select
                  value={filters[filterConfig.key] || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    [filterConfig.key]: e.target.value
                  }))}
                  className={styles.filterSelect}
                >
                  {filterConfig.options.map((option: any) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          return null;
        })}
        
        {Object.keys(filters).some(key => filters[key]) && (
          <button 
            onClick={() => setFilters({})}
            className={styles.clearFiltersButton}
          >
            Pulisci filtri
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={styles.configurableDataTable}>
      {renderFilters()}
      <DataTable
        data={filteredData}
        columns={columns}
        loading={loading}
        searchable={config.table.searchable}
        selectable={config.table.selectable && bulkActions.length > 0}
        selectedItems={selectedItems}
        onSelectionChange={onSelectionChange}
        onRowClick={onRowClick}
        actions={actions}
        bulkActions={bulkActions}
        pagination={pagination}
        emptyMessage="No data available"
        className={className}
      />
    </div>
  );
}