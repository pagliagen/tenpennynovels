import sanitizeHtml from 'sanitize-html';

/**
 * ForumContentSanitizer
 *
 * Forum post/discussion content is authored by ANY player (not just admins,
 * unlike the documents module's TipTap content which is admin-only) - so
 * unlike documents, this MUST be sanitized server-side against a strict
 * allowlist before it's ever persisted. Never trust the client, even though
 * the game app's editor toolbar only exposes controls that produce allowed
 * markup: a request can always be crafted by hand.
 *
 * Palette/font-size are "predefined" per spec, not free-form: enforced here
 * via an allowlist regex on the `style` attribute, not by client-side UI
 * restraint alone.
 */

const ALLOWED_COLORS = [
  '#1a1a1a', // near-black (default text)
  '#8b0000', // burgundy
  '#1976d2', // blue
  '#2e7d32', // green
  '#d4af37', // gold
  '#616161', // grey
];

const ALLOWED_FONT_SIZES = ['12px', '14px', '16px', '18px', '24px'];

const colorPattern = new RegExp(`^(${ALLOWED_COLORS.join('|')})$`, 'i');
const fontSizePattern = new RegExp(`^(${ALLOWED_FONT_SIZES.join('|')})$`);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 'blockquote', 'p', 'br', 'span', 'img'],
  allowedAttributes: {
    span: ['style'],
    img: ['src', 'alt'],
  },
  allowedStyles: {
    span: {
      color: [colorPattern],
      'font-size': [fontSizePattern],
    },
  },
  allowedSchemesByTag: {
    img: ['https'],
  },
  // Strip anything not explicitly allowed rather than escaping it into visible text
  disallowedTagsMode: 'discard',
};

/**
 * Sanitizes forum post/discussion HTML content against the allowlist above.
 * Call on every write (create/update), never trust content already in the DB
 * as pre-sanitized when re-deriving something from it either.
 */
export function sanitizeForumHtml(raw: string): string {
  return sanitizeHtml(raw, SANITIZE_OPTIONS);
}

/**
 * Strips all markup, returning plain text - used before handing content to
 * the semantic search embedding pipeline, which expects clean text.
 */
export function stripToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}
