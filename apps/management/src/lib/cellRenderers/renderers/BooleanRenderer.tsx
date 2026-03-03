/**
 * Boolean Cell Renderer - Display boolean with colored border
 */

import React from 'react';
import classNames from 'classnames';
import { CellRendererProps } from '../registry';

export function BooleanRenderer({ value, column, tableName }: CellRendererProps): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="tpn-admin-boolean-null">-</span>;
  }

  const boolValue = Boolean(value);

  // Generate CSS classes: tableName__fieldKey tpn-admin-boolean tpn-admin-boolean--{true|false}
  const fieldKey = column.key.replace(/\./g, '-'); // Replace dots for CSS class safety
  const classes = classNames(
    'tpn-admin-boolean',
    `tpn-admin-boolean--${boolValue ? 'true' : 'false'}`,
    tableName && `${tableName}__${fieldKey}`
  );

  return (
    <span className={classes}>
      {boolValue ? 'Sì' : 'No'}
    </span>
  );
}
