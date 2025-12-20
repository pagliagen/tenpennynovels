import { useState, useEffect } from 'react';

// Type definitions for table configuration
export interface TableColumnConfig {
  key: string;
  label: string;
  type: 'text' | 'email' | 'boolean' | 'select' | 'multi_select' | 'array_length' | 'nested_boolean' | 'nested_datetime' | 'nested_number' | 'complex_status';
  visible: boolean;
  defaultVisible: boolean;
  alwaysVisible: boolean;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  required: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    email?: boolean;
  };
  options?: Array<{ value: any; label: string }>;
  render?: {
    type: string;
    className?: string;
    showSubtext?: boolean;
    subtextField?: string;
    trueValue?: { text: string; className: string };
    falseValue?: { text: string; className: string };
    format?: string;
    nullable?: boolean;
    nullText?: string;
    emptyText?: string;
    maxVisible?: number;
    showCount?: boolean;
    colorMap?: Record<string, string>; // For badge color mapping
    statusMap?: Record<string, { text: string; className: string }>; // For status badge mapping
    priorityMap?: Record<string, { text: string; className: string }>; // For priority badge mapping
    // For account_status_badge
    logic?: {
      [key: string]: {
        field: string;
        value: any;
        text: string;
        className: string;
      };
    };
    priority?: string[];
    badges?: Record<string, any>;
  };
}

export interface TableActionConfig {
  key: string;
  label: string | {
    type: 'conditional';
    field: string;
    trueValue: string;
    falseValue: string;
  };
  icon: string | {
    type: 'conditional';
    field: string;
    trueValue: string;
    falseValue: string;
  };
  type: 'edit' | 'toggle' | 'action';
  visible: boolean;
  className: string | {
    type: 'conditional';
    field: string;
    trueValue: string;
    falseValue: string;
  };
  permission?: string;
  confirmMessage?: string | {
    type: 'conditional';
    field: string;
    trueValue: string;
    falseValue: string;
  };
}

export interface TableBulkActionConfig {
  key: string;
  label: string;
  icon: string;
  type: 'bulk_action';
  className?: string;
  permission?: string;
  confirmMessage?: string;
  filter?: {
    field: string;
    value: any;
  };
}

export interface TableFilterConfig {
  key: string;
  label: string;
  type: 'select';
  field: string;
  options: Array<{ value: any; label: string }>;
}

export interface TableEditModalConfig {
  title: string;
  size: 'small' | 'medium' | 'large';
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'email' | 'checkbox' | 'select' | 'multi_checkbox';
    required: boolean;
    validation?: {
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      email?: boolean;
    };
    options?: Array<{ value: any; label: string }>;
  }>;
}

export interface TableConfig {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
  };
  table: {
    name: string;
    title: string;
    icon: string;
    searchable: boolean;
    selectable: boolean;
    pagination: {
      defaultPageSize: number;
      pageSizeOptions: number[];
    };
  };
  columns: TableColumnConfig[];
  actions: TableActionConfig[];
  bulkActions: TableBulkActionConfig[];
  editModal: TableEditModalConfig;
  filters: TableFilterConfig[];
  sidePanels?: Record<string, any>;
}

export function useTableConfig(tableName: string) {
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadConfig() {
      try {
        console.log('🔧 Loading table config for:', tableName);
        setLoading(true);
        setError(null);

        // In a real app, this would fetch from an API
        // For now, we'll import the JSON files directly
        const response = await fetch(`/config/tables/${tableName}.json`);
        
        if (!response.ok) {
          throw new Error(`Failed to load table config: ${response.status}`);
        }

        const configData = await response.json();
        setConfig(configData);

        // Load column visibility preferences from localStorage
        const storageKey = `table-columns-${tableName}`;
        const savedVisibility = localStorage.getItem(storageKey);
        
        if (savedVisibility) {
          try {
            const parsed = JSON.parse(savedVisibility);
            setColumnVisibility(parsed);
          } catch (e) {
            console.warn('Failed to parse stored column visibility:', e);
            // Initialize with default visibility
            const defaultVisibility: Record<string, boolean> = {};
            configData.columns.forEach((col: TableColumnConfig) => {
              defaultVisibility[col.key] = col.defaultVisible;
            });
            setColumnVisibility(defaultVisibility);
          }
        } else {
          // Initialize with default visibility
          const defaultVisibility: Record<string, boolean> = {};
          configData.columns.forEach((col: TableColumnConfig) => {
            defaultVisibility[col.key] = col.defaultVisible;
          });
          setColumnVisibility(defaultVisibility);
        }
      } catch (err) {
        console.error(`Failed to load table config for ${tableName}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (tableName) {
      loadConfig();
    }
  }, [tableName]);

  // Helper functions to work with nested field paths
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  };

  const setNestedValue = (obj: any, path: string, value: any): any => {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
    return obj;
  };

  // Helper to resolve conditional values
  const resolveConditionalValue = (
    conditionalValue: any, 
    item: any, 
    fallback: any = ''
  ): any => {
    if (typeof conditionalValue === 'object' && conditionalValue.type === 'conditional') {
      const fieldValue = getNestedValue(item, conditionalValue.field);
      return fieldValue ? conditionalValue.trueValue : conditionalValue.falseValue;
    }
    return conditionalValue || fallback;
  };

  // Helper to interpolate template strings
  const interpolateTemplate = (template: string, item: any): string => {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return getNestedValue(item, key) || match;
    });
  };

  // Function to toggle column visibility
  const toggleColumnVisibility = (columnKey: string) => {
    if (!config) return;
    
    // Find the column config
    const column = config.columns.find(col => col.key === columnKey);
    if (!column) return;
    
    // Don't allow toggling required or alwaysVisible columns
    if (column.required || column.alwaysVisible) return;
    
    const currentValue = columnVisibility[columnKey] ?? column.defaultVisible;
    const newVisibility = {
      ...columnVisibility,
      [columnKey]: !currentValue
    };
    
    
    setColumnVisibility(newVisibility);
    
    // Save to localStorage
    const storageKey = `table-columns-${tableName}`;
    localStorage.setItem(storageKey, JSON.stringify(newVisibility));
  };

  // Function to reset column visibility to defaults
  const resetColumnVisibility = () => {
    if (!config) return;
    
    const defaultVisibility: Record<string, boolean> = {};
    config.columns.forEach((col: TableColumnConfig) => {
      defaultVisibility[col.key] = col.defaultVisible;
    });
    setColumnVisibility(defaultVisibility);
    
    // Save to localStorage
    const storageKey = `table-columns-${tableName}`;
    localStorage.setItem(storageKey, JSON.stringify(defaultVisibility));
  };

  return {
    config,
    loading,
    error,
    columnVisibility,
    toggleColumnVisibility,
    resetColumnVisibility,
    // Helper functions
    getNestedValue,
    setNestedValue,
    resolveConditionalValue,
    interpolateTemplate,
    // Filtered configs - now based on user preferences
    visibleColumns: (() => {
      const filtered = config?.columns.filter(col => {
        // Always show columns marked as alwaysVisible
        if (col.alwaysVisible) return true;
        // Use user preference if available, otherwise use default
        return columnVisibility[col.key] ?? col.defaultVisible;
      }) || [];
      
      
      return filtered;
    })(),
    editableColumns: config?.columns.filter(col => col.editable && (columnVisibility[col.key] ?? col.defaultVisible)) || [],
    sortableColumns: config?.columns.filter(col => col.sortable && (columnVisibility[col.key] ?? col.defaultVisible)) || [],
    filterableColumns: config?.columns.filter(col => col.filterable && (columnVisibility[col.key] ?? col.defaultVisible)) || [],
    // All columns for the column visibility UI
    allColumns: config?.columns || []
  };
}