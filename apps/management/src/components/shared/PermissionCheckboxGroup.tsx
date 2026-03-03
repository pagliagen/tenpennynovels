/**
 * PermissionCheckboxGroup Component
 *
 * Renders permission checkboxes with format: {label} [space] {code}
 * Auto-enables permissions from roles with lock icon indicator.
 *
 * Format example:
 * [✓] Inviare messaggi chat                    chat.send  🔒 Dal ruolo Master
 */

import React from 'react';
import styles from '@/styles/components/PermissionCheckboxGroup.module.scss';

export interface Permission {
  value: string;
  label: string;
  category: string;
  description: string;
}

export interface PermissionCheckboxGroupProps {
  title: string;
  permissions: Permission[];
  selectedPermissions: string[];
  rolePermissions: string[]; // Permissions granted by roles (auto-enabled)
  roleLabels: Record<string, string>; // Map permission -> role label (e.g., "chat.send" -> "Master")
  isGestore: boolean; // If true, all permissions are granted
  onChange: (selected: string[]) => void;
}

export function PermissionCheckboxGroup({
  title,
  permissions,
  selectedPermissions,
  rolePermissions,
  roleLabels,
  isGestore,
  onChange
}: PermissionCheckboxGroupProps): JSX.Element {
  const handleToggle = (permissionValue: string) => {
    // Can't toggle permissions granted by roles
    if (rolePermissions.includes(permissionValue) || isGestore) {
      return;
    }

    const isSelected = selectedPermissions.includes(permissionValue);
    if (isSelected) {
      onChange(selectedPermissions.filter(p => p !== permissionValue));
    } else {
      onChange([...selectedPermissions, permissionValue]);
    }
  };

  return (
    <div className={styles.permissionSection}>
      <h3 className={styles.sectionTitle}>{title}</h3>

      {isGestore && (
        <div className={styles.gestoreNotice}>
          🔒 <strong>Sei Gestore</strong> - Tutti i permessi sono automaticamente abilitati
        </div>
      )}

      <div className={styles.permissionList}>
        {permissions.map(permission => {
          const isFromRole = rolePermissions.includes(permission.value);
          const isSelected = selectedPermissions.includes(permission.value) || isFromRole || isGestore;
          const isDisabled = isFromRole || isGestore;
          const fromRole = roleLabels[permission.value];

          return (
            <label
              key={permission.value}
              className={`${styles.permissionItem} ${isDisabled ? styles.disabled : ''}`}
              title={permission.description}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(permission.value)}
                disabled={isDisabled}
              />
              <span className={styles.permissionLabel}>
                {permission.label}
              </span>
              <span className={styles.permissionCode}>
                {permission.value}
              </span>
              {isFromRole && fromRole && (
                <span className={styles.roleIndicator} title={`Permesso abilitato dal ruolo ${fromRole}`}>
                  🔒 Dal ruolo {fromRole}
                </span>
              )}
              {isGestore && !isFromRole && (
                <span className={styles.roleIndicator} title="Permesso abilitato dal flag Gestore">
                  🔒 Gestore
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
