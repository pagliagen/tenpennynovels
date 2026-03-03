/**
 * RoleCheckboxGroup Component
 *
 * Renders Gestore checkbox and character role checkboxes (Personaggio, Master, Moderatore).
 * Styling aligned with PermissionCheckboxGroup.
 */

import React from 'react';
import styles from '@/styles/components/RoleCheckboxGroup.module.scss';

export interface RoleOption {
  value: string;
  label: string;
}

export interface RoleCheckboxGroupProps {
  /** Titolo della sezione */
  title?: string;
  /** Ruoli disponibili (es. Personaggio, Master, Moderatore) */
  roles: RoleOption[];
  /** Ruoli attualmente selezionati */
  selectedRoles: string[];
  /** Flag Gestore (Super-Admin) */
  isGestore: boolean;
  /** Callback cambio ruoli */
  onRolesChange: (roles: string[]) => void;
  /** Callback cambio Gestore */
  onGestoreChange: (checked: boolean) => void;
}

export function RoleCheckboxGroup({
  title = 'Ruoli',
  roles,
  selectedRoles,
  isGestore,
  onRolesChange,
  onGestoreChange
}: RoleCheckboxGroupProps): JSX.Element {
  const handleRoleToggle = (roleValue: string) => {
    if (selectedRoles.includes(roleValue)) {
      onRolesChange(selectedRoles.filter(r => r !== roleValue));
    } else {
      onRolesChange([...selectedRoles, roleValue]);
    }
  };

  return (
    <div className={styles.roleSection}>
      <h3 className={styles.sectionTitle}>{title}</h3>

      <div className={styles.gestoreBlock}>
        <h4 className={styles.subtitle}>Gestore</h4>
        <div className={styles.roleList}>
          <label className={styles.roleItem}>
            <input
              type="checkbox"
              checked={isGestore}
              onChange={(e) => onGestoreChange(e.target.checked)}
              className={styles.checkbox}
            />
            <span className={styles.gestoreText}>Gestore (Super-Admin)</span>
          </label>
        </div>
        <p className={styles.gestoreDescription}>
          Il flag Gestore garantisce tutti i permessi automaticamente
        </p>
      </div>

      <div className={styles.rolesBlock}>
        <h4 className={styles.subtitle}>Ruoli Personaggio</h4>
        <div className={styles.roleList}>
          {roles.map(role => (
            <label key={role.value} className={styles.roleItem}>
              <input
                type="checkbox"
                checked={selectedRoles.includes(role.value)}
                onChange={() => handleRoleToggle(role.value)}
                className={styles.checkbox}
              />
              <span className={styles.roleLabel}>{role.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
