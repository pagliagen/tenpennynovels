/**
 * useTableConfig hook - Load and validate table configuration
 */

import { useState, useEffect } from 'react';
import { TableConfig } from '@/lib/config/schemas';
import { loadTableConfig, getNestedValue, setNestedValue, interpolateTemplate, resolveConditionalValue } from '@/lib/config/loader';
import { useUIStore } from '@/store/uiStore';

export interface UseTableConfigReturn {
  config: TableConfig | null;
  loading: boolean;
  error: Error | null;
  columnVisibility: Record<string, boolean>;
  toggleColumnVisibility: (columnKey: string) => void;
  resetColumnVisibility: () => void;
  getNestedValue: typeof getNestedValue;
  setNestedValue: typeof setNestedValue;
  interpolateTemplate: typeof interpolateTemplate;
  resolveConditionalValue: typeof resolveConditionalValue;
  allColumns: Array<{ key: string; label: string; defaultVisible: boolean }>;
}

export function useTableConfig(tableName: string): UseTableConfigReturn {
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const uiStore = useUIStore();

  // Load config on mount
  useEffect(() => {
    let isMounted = true;

    loadTableConfig(tableName)
      .then((loadedConfig) => {
        if (isMounted) {
          setConfig(loadedConfig);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err as Error);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [tableName]);

  // Column visibility helpers
  const columnVisibility = config?.columns.reduce((acc, col) => {
    acc[col.key] = uiStore.getColumnVisibility(tableName, col.key, col.defaultVisible);
    return acc;
  }, {} as Record<string, boolean>) || {};

  const toggleColumnVisibility = (columnKey: string) => {
    uiStore.toggleColumnVisibility(tableName, columnKey);
  };

  const resetColumnVisibility = () => {
    uiStore.resetColumnVisibility(tableName);
  };

  const allColumns = config?.columns.map(col => ({
    key: col.key,
    label: col.label,
    defaultVisible: col.defaultVisible
  })) || [];

  return {
    config,
    loading,
    error,
    columnVisibility,
    toggleColumnVisibility,
    resetColumnVisibility,
    getNestedValue,
    setNestedValue,
    interpolateTemplate,
    resolveConditionalValue,
    allColumns
  };
}
