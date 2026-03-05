/**
 * ChunkParser Service
 *
 * Parses TipTap Delta JSON and extracts semantic chunks (H2 sections).
 * Converts formatted content → plain text for embeddings.
 *
 * Usage:
 *   const chunks = parseChunks(contentDelta);
 *   // Returns array of ParsedChunk with heading, slug, content (plain text)
 */

import slugify from 'slugify';

export interface ParsedChunk {
  heading: string;        // "Le abitazioni"
  slug: string;           // "le-abitazioni" (kebab-case, URL-safe)
  content: string;        // Plain text (NO formatting)
  headingLevel: 2 | 3;    // H2 + H3 (H1 reserved for document title)
  order: number;          // 0, 1, 2...
  parentSlug?: string;    // For H3: reference to parent H2 slug
}

interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  text?: string;
  marks?: any[];
}

interface TipTapDelta {
  type: 'doc';
  content?: TipTapNode[];
}

/**
 * Main parser function - extracts chunks from TipTap Delta JSON
 */
export function parseChunks(contentDelta: any): ParsedChunk[] {
  return parseDeltaChunks(contentDelta);
}

/**
 * Parse TipTap Delta JSON → semantic chunks (H2)
 */
function parseDeltaChunks(delta: TipTapDelta): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let currentChunk: Partial<ParsedChunk> | null = null;
  let chunkOrder = 0;
  let introContent = '';  // NEW: Buffer for content before first heading
  let currentH2Slug: string | null = null;  // Track current H2 for H3 parent references

  const nodes = delta.content || [];

  for (const node of nodes) {
    // Check if node is a heading (H2 only - H1 reserved for document title)
    const isHeading = node.type === 'heading';
    const level = node.attrs?.level;

    if (isHeading && level === 2) {
      // SAVE previous chunk
      if (currentChunk && currentChunk.heading) {
        chunks.push(currentChunk as ParsedChunk);
      }

      // If we have accumulated intro content, create a separate chunk for it FIRST
      if (introContent.trim() && chunks.length === 0) {
        chunks.push({
          heading: '',  // EMPTY - content before first heading has NO title
          slug: 'intro-content',
          content: introContent.trim(),
          headingLevel: 2,
          order: chunkOrder++
        });
        introContent = '';  // Clear buffer
      }

      // START new chunk
      const headingText = extractTextFromNode(node).trim();
      const slug = generateSlug(headingText);
      currentH2Slug = slug;  // Track current H2 for H3 parent references

      currentChunk = {
        heading: headingText,
        slug: slug,
        content: '',  // Start with empty content (intro already saved separately)
        headingLevel: level,
        order: chunkOrder++
      };
    } else if (isHeading && level === 3) {
      // SAVE previous chunk (H2 or H3)
      if (currentChunk && currentChunk.heading) {
        chunks.push(currentChunk as ParsedChunk);
      }

      // START new H3 chunk
      const headingText = extractTextFromNode(node).trim();
      const slug = generateSlug(headingText);

      currentChunk = {
        heading: headingText,
        slug: slug,
        content: '',
        headingLevel: 3,
        order: chunkOrder++,
        parentSlug: currentH2Slug ?? undefined  // Link to parent H2
      };
    } else {
      // Extract text from node
      const text = extractTextFromNode(node);

      if (currentChunk) {
        // Accumulate content for current chunk
        if (text.trim()) {
          currentChunk.content += text + '\n';
        }
      } else {
        // No chunk yet - accumulate in pre-heading buffer
        if (text.trim()) {
          introContent += text + '\n';
        }
      }
    }
  }

  // SAVE last chunk
  if (currentChunk && currentChunk.heading) {
    // Trim final content
    if (currentChunk.content) {
      currentChunk.content = currentChunk.content.trim();
    }
    chunks.push(currentChunk as ParsedChunk);
  }

  // Fallback: no headings found → single chunk with all content
  if (chunks.length === 0) {
    const plainText = extractAllText(delta);
    if (plainText.trim()) {
      chunks.push({
        heading: 'Contenuto principale',
        slug: 'contenuto-principale',
        content: plainText.trim(),
        headingLevel: 2,
        order: 0
      });
    }
  }

  return chunks;
}

/**
 * Extract plain text from TipTap node (recursive)
 */
function extractTextFromNode(node: TipTapNode): string {
  // Direct text node
  if (node.text) {
    return node.text;
  }

  // Node with content children
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('');
  }

  // Handle specific node types
  if (node.type === 'paragraph' || node.type === 'blockquote') {
    const text = node.content ? (node.content as TipTapNode[]).map(extractTextFromNode).join('') : '';
    return text + '\n';
  }

  if (node.type === 'bulletList' || node.type === 'orderedList') {
    const items = (node.content || []) as TipTapNode[];
    return items.map(extractTextFromNode).join('\n') + '\n';
  }

  if (node.type === 'listItem') {
    const text = node.content ? (node.content as TipTapNode[]).map(extractTextFromNode).join('') : '';
    return '• ' + text;
  }

  if (node.type === 'codeBlock') {
    const text = node.content ? (node.content as TipTapNode[]).map(extractTextFromNode).join('') : '';
    return text + '\n';
  }

  if (node.type === 'horizontalRule') {
    return '\n---\n';
  }

  // Unknown node type - try to extract text anyway
  if (node.content) {
    return (node.content as TipTapNode[]).map(extractTextFromNode).join('');
  }

  return '';
}

/**
 * Extract all text from Delta (for fallback)
 */
function extractAllText(delta: TipTapDelta): string {
  const nodes = delta.content || [];
  return nodes.map(extractTextFromNode).join('\n').trim();
}

/**
 * Generate URL-safe slug from heading text
 */
function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g
  });
}
