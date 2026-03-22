/**
 * Zod schemas for JSON configuration validation
 *
 * Provides type-safe configuration loading with runtime validation
 */

import { z } from 'zod';

/**
 * Table column schema
 */
export const TableColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'number', 'boolean', 'date', 'datetime', 'select', 'multiselect']),
  visible: z.boolean().default(true),
  defaultVisible: z.boolean().default(true),
  alwaysVisible: z.boolean().default(false),
  sortable: z.boolean().default(true),
  filterable: z.boolean().default(false),
  editable: z.boolean().default(false),
  required: z.boolean().default(false),
  width: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).default('left'),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    email: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  render: z.object({
    type: z.string(),
    className: z.string().optional(),
    showSubtext: z.boolean().optional(),
    subtextField: z.string().optional(),
    trueValue: z.string().optional(),
    falseValue: z.string().optional(),
    options: z.array(z.object({
      value: z.union([z.string(), z.number(), z.boolean()]),
      label: z.string(),
      color: z.string().optional()
    })).optional(),
    format: z.string().optional(), // date format
    fallback: z.string().optional() // es. ImageRenderer placeholder
  }).optional()
});

/**
 * Table action schema
 */
export const TableActionSchema = z.object({
  key: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  type: z.enum(['primary', 'secondary', 'danger', 'success']).default('secondary'),
  visible: z.boolean().default(true),
  className: z.string().optional(),
  permission: z.string().optional(),
  confirmMessage: z.string().optional()
});

/**
 * Table bulk action schema
 */
export const TableBulkActionSchema = z.object({
  key: z.string(),
  label: z.string(),
  icon: z.string().optional(),
  type: z.enum(['primary', 'secondary', 'danger', 'success']).default('secondary'),
  permission: z.string().optional(),
  confirmMessage: z.string().optional()
});

/**
 * Table filter schema
 */
export const TableFilterSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'select', 'multiselect', 'date', 'daterange']),
  field: z.string(),
  options: z.array(z.object({
    value: z.union([z.string(), z.number(), z.boolean()]),
    label: z.string()
  })).optional(),
  placeholder: z.string().optional()
});

/**
 * SidePanel field schema
 */
export const SidePanelFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'email', 'number', 'password', 'textarea', 'select', 'multiselect', 'checkbox', 'date', 'datetime']),
  required: z.boolean().default(false),
  disabled: z.boolean().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    email: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  options: z.array(z.object({
    value: z.union([z.string(), z.number(), z.boolean()]),
    label: z.string()
  })).optional(),
  condition: z.object({
    field: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()])
  }).optional() // Conditional rendering
});

/**
 * SidePanel action schema
 */
export const SidePanelActionSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['primary', 'secondary', 'danger']).default('secondary'),
  loading: z.boolean().default(false)
});

/**
 * SidePanel schema
 */
export const SidePanelSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  width: z.enum(['small', 'medium', 'large']).default('medium'),
  fields: z.array(SidePanelFieldSchema),
  actions: z.array(SidePanelActionSchema)
});

/**
 * Table configuration schema
 */
export const TableConfigSchema = z.object({
  _meta: z.object({
    version: z.string(),
    description: z.string().optional(),
    lastUpdated: z.string().optional()
  }),
  table: z.object({
    name: z.string(),
    title: z.string(),
    icon: z.string().optional(),
    searchable: z.boolean().default(true),
    selectable: z.boolean().default(true),
    pagination: z.object({
      defaultPageSize: z.number().default(25),
      pageSizeOptions: z.array(z.number()).default([10, 25, 50, 100])
    })
  }),
  columns: z.array(TableColumnSchema),
  actions: z.array(TableActionSchema).optional(),
  bulkActions: z.array(TableBulkActionSchema).optional(),
  filters: z.array(TableFilterSchema).optional(),
  sidePanels: z.record(z.string(), SidePanelSchema).optional()
});

/**
 * Infer TypeScript types from schemas
 */
export type TableColumn = z.infer<typeof TableColumnSchema>;
export type TableAction = z.infer<typeof TableActionSchema>;
export type TableBulkAction = z.infer<typeof TableBulkActionSchema>;
export type TableFilter = z.infer<typeof TableFilterSchema>;
export type SidePanelField = z.infer<typeof SidePanelFieldSchema>;
export type SidePanelAction = z.infer<typeof SidePanelActionSchema>;
export type SidePanel = z.infer<typeof SidePanelSchema>;
export type TableConfig = z.infer<typeof TableConfigSchema>;
