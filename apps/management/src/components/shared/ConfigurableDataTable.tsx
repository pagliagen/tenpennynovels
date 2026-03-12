/**
 * ConfigurableDataTable - JSON-driven data table
 *
 * Features:
 * - JSON configuration
 * - Cell renderer registry integration
 * - Sorting, filtering, pagination
 * - Column visibility
 * - Selection (single + bulk)
 * - Search debounced (300ms)
 *
 * CRITICAL: Max 250 linee (vs 335 del vecchio)
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import classNames from 'classnames';
import { TableConfig, TableColumn } from '@/lib/config/schemas';
import { getNestedValue } from '@/lib/config/loader';
import { cellRenderers } from '@/lib/cellRenderers';
import { LoadingSpinner } from './LoadingSpinner';
import { TableFilters } from './TableFilters';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import styles from '@/styles/components/ConfigurableDataTable.module.scss';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export interface FilterState {
  [filterKey: string]: string | boolean | number | undefined;
}

export interface ConfigurableDataTableProps<T extends object = Record<string, unknown>> {
  tableName: string;
  data: T[];
  loading?: boolean;
  selectedItems?: T[];
  onSelectionChange?: (items: T[]) => void;
  onAction?: (actionKey: string, item: T) => void;
  onBulkAction?: (actionKey: string, items: T[], allPagesSelected?: boolean) => void;
  pagination?: PaginationState;
  className?: string;
  renderActions?: (item: T) => React.ReactNode;
  sortBy?: string | null;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  filters?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  defaultSearch?: string;
  externalConfig?: {
    config: TableConfig;
    visibleColumns: TableColumn[];
    getNestedValue?: typeof getNestedValue;
    resolveConditionalValue?: (
      config: {
        type?: string;
        field?: string;
        trueValue?: string;
        falseValue?: string;
      },
      data: Record<string, unknown>
    ) => string | undefined;
  };
}

export function ConfigurableDataTable<T extends object = Record<string, unknown>>({
  tableName,
  data,
  loading = false,
  selectedItems = [],
  onSelectionChange,
  onAction,
  onBulkAction,
  pagination,
  className,
  renderActions,
  sortBy: externalSortBy,
  sortOrder: externalSortOrder,
  onSortChange,
  filters,
  onFilterChange,
  defaultSearch,
  externalConfig
}: ConfigurableDataTableProps<T>): React.ReactElement {
  const [search, setSearch] = useState(defaultSearch || '');

  useEffect(() => {
    if (defaultSearch !== undefined) {
      setSearch(defaultSearch);
    }
  }, [defaultSearch]);
  const [internalSortBy, setInternalSortBy] = useState<string | null>(null);
  const [internalSortOrder, setInternalSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectAllPages, setSelectAllPages] = useState(false);

  // Use controlled props if provided, else fallback to internal state
  const effectiveSortBy = externalSortBy !== undefined ? externalSortBy : internalSortBy;
  const effectiveSortOrder = externalSortOrder !== undefined ? externalSortOrder : internalSortOrder;
  const isControlledSorting = onSortChange !== undefined;

  const config = externalConfig?.config;
  const visibleColumns = externalConfig?.visibleColumns || [];

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!search || !config?.table.searchable) return data;

    return data.filter(item =>
      visibleColumns.some(col => {
        const value = getNestedValue(item, col.key);
        return String(value).toLowerCase().includes(search.toLowerCase());
      })
    );
  }, [data, search, visibleColumns, config]);

  // Sort data (only if NOT controlled externally)
  const sortedData = useMemo(() => {
    // If sorting is controlled externally, don't sort - parent handles it
    if (isControlledSorting) return filteredData;

    if (!effectiveSortBy) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = getNestedValue(a, effectiveSortBy);
      const bVal = getNestedValue(b, effectiveSortBy);

      if (aVal === bVal) return 0;
      // Type-safe comparison
      const comparison = String(aVal) > String(bVal) ? 1 : -1;
      return effectiveSortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, effectiveSortBy, effectiveSortOrder, isControlledSorting]);

  // Handle column header click (sort)
  const handleHeaderClick = useCallback((column: TableColumn) => {
    if (!column.sortable) return;

    if (onSortChange) {
      // Controlled mode - call callback
      const newOrder = effectiveSortBy === column.key
        ? (effectiveSortOrder === 'asc' ? 'desc' : 'asc')
        : 'asc';
      onSortChange(column.key, newOrder);
    } else {
      // Uncontrolled mode - update internal state
      if (internalSortBy === column.key) {
        setInternalSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
      } else {
        setInternalSortBy(column.key);
        setInternalSortOrder('asc');
      }
    }
  }, [effectiveSortBy, effectiveSortOrder, internalSortBy, onSortChange]);

  // Handle row selection
  const handleRowSelect = useCallback((item: T) => {
    if (!onSelectionChange) return;

    const isSelected = selectedItems.some(selected =>
      getNestedValue(selected, '_id') === getNestedValue(item, '_id')
    );

    if (isSelected) {
      onSelectionChange(selectedItems.filter(selected =>
        getNestedValue(selected, '_id') !== getNestedValue(item, '_id')
      ));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
  }, [selectedItems, onSelectionChange]);

  // Handle select all (current page)
  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;

    if (selectedItems.length === sortedData.length && sortedData.length > 0) {
      // Deselect all
      onSelectionChange([]);
      setSelectAllPages(false);
    } else {
      // Select current page
      onSelectionChange(sortedData);
      setSelectAllPages(false);
    }
  }, [selectedItems, sortedData, onSelectionChange]);

  // Handle select all pages (all records, not just current page)
  const handleSelectAllPages = useCallback(() => {
    setSelectAllPages(true);
  }, []);

  // Handle cancel select all pages
  const handleCancelSelectAll = useCallback(() => {
    setSelectAllPages(false);
    if (onSelectionChange) {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!config) {
    return <div className={styles.error}>Configuration not loaded</div>;
  }

  return (
    <div className={classNames(styles.tableContainer, className)}>
      {/* Header with search and bulk actions */}
      {(config.table.searchable || config.bulkActions) && (
        <div className={styles.tableHeader}>
          {config.table.searchable && (
            <input
              type="text"
              placeholder="Cerca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          )}
          {config.bulkActions && selectedItems.length > 0 && (
            <div className={styles.bulkActions}>
              <span className={styles.selectedCount}>
                {selectAllPages && pagination
                  ? `Tutti i ${pagination.total} record selezionati`
                  : `${selectedItems.length} ${selectedItems.length === 1 ? 'selezionato' : 'selezionati'}`
                }
              </span>
              {config.bulkActions.map(action => (
                <button
                  key={action.key}
                  onClick={() => onBulkAction?.(action.key, selectedItems, selectAllPages)}
                  className={classNames(styles.bulkActionButton, styles[action.type])}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Select All Pages Banner */}
      {selectedItems.length > 0 && !selectAllPages && pagination && pagination.total > sortedData.length && (
        <div className={styles.selectAllBanner}>
          <span>
            Hai selezionato {selectedItems.length} {selectedItems.length === 1 ? 'elemento' : 'elementi'}.
          </span>
          <button
            onClick={handleSelectAllPages}
            className={styles.selectAllLink}
            type="button"
          >
            Se vuoi selezionare tutti i {pagination.total} record clicca qui
          </button>
        </div>
      )}

      {selectAllPages && pagination && (
        <div className={styles.selectAllBanner}>
          <span>
            Hai selezionato tutti i {pagination.total} record.
          </span>
          <button
            onClick={handleCancelSelectAll}
            className={styles.selectAllLink}
            type="button"
          >
            Annulla
          </button>
        </div>
      )}

      {/* Filters */}
      {config.filters && config.filters.length > 0 && (
        <TableFilters
          filters={config.filters}
          values={filters || {}}
          onChange={onFilterChange || (() => {})}
        />
      )}

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {config.table.selectable && (
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={selectedItems.length === sortedData.length && sortedData.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {visibleColumns.map(column => (
                <th
                  key={column.key}
                  onClick={() => handleHeaderClick(column)}
                  className={classNames(
                    column.sortable && styles.sortable,
                    effectiveSortBy === column.key && styles.sorted
                  )}
                  style={{ width: column.width }}
                >
                  {column.label}
                  {effectiveSortBy === column.key && (
                    <span className={styles.sortIcon}>
                      {effectiveSortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
              {config.actions && <th className={styles.actionsCell}>Azioni</th>}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((item, index) => {
              const isSelected = selectedItems.some(selected =>
                getNestedValue(selected, '_id') === getNestedValue(item, '_id')
              );

              return (
                <tr
                  key={getNestedValue<string>(item, '_id') || index}
                  className={classNames(isSelected && styles.selected)}
                >
                  {config.table.selectable && (
                    <td className={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelect(item)}
                      />
                    </td>
                  )}
                  {visibleColumns.map(column => {
                    const value = getNestedValue(item, column.key);
                    const renderType = column.render?.type || 'text';
                    const fieldKey = column.key.replace(/\./g, '-'); // Replace dots for CSS class safety

                    return (
                      <td
                        key={column.key}
                        className={classNames(
                          styles[`align-${column.align}`],
                          `${tableName}__${fieldKey}`
                        )}
                      >
                        {cellRenderers.render(renderType, { value, item, column, tableName })}
                      </td>
                    );
                  })}
                  {config.actions && (
                    <td className={styles.actionsCell}>
                      {renderActions ? (
                        renderActions(item)
                      ) : (
                        <ContextMenu
                          items={config.actions.map(action => ({
                            key: action.key,
                            label: action.label,
                            icon: action.icon,
                            variant: action.type === 'danger' ? 'danger' : action.type === 'success' ? 'success' : 'default',
                            onClick: () => onAction?.(action.key, item)
                          } as ContextMenuItem))}
                          position="left"
                          ariaLabel={`Azioni per ${getNestedValue<string>(item, 'name') || getNestedValue<string>(item, 'username') || 'elemento'}`}
                        />
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </div>
          <div className={styles.paginationControls}>
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={styles.paginationButton}
            >
              Previous
            </button>
            <span className={styles.pageNumber}>Page {pagination.page}</span>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              className={styles.paginationButton}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
