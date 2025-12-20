import React, { useState, useMemo } from 'react';
import styles from '@/styles/components/shared/DataTable.module.scss';

export interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  searchable?: boolean;
  selectable?: boolean;
  selectedItems?: T[];
  onSelectionChange?: (items: T[]) => void;
  onRowClick?: (item: T) => void;
  actions?: {
    label: string | ((item: T) => string);
    icon: string | ((item: T) => string);
    onClick: (item: T) => void;
    visible?: (item: T) => boolean;
    className?: string | ((item: T) => string);
  }[];
  bulkActions?: {
    label: string;
    icon: string;
    onClick: (items: T[]) => void;
    className?: string;
  }[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'Nessun dato disponibile',
  searchable = false,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  onRowClick,
  actions = [],
  bulkActions = [],
  pagination,
  className
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!searchTerm) return data;
    
    return data.filter(item => {
      return columns.some(column => {
        if (!column.filterable) return false;
        const value = item[column.key];
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, columns]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!Array.isArray(filteredData)) return [];
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return;

    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    onSelectionChange(checked ? sortedData : []);
  };

  const handleSelectItem = (item: T, checked: boolean) => {
    if (!onSelectionChange) return;
    
    const newSelection = checked
      ? [...selectedItems, item]
      : selectedItems.filter(selected => selected !== item);
    
    onSelectionChange(newSelection);
  };

  const isSelected = (item: T) => selectedItems.includes(item);
  const allSelected = sortedData.length > 0 && sortedData.every(isSelected);
  const someSelected = selectedItems.length > 0 && !allSelected;

  return (
    <div className={`${styles.dataTable} ${className || ''}`}>
      {/* Header with search and bulk actions */}
      {(searchable || bulkActions.length > 0) && (
        <div className={styles.tableHeader}>
          {searchable && (
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Cerca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <span className={styles.searchIcon}>🔍</span>
            </div>
          )}

          {bulkActions.length > 0 && selectedItems.length > 0 && (
            <div className={styles.bulkActions}>
              <span className={styles.selectionCount}>
                {selectedItems.length} elementi selezionati
              </span>
              {bulkActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => action.onClick(selectedItems)}
                  className={`${styles.bulkActionButton} ${action.className || ''}`}
                >
                  <span className={styles.actionIcon}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              {selectable && (
                <th className={styles.selectColumn}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className={styles.checkbox}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${styles.tableHeaderCell} ${
                    column.sortable ? styles.sortable : ''
                  } ${styles[`align-${column.align || 'left'}`]} ${column.className || ''}`}
                  style={{ width: column.width }}
                  onClick={() => handleSort(column.key)}
                >
                  <div className={styles.headerContent}>
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className={styles.sortIndicator}>
                        {sortConfig?.key === column.key ? (
                          sortConfig.direction === 'asc' ? '↑' : '↓'
                        ) : (
                          '↕'
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              {actions.length > 0 && (
                <th className={`${styles.actionsColumn} ${styles['align-center']}`}>
                  Azioni
                </th>
              )}
            </tr>
          </thead>
          
          <tbody className={styles.tableBody}>
            {loading ? (
              <tr>
                <td 
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  className={styles.loadingCell}
                >
                  <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                    <span>Caricamento...</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                  className={styles.emptyCell}
                >
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>📭</span>
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => (
                <tr
                  key={index}
                  className={`${styles.tableRow} ${
                    isSelected(item) ? styles.selected : ''
                  } ${onRowClick ? styles.clickable : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {selectable && (
                    <td className={styles.selectColumn}>
                      <input
                        type="checkbox"
                        checked={isSelected(item)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectItem(item, e.target.checked);
                        }}
                        className={styles.checkbox}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`${styles.tableCell} ${
                        styles[`align-${column.align || 'left'}`]
                      } ${column.className || ''}`}
                    >
                      {column.render 
                        ? column.render(item[column.key], item)
                        : String(item[column.key] || '')
                      }
                    </td>
                  ))}
                  {actions.length > 0 && (
                    <td className={`${styles.actionsColumn} ${styles['align-center']}`}>
                      <div className={styles.actionButtons}>
                        {actions
                          .filter(action => !action.visible || action.visible(item))
                          .map((action, actionIndex) => (
                            <button
                              key={actionIndex}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(item);
                              }}
                              className={`${styles.actionButton} ${
                                typeof action.className === 'function' 
                                  ? action.className(item) 
                                  : (action.className || '')
                              }`}
                              title={
                                typeof action.label === 'function' 
                                  ? action.label(item) 
                                  : action.label
                              }
                            >
                              <span className={styles.actionIcon}>
                                {typeof action.icon === 'function' 
                                  ? action.icon(item) 
                                  : action.icon
                                }
                              </span>
                            </button>
                          ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing {Math.min(data?.length || 0, pagination.pageSize)} of {pagination.total} elementi
          </div>
          
          <div className={styles.paginationControls}>
            <select
              value={pagination.pageSize}
              onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
              className={styles.pageSizeSelect}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            
            <div className={styles.pageButtons}>
              <button
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className={styles.pageButton}
              >
                ‹
              </button>
              
              <span className={styles.pageInfo}>
                Pagina {pagination.page} di {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                className={styles.pageButton}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}