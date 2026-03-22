/**
 * Cell Renderer Registry - Plugin architecture for table cell renderers
 *
 * Pattern chiave che sostituisce il mega-switch (235 linee) del vecchio sistema.
 * Permette di aggiungere custom renderers in 5 minuti senza modificare il core.
 */

import React, { ReactNode } from 'react';
import { TableColumn } from '../config/schemas';

/**
 * Cell renderer props
 */
export interface CellRendererProps<T = Record<string, unknown>> {
  value: unknown;
  item: T;
  column: TableColumn;
  tableName?: string;
}

/**
 * Cell renderer function type
 */
export type CellRendererFn<T = Record<string, unknown>> = (
  props: CellRendererProps<T>
) => ReactNode;

/**
 * Cell Renderer Registry class
 */
export class CellRendererRegistry {
  private renderers: Map<string, CellRendererFn>;

  constructor() {
    this.renderers = new Map();
  }

  /**
   * Register a renderer for a specific type
   */
  register(type: string, renderer: CellRendererFn): void {
    if (this.renderers.has(type)) {
      console.warn(`[CellRendererRegistry] Renderer for type "${type}" already exists, overwriting`);
    }
    this.renderers.set(type, renderer);
  }

  /**
   * Unregister a renderer
   */
  unregister(type: string): void {
    this.renderers.delete(type);
  }

  /**
   * Render a cell using the registered renderer.
   *
   * Uses React.createElement so that renderers that contain hooks (e.g. ImageRenderer)
   * are treated as proper React child components with isolated hook state, instead of
   * being called as plain functions inside the parent's render cycle (which would
   * violate Rules of Hooks when the number of rendered rows changes between renders).
   */
  render<T = Record<string, unknown>>(
    type: string,
    props: CellRendererProps<T>
  ): ReactNode {
    const renderer = this.renderers.get(type);

    if (!renderer) {
      console.warn(`[CellRendererRegistry] No renderer found for type "${type}", using default`);
      return this.defaultRenderer(props as CellRendererProps<Record<string, unknown>>);
    }

    return React.createElement(
      renderer as React.FC<CellRendererProps<Record<string, unknown>>>,
      props as CellRendererProps<Record<string, unknown>>
    );
  }

  /**
   * Get a specific renderer
   */
  getRenderer(type: string): CellRendererFn | undefined {
    return this.renderers.get(type);
  }

  /**
   * Check if a renderer exists
   */
  has(type: string): boolean {
    return this.renderers.has(type);
  }

  /**
   * Get all registered renderer types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys());
  }

  /**
   * Default renderer (fallback)
   */
  private defaultRenderer(
    props: CellRendererProps<Record<string, unknown>>
  ): ReactNode {
    const { value } = props;

    if (value === null || value === undefined) {
      return React.createElement('span', { style: { color: '#999' } }, '-');
    }

    if (typeof value === 'boolean') {
      return React.createElement('span', null, value ? 'Sì' : 'No');
    }

    if (typeof value === 'object') {
      return React.createElement('span', { style: { color: '#999' } }, '[Object]');
    }

    return React.createElement('span', null, String(value));
  }
}

/**
 * Singleton instance
 */
export const cellRenderers = new CellRendererRegistry();
