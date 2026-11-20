/**
 * Immagine dell'editor documenti: ridimensionabile con le maniglie agli angoli
 * e con una posizione rispetto al testo.
 *
 * - `width`/`height` (px) li scrive il ridimensionamento nativo di TipTap. Sul
 *   sito esce solo `width` (l'altezza segue le proporzioni, `max-width: 100%`).
 * - `align`: `left`/`right` = a lato con il testo intorno, `center` = da sola
 *   sulla riga, `null` = nel testo, come prima.
 *
 * ⚠️ Valori e classi da tenere allineati in tre posti (niente npm workspace):
 * `IMAGE_ALIGN_CLASSES` in `services/unified-backend/.../HtmlGenerator.ts`, le
 * classi `img-*` in `apps/documents/.../DocumentDetail.module.scss` e, per
 * l'anteprima, `DocumentContentEditor.module.scss`.
 */
import Image from '@tiptap/extension-image';

export const IMAGE_ALIGNS = ['left', 'center', 'right'] as const;

export type ImageAlign = (typeof IMAGE_ALIGNS)[number];

export function isImageAlign(value: unknown): value is ImageAlign {
  return typeof value === 'string' && (IMAGE_ALIGNS as readonly string[]).includes(value);
}

export const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-align');
          return isImageAlign(value) ? value : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          isImageAlign(attributes.align) ? { 'data-align': attributes.align } : {}
      }
    };
  }
}).configure({
  inline: true,
  allowBase64: true,
  resize: {
    enabled: true,
    directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    minWidth: 60,
    minHeight: 40,
    // Con le proporzioni libere un'immagine si deforma al primo trascinamento,
    // e il sito ignora comunque l'altezza.
    alwaysPreserveAspectRatio: true
  }
});
