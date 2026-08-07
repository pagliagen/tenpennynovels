/**
 * HTML <-> BBCode conversion for the forum editor's VISUAL/BBCODE toggle.
 *
 * This mirrors exactly the tag/style set ForumContentSanitizer allows
 * server-side (services/unified-backend/.../ForumContentSanitizer.ts) - it is
 * NOT a general-purpose BBCode parser. Regex-based, so same-tag nesting
 * (e.g. `[b]outer [b]inner[/b] still bold[/b]`) is not supported - the first
 * closing tag wins. Acceptable for a lightweight forum editor; a real
 * grammar-based parser would be overkill here.
 *
 * @module lib/forum/bbcode
 */

const ALIGN_VALUES = ['left', 'center', 'right'];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Walks parsed HTML (browser-only, uses DOMParser) into the equivalent BBCode
 * source, for display when the author switches from VISUAL to BBCODE mode.
 */
export function htmlToBBCode(html: string): string {
  if (typeof window === 'undefined') return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');

  function walk(node: ChildNode): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const inner = Array.from(el.childNodes).map(walk).join('');

    switch (el.tagName) {
      case 'STRONG':
      case 'B':
        return `[b]${inner}[/b]`;
      case 'EM':
      case 'I':
        return `[i]${inner}[/i]`;
      case 'U':
        return `[u]${inner}[/u]`;
      case 'BLOCKQUOTE':
        return `[quote]${inner.trim()}[/quote]\n\n`;
      case 'A': {
        const href = el.getAttribute('href') || '';
        return `[url=${href}]${inner}[/url]`;
      }
      case 'IMG': {
        const src = el.getAttribute('src') || '';
        return `[img]${src}[/img]`;
      }
      case 'SPAN': {
        const style = el.getAttribute('style') || '';
        const color = /color:\s*([^;]+)/.exec(style)?.[1]?.trim();
        const fontSize = /font-size:\s*([^;]+)/.exec(style)?.[1]?.trim();
        const fontFamily = /font-family:\s*([^;]+)/.exec(style)?.[1]?.trim();
        let out = inner;
        if (fontFamily) out = `[font=${fontFamily}]${out}[/font]`;
        if (fontSize) out = `[size=${fontSize}]${out}[/size]`;
        if (color) out = `[color=${color}]${out}[/color]`;
        return out;
      }
      case 'P': {
        const style = el.getAttribute('style') || '';
        const align = /text-align:\s*([^;]+)/.exec(style)?.[1]?.trim();
        const body = inner.trim();
        if (!body) return '';
        return align && ALIGN_VALUES.includes(align) ? `[align=${align}]${body}[/align]\n\n` : `${body}\n\n`;
      }
      case 'BR':
        return '\n';
      default:
        return inner;
    }
  }

  return Array.from(doc.body.childNodes).map(walk).join('').trim();
}

/**
 * Converts BBCode source back into the sanitizer's allowed HTML subset, both
 * for the live preview pane and for feeding back into the TipTap editor when
 * switching back to VISUAL (or submitting directly from BBCODE mode).
 *
 * Escapes HTML special characters in the raw source FIRST, so literal `<`/`>`
 * typed by the author can never inject markup - only the tag substitutions
 * below (applied after escaping) introduce real HTML.
 */
export function bbcodeToHtml(bbcode: string): string {
  let text = escapeHtml(bbcode);

  text = text.replace(/\[img\](.+?)\[\/img\]/gis, (_m, src) => `<img src="${src.trim()}" alt="">`);
  text = text.replace(/\[url=(.+?)\](.+?)\[\/url\]/gis, (_m, href, label) => `<a href="${href.trim()}">${label}</a>`);
  text = text.replace(/\[color=(#?[0-9a-zA-Z]+)\](.+?)\[\/color\]/gis, (_m, val, inner) => `<span style="color: ${val}">${inner}</span>`);
  text = text.replace(/\[size=([0-9a-z%]+)\](.+?)\[\/size\]/gis, (_m, val, inner) => `<span style="font-size: ${val}">${inner}</span>`);
  text = text.replace(/\[font=([^\]]+)\](.+?)\[\/font\]/gis, (_m, val, inner) => `<span style="font-family: ${val}">${inner}</span>`);
  text = text.replace(/\[b\](.+?)\[\/b\]/gis, '<strong>$1</strong>');
  text = text.replace(/\[i\](.+?)\[\/i\]/gis, '<em>$1</em>');
  text = text.replace(/\[u\](.+?)\[\/u\]/gis, '<u>$1</u>');
  text = text.replace(/\[quote\](.+?)\[\/quote\]/gis, (_m, inner) => `<blockquote><p>${inner.trim()}</p></blockquote>`);
  text = text.replace(/\[align=(left|center|right)\](.+?)\[\/align\]/gis, (_m, val, inner) => `<p style="text-align: ${val}">${inner.trim()}</p>`);

  // Remaining blank-line-separated blocks become paragraphs.
  const blocks = text.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(p|blockquote|img)/i.test(trimmed)) return trimmed;
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  });

  return blocks.filter(Boolean).join('');
}
