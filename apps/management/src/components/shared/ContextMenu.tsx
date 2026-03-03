/**
 * ContextMenu Component
 *
 * Reusable dropdown menu component activated by three-dots button.
 * Used for row actions in tables and context-sensitive operations.
 *
 * Features:
 * - Click outside to close
 * - ESC key to close
 * - Conditional items (disabled state)
 * - Dividers between groups
 * - Variant styling (default, danger, success)
 * - Configurable positioning (left/right)
 *
 * @module components/shared/ContextMenu
 */

import React, { useState, useEffect, useRef } from 'react';
import classNames from 'classnames';
import styles from './ContextMenu.module.scss';

export interface ContextMenuItem {
  /** Unique key for the item */
  key: string;

  /** Display label */
  label: string;

  /** Optional icon (emoji or icon string) */
  icon?: string;

  /** Click handler */
  onClick: () => void;

  /** Visual variant for styling */
  variant?: 'default' | 'danger' | 'success';

  /** Disabled state */
  disabled?: boolean;

  /** Show divider after this item */
  dividerAfter?: boolean;
}

export interface ContextMenuProps {
  /** Menu items to display */
  items: ContextMenuItem[];

  /** Trigger button icon (default: ⋮) */
  triggerIcon?: string;

  /** Menu position relative to trigger (default: right) */
  position?: 'left' | 'right';

  /** Additional CSS class */
  className?: string;

  /** Aria label for accessibility */
  ariaLabel?: string;
}

/**
 * ContextMenu Component
 *
 * Dropdown menu with three-dots trigger button.
 * Automatically closes on click outside or ESC key.
 *
 * @example
 * ```tsx
 * <ContextMenu
 *   items={[
 *     { key: 'edit', label: 'Modifica', icon: '✏️', onClick: handleEdit },
 *     { key: 'delete', label: 'Elimina', icon: '🗑️', variant: 'danger', onClick: handleDelete, dividerAfter: true }
 *   ]}
 *   position="left"
 * />
 * ```
 */
export function ContextMenu({
  items,
  triggerIcon = '⋮',
  position = 'right',
  className,
  ariaLabel = 'Open menu'
}: ContextMenuProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Close menu on click outside
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /**
   * Close menu on ESC key
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return (
    <div className={classNames(styles.contextMenu, className)} ref={menuRef}>
      {/* Trigger Button */}
      <button
        className={styles.trigger}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        type="button"
      >
        {triggerIcon}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={classNames(styles.menu, styles[position])}
          role="menu"
        >
          {items.map((item, index) => (
            <React.Fragment key={item.key}>
              <button
                className={classNames(
                  styles.menuItem,
                  item.variant && styles[item.variant],
                  item.disabled && styles.disabled
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.disabled) {
                    item.onClick();
                    setIsOpen(false);
                  }
                }}
                disabled={item.disabled}
                role="menuitem"
                type="button"
              >
                {item.icon && <span className={styles.icon}>{item.icon}</span>}
                <span className={styles.label}>{item.label}</span>
              </button>

              {/* Divider */}
              {item.dividerAfter && index < items.length - 1 && (
                <div className={styles.divider} role="separator" />
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
