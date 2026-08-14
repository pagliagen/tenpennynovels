/**
 * HtmlGenerator Service
 *
 * Converts TipTap Delta JSON to HTML with automatic H1 ID injection.
 * Similar to ChunkParser but outputs HTML instead of plaintext.
 *
 * Usage:
 *   const html = generateHtml(contentDelta, { injectHeadingIds: true });
 *   // Returns: "<h1 id=\"slug\">Title</h1><p>Content...</p>"
 */

import slugify from 'slugify';

export interface HtmlGeneratorOptions {
  injectHeadingIds?: boolean;  // Default: true - inject id="slug" into all heading tags
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
}

interface TipTapDelta {
  type: 'doc';
  content?: TipTapNode[];
}

/**
 * Main generator function - converts TipTap Delta JSON to HTML
 */
export function generateHtml(
  contentDelta: any,
  options: HtmlGeneratorOptions = {}
): string {
  const { injectHeadingIds = true } = options;

  // Ensure contentDelta is an object
  const delta = typeof contentDelta === 'string'
    ? JSON.parse(contentDelta)
    : contentDelta;

  if (!delta || delta.type !== 'doc') {
    throw new Error('Invalid TipTap Delta: must be a doc node');
  }

  const nodes = delta.content || [];
  let html = '';

  for (const node of nodes) {
    html += nodeToHtml(node, injectHeadingIds);
  }

  return html.trim();
}

/**
 * Convert a single TipTap node to HTML (recursive)
 */
function nodeToHtml(node: TipTapNode, injectHeadingIds: boolean): string {
  switch (node.type) {
    // ========== HEADINGS ==========
    case 'heading': {
      const level = node.attrs?.level || 1;
      const tag = `h${level}`;
      const text = extractTextContent(node);

      // Use existing ID if present
      if (node.attrs?.id) {
        return `<${tag} id="${node.attrs.id}">${text}</${tag}>`;
      }

      // Inject slug-based ID on all heading levels for anchor navigation
      if (injectHeadingIds) {
        const slug = generateSlug(text);
        return `<${tag} id="${slug}">${text}</${tag}>`;
      }

      return `<${tag}>${text}</${tag}>`;
    }

    // ========== PARAGRAPHS ==========
    case 'paragraph': {
      const content = node.content
        ? node.content.map(child => inlineNodeToHtml(child)).join('')
        : '';
      return content ? `<p>${content}</p>` : '';
    }

    // ========== LISTS ==========
    case 'bulletList': {
      const items = (node.content || [])
        .map(item => nodeToHtml(item, injectHeadingIds))
        .join('');
      return `<ul>${items}</ul>`;
    }

    case 'orderedList': {
      const items = (node.content || [])
        .map(item => nodeToHtml(item, injectHeadingIds))
        .join('');
      const start = node.attrs?.start;
      return start && start !== 1
        ? `<ol start="${start}">${items}</ol>`
        : `<ol>${items}</ol>`;
    }

    case 'listItem': {
      const content = (node.content || [])
        .map(child => nodeToHtml(child, injectHeadingIds))
        .join('');
      return `<li>${content}</li>`;
    }

    // ========== BLOCKQUOTE ==========
    case 'blockquote': {
      const content = (node.content || [])
        .map(child => nodeToHtml(child, injectHeadingIds))
        .join('');
      return `<blockquote>${content}</blockquote>`;
    }

    // ========== CODE BLOCK ==========
    case 'codeBlock': {
      const text = extractTextContent(node);
      const language = node.attrs?.language;
      return language
        ? `<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`
        : `<pre><code>${escapeHtml(text)}</code></pre>`;
    }

    // ========== HORIZONTAL RULE ==========
    case 'horizontalRule': {
      return '<hr>';
    }

    // ========== HARD BREAK ==========
    case 'hardBreak': {
      return '<br>';
    }

    // ========== IMAGE ==========
    case 'image': {
      const src = node.attrs?.src || '';
      const alt = node.attrs?.alt || '';
      const title = node.attrs?.title;
      return title
        ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title)}">`
        : `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
    }

    // ========== TABLE (basic support) ==========
    case 'table': {
      const rows = (node.content || [])
        .map(row => nodeToHtml(row, injectHeadingIds))
        .join('');
      return `<table>${rows}</table>`;
    }

    case 'tableRow': {
      const cells = (node.content || [])
        .map(cell => nodeToHtml(cell, injectHeadingIds))
        .join('');
      return `<tr>${cells}</tr>`;
    }

    case 'tableCell': {
      const content = (node.content || [])
        .map(child => nodeToHtml(child, injectHeadingIds))
        .join('');
      return `<td>${content}</td>`;
    }

    case 'tableHeader': {
      const content = (node.content || [])
        .map(child => nodeToHtml(child, injectHeadingIds))
        .join('');
      return `<th>${content}</th>`;
    }

    // ========== TEXT (should not appear at top level, but handle gracefully) ==========
    case 'text': {
      return escapeHtml(node.text || '');
    }

    // ========== UNKNOWN NODE TYPE ==========
    default: {
      // Fallback: try to render children or text
      if (node.content) {
        return (node.content as TipTapNode[])
          .map(child => nodeToHtml(child, injectHeadingIds))
          .join('');
      }
      if (node.text) {
        return escapeHtml(node.text);
      }
      return '';
    }
  }
}

/**
 * Convert inline TipTap node to HTML (text with marks)
 */
function inlineNodeToHtml(node: TipTapNode): string {
  // Base text content
  let html = node.text ? escapeHtml(node.text) : '';

  // Handle inline nodes (hard break, image, etc.)
  if (node.type === 'hardBreak') {
    return '<br>';
  }

  if (node.type === 'image') {
    const src = node.attrs?.src || '';
    const alt = node.attrs?.alt || '';
    const title = node.attrs?.title;
    return title
      ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" title="${escapeHtml(title)}">`
      : `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
  }

  // Handle nested content (for complex inline nodes)
  if (node.content && !node.text) {
    html = node.content.map(inlineNodeToHtml).join('');
  }

  // Apply marks (bold, italic, code, link, etc.)
  if (node.marks && node.marks.length > 0) {
    // Apply marks in reverse order (innermost first)
    for (const mark of [...node.marks].reverse()) {
      switch (mark.type) {
        case 'bold':
        case 'strong':
          html = `<strong>${html}</strong>`;
          break;
        case 'italic':
        case 'em':
          html = `<em>${html}</em>`;
          break;
        case 'code':
          html = `<code>${html}</code>`;
          break;
        case 'link': {
          const href = mark.attrs?.href || '#';
          const target = mark.attrs?.target;
          const rel = mark.attrs?.rel;
          let attrs = `href="${escapeHtml(href)}"`;
          if (target) attrs += ` target="${escapeHtml(target)}"`;
          if (rel) attrs += ` rel="${escapeHtml(rel)}"`;
          html = `<a ${attrs}>${html}</a>`;
          break;
        }
        case 'strike':
        case 'strikethrough':
          html = `<s>${html}</s>`;
          break;
        case 'underline':
          html = `<u>${html}</u>`;
          break;
        case 'subscript':
          html = `<sub>${html}</sub>`;
          break;
        case 'superscript':
          html = `<sup>${html}</sup>`;
          break;
        case 'highlight': {
          const color = mark.attrs?.color;
          html = color
            ? `<mark style="background-color: ${escapeHtml(color)}">${html}</mark>`
            : `<mark>${html}</mark>`;
          break;
        }
        case 'textStyle': {
          // Handle custom text styles (color, font size, etc.)
          const styles: string[] = [];
          if (mark.attrs?.color) {
            styles.push(`color: ${escapeHtml(mark.attrs.color)}`);
          }
          if (mark.attrs?.fontSize) {
            styles.push(`font-size: ${escapeHtml(mark.attrs.fontSize)}`);
          }
          if (styles.length > 0) {
            html = `<span style="${styles.join('; ')}">${html}</span>`;
          }
          break;
        }
        // Ignore unknown marks
        default:
          break;
      }
    }
  }

  return html;
}

/**
 * Extract plain text from node (for heading text extraction)
 */
function extractTextContent(node: TipTapNode): string {
  if (node.text) {
    return node.text;
  }

  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextContent).join('');
  }

  return '';
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => map[char] || char);
}

/**
 * Generate URL-safe slug from heading text (same logic as ChunkParser)
 */
function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
}
