import React from 'react';
import { TableColumnConfig } from '@/hooks/useTableConfig';
import styles from '@/styles/components/shared/TableCellRenderer.module.scss';

interface TableCellRendererProps {
  value: any;
  item: any;
  column: TableColumnConfig;
  getNestedValue: (obj: any, path: string) => any;
  onCellClick?: (item: any, columnKey: string, value: any) => void;
}

export function TableCellRenderer({ 
  value, 
  item, 
  column, 
  getNestedValue,
  onCellClick 
}: TableCellRendererProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  // Handle different render types
  switch (column.render?.type) {
    case 'user_cell':
      const subtextValue = column.render.subtextField 
        ? getNestedValue(item, column.render.subtextField)
        : null;
      
      return (
        <div className={styles.userCell}>
          <div className={styles.username}>{value}</div>
          {column.render.showSubtext && subtextValue && (
            <div className={styles.userMeta}>{subtextValue}</div>
          )}
        </div>
      );

    case 'email':
      return (
        <span className={`${styles.emailColumn} ${column.render.className || ''}`}>
          {value}
        </span>
      );

    case 'badge':
      // Handle colorMap-based badges
      if (column.render?.colorMap) {
        const colorClass = column.render.colorMap[value] || 'default';
        return (
          <span className={`${styles.badge} ${styles[`${colorClass}Badge`]}`}>
            {value}
          </span>
        );
      }
      // Handle legacy true/false badges
      const badgeConfig = value ? column.render.trueValue : column.render.falseValue;
      return (
        <span className={`${styles.badge} ${styles[badgeConfig?.className || '']}`}>
          {badgeConfig?.text || value}
        </span>
      );

    case 'role_badge':
      if (!value) {
        return <span className={styles.noRoles}>{column.render.nullText || '-'}</span>;
      }
      return (
        <div className={styles.rolesList}>
          <span className={`${styles.roleBadge} ${styles[`role-${value}`]}`}>
            {value}
          </span>
        </div>
      );

    case 'multi_role_badges':
      if (!value || !Array.isArray(value) || value.length === 0) {
        return <span className={styles.noRoles}>{column.render?.emptyText || '-'}</span>;
      }
      
      const maxVisible = column.render?.maxVisible || 3;
      const visibleRoles = value.slice(0, maxVisible);
      const remainingCount = value.length - maxVisible;
      
      return (
        <div className={`${styles.rolesList} ${column.render?.className || ''}`}>
          {visibleRoles.map((role, index) => (
            <span key={`${role}-${index}`} className={`${styles.roleBadge} ${styles[`role-${role}`]}`}>
              {role}
            </span>
          ))}
          {remainingCount > 0 && column.render?.showCount && (
            <span className={styles.moreRoles}>
              +{remainingCount}
            </span>
          )}
        </div>
      );

    case 'multi_scope_badges':
      if (!value || !Array.isArray(value) || value.length === 0) {
        return <span className={styles.noRoles}>{column.render?.emptyText || '-'}</span>;
      }
      
      const maxScopesVisible = column.render?.maxVisible || 3;
      const visibleScopes = value.slice(0, maxScopesVisible);
      const remainingScopeCount = value.length - maxScopesVisible;
      const badgeConfigs = column.render?.badges || {};
      
      return (
        <div className={`${styles.scopesList} ${column.render?.className || ''}`}>
          {visibleScopes.map((scope, index) => {
            const badgeConfig = badgeConfigs[scope] || { text: scope, className: 'defaultScopeBadge' };
            return (
              <span key={`${scope}-${index}`} className={`${styles.scopeBadge} ${styles[badgeConfig.className]}`}>
                {badgeConfig.text}
              </span>
            );
          })}
          {remainingScopeCount > 0 && column.render?.showCount && (
            <span className={styles.moreScopes}>
              +{remainingScopeCount}
            </span>
          )}
        </div>
      );

    case 'count':
      return (
        <span className={`${styles.characterCount} ${column.render.className || ''}`}>
          {Array.isArray(value) ? value.length : (value || 0)}
        </span>
      );

    case 'status_badge':
      const statusMap = column.render?.statusMap || {};
      const statusConfig = statusMap[value] || { text: value, className: value?.toLowerCase() };
      return (
        <span className={`${styles.statusBadge} ${styles[statusConfig.className || '']}`}>
          {statusConfig.text || value}
        </span>
      );

    case 'priority_badge':
      const priorityMap = column.render?.priorityMap || {};
      const priorityConfig = priorityMap[value] || { text: value, className: value?.toLowerCase() };
      return (
        <span className={`${styles.priorityBadge} ${styles[priorityConfig.className || '']}`}>
          {priorityConfig.text || value}
        </span>
      );

    case 'account_status_badge':
      const accountStatus = value; // value should be the accountStatus object
      const logic = column.render.logic;
      const priority = column.render.priority || ['banned', 'inactive', 'active'];
      
      // Find the first matching condition based on priority
      let matchedStatus = null;
      let statusKey = null;
      if (logic) {
        for (const key of priority) {
          const statusRule = logic[key];
          if (statusRule && accountStatus && accountStatus[statusRule.field] === statusRule.value) {
            matchedStatus = statusRule;
            statusKey = key;
            break;
          }
        }
      }
      
      // Fallback to default if no match
      if (!matchedStatus) {
        matchedStatus = { text: 'Unknown', className: 'unknown' };
        statusKey = 'unknown';
      }
      
      const isClickable = statusKey === 'banned' && onCellClick;
      
      return (
        <span 
          className={`${styles.statusBadge} ${styles[matchedStatus.className || '']} ${isClickable ? styles.clickable : ''}`}
          onClick={isClickable ? () => onCellClick(item, column.key, value) : undefined}
          style={isClickable ? { cursor: 'pointer' } : undefined}
        >
          {matchedStatus.text}
        </span>
      );

    case 'datetime':
      if (column.render.nullable && !value) {
        return <span>-</span>;
      }
      return <span>{formatDate(value)}</span>;

    default:
      // Handle nested values
      if (column.type === 'nested_boolean' || 
          column.type === 'nested_datetime' || 
          column.type === 'nested_number') {
        const nestedValue = getNestedValue(item, column.key);
        
        if (column.type === 'nested_datetime') {
          return <span>{formatDate(nestedValue)}</span>;
        }
        if (column.type === 'nested_boolean') {
          return <span>{nestedValue ? 'Yes' : 'No'}</span>;
        }
        return <span>{nestedValue || '-'}</span>;
      }

      if (column.type === 'array_length') {
        return <span>{Array.isArray(value) ? value.length : 0}</span>;
      }

      if (column.type === 'boolean') {
        return <span>{value ? 'Yes' : 'No'}</span>;
      }

      // Default text rendering with emptyText support
      if (!value && column.render?.emptyText) {
        return <span className={styles.emptyText}>{column.render.emptyText}</span>;
      }
      return <span>{String(value || '')}</span>;
  }
}