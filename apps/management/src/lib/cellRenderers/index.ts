/**
 * Cell Renderers - Bootstrap and exports
 *
 * Registra tutti i renderers di default all'avvio dell'app
 */

import { cellRenderers } from './registry';
import { TextRenderer } from './renderers/TextRenderer';
import { BadgeRenderer } from './renderers/BadgeRenderer';
import { BadgeListRenderer } from './renderers/BadgeListRenderer';
import { DateTimeRenderer } from './renderers/DateTimeRenderer';
import { BooleanRenderer } from './renderers/BooleanRenderer';
import { ConflictBadgeRenderer } from './renderers/ConflictBadgeRenderer';
import { ImageRenderer } from './renderers/ImageRenderer';

/**
 * Bootstrap default renderers
 */
export function bootstrapRenderers(): void {
  // Register default renderers
  cellRenderers.register('text', TextRenderer);
  cellRenderers.register('badge', BadgeRenderer);
  cellRenderers.register('badge-list', BadgeListRenderer);
  cellRenderers.register('datetime', DateTimeRenderer);
  cellRenderers.register('date', DateTimeRenderer); // Alias
  cellRenderers.register('boolean', BooleanRenderer);
  cellRenderers.register('conflict-badge', ConflictBadgeRenderer); // For deleted records
  cellRenderers.register('image', ImageRenderer);

  if (process.env.NODE_ENV === 'development') {
    console.log('[CellRenderers] Registered types:', cellRenderers.getRegisteredTypes());
  }
}

/**
 * Export registry and renderers
 */
export { cellRenderers } from './registry';
export { TextRenderer } from './renderers/TextRenderer';
export { BadgeRenderer } from './renderers/BadgeRenderer';
export { BadgeListRenderer } from './renderers/BadgeListRenderer';
export { DateTimeRenderer } from './renderers/DateTimeRenderer';
export { BooleanRenderer } from './renderers/BooleanRenderer';
export { ConflictBadgeRenderer } from './renderers/ConflictBadgeRenderer';
export { ImageRenderer } from './renderers/ImageRenderer';

export type { CellRendererProps, CellRendererFn } from './registry';
