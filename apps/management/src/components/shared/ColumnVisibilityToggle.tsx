import React, { useState } from 'react';
import { TableColumnConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/components/shared/ColumnVisibilityToggle.module.scss';

interface ColumnVisibilityToggleProps {
  allColumns: TableColumnConfig[];
  columnVisibility: Record<string, boolean>;
  onToggleColumn: (columnKey: string) => void;
  onResetToDefaults: () => void;
}

export function ColumnVisibilityToggle({
  allColumns,
  columnVisibility,
  onToggleColumn,
  onResetToDefaults
}: ColumnVisibilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  const visibleCount = allColumns.filter(col => {
    if (col.alwaysVisible) return true;
    return columnVisibility[col.key] ?? col.defaultVisible;
  }).length;

  return (
    <div className={styles.columnVisibilityContainer}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.toggleButton}
        title="Show/Hide Columns"
      >
        <span className={styles.icon}>👁</span>
        <span className={styles.label}>Columns ({visibleCount}/{allColumns.length})</span>
        <span className={`${styles.arrow} ${isOpen ? styles.open : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span className={styles.title}>Column Visibility</span>
            <button 
              onClick={onResetToDefaults}
              className={styles.resetButton}
              title="Reset to defaults"
            >
              ↻ Reset
            </button>
          </div>

          <div className={styles.columnList}>
            {allColumns.map(column => {
              const isVisible = columnVisibility[column.key] ?? column.defaultVisible;
              const isDisabled = column.required || column.alwaysVisible;
              
              return (
                <label 
                  key={column.key} 
                  className={`${styles.columnItem} ${isDisabled ? styles.required : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(isVisible)}
                    onChange={() => onToggleColumn(column.key)}
                    disabled={isDisabled}
                    className={styles.checkbox}
                  />
                  <span className={styles.columnLabel}>
                    {column.label}
                    {isDisabled && <span className={styles.requiredIndicator}>*</span>}
                  </span>
                </label>
              );
            })}
          </div>

          <div className={styles.footer}>
            <span className={styles.info}>
              * Required and essential columns cannot be hidden
            </span>
          </div>
        </div>
      )}

      {isOpen && (
        <div 
          className={styles.backdrop}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}