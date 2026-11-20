import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanifica l'HTML dei documenti generato da `HtmlGenerator` (unified-backend).
 *
 * `style` è ammesso solo per i colori scelti nell'editor del gestionale:
 * `color` (colore del testo) e `background-color` (evidenziatore), con un
 * valore esadecimale o `rgb()/rgba()`. Ogni altra dichiarazione viene tolta;
 * se non ne resta nessuna, cade l'intero attributo. La dimensione del
 * carattere non passa da qui: esce come classe `fs-*`.
 */

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 's', 'mark', 'sub', 'sup', 'span'
];

const ALLOWED_ATTR = ['href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel', 'style'];

const ALLOWED_STYLE_PROPERTIES = new Set(['color', 'background-color']);

const BYTE = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|\\d?\\d)';
const ALPHA = '(?:0|1|0?\\.\\d+|1\\.0+)';
const COLOR_VALUE = new RegExp(
  `^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})` +
    `|rgb\\(\\s*${BYTE}\\s*,\\s*${BYTE}\\s*,\\s*${BYTE}\\s*\\)` +
    `|rgba\\(\\s*${BYTE}\\s*,\\s*${BYTE}\\s*,\\s*${BYTE}\\s*,\\s*${ALPHA}\\s*\\))$`,
  'i'
);

/** Tiene solo le dichiarazioni di colore valide; stringa vuota se non ne resta nessuna. */
export function filterColorStyle(style: string): string {
  const kept: string[] = [];
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    if (ALLOWED_STYLE_PROPERTIES.has(property) && COLOR_VALUE.test(value)) {
      kept.push(`${property}: ${value}`);
    }
  }
  return kept.join('; ');
}

interface AttributeHookData {
  attrName: string;
  attrValue: string;
  keepAttr: boolean;
}

function restrictStyleToColors(_node: Element, data: AttributeHookData): void {
  if (data.attrName !== 'style') return;
  const filtered = filterColorStyle(data.attrValue);
  if (filtered) {
    data.attrValue = filtered;
  } else {
    data.keepAttr = false;
  }
}

export function sanitizeDocumentHtml(html: string): string {
  // L'hook vale solo per questa chiamata: l'istanza di DOMPurify è condivisa.
  DOMPurify.addHook('uponSanitizeAttribute', restrictStyleToColors);
  try {
    return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
  } finally {
    DOMPurify.removeHook('uponSanitizeAttribute', restrictStyleToColors);
  }
}
