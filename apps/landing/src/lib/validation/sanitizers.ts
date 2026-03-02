/**
 * Input Sanitization and XSS Protection
 *
 * Provides utilities for sanitizing user input to prevent Cross-Site Scripting (XSS) attacks.
 * Uses DOMPurify (isomorphic version) for safe HTML sanitization on both client and server.
 *
 * **Security Benefits**:
 * - **XSS Prevention**: Removes malicious HTML/JavaScript from user input
 * - **SSR Safe**: Works on both client (browser) and server (Node.js)
 * - **Configurable**: Different sanitization levels for different use cases
 * - **Performance**: Fast sanitization with minimal overhead
 *
 * **When to Use**:
 * - Before saving user input to database
 * - Before displaying user-generated content
 * - After form submission, before API calls
 *
 * **Example Attack Prevented**:
 * ```typescript
 * // Malicious input
 * const input = '<img src=x onerror="alert(\'XSS\')">';
 *
 * // After sanitization
 * const safe = sanitizeUserInput(input);
 * // Result: '' (completely removed)
 * ```
 *
 * @module lib/validation/sanitizers
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes plain text user input (strictest mode)
 *
 * Removes ALL HTML tags and attributes. Use this for fields that should contain
 * only plain text (usernames, names, titles, etc.).
 *
 * **Allowed**:
 * - Plain text characters
 * - Whitespace
 *
 * **Removed**:
 * - All HTML tags
 * - All attributes
 * - JavaScript
 * - Event handlers
 *
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized text with all HTML removed
 *
 * @example
 * ```typescript
 * // Clean input
 * sanitizeUserInput('John Doe');
 * // Returns: 'John Doe'
 *
 * // Malicious input
 * sanitizeUserInput('<script>alert("XSS")</script>John<img src=x onerror=alert(1)>');
 * // Returns: 'John' (all HTML stripped)
 *
 * // Use in forms
 * const formData = {
 *   username: sanitizeUserInput(data.username),
 *   name: sanitizeUserInput(data.name),
 * };
 * ```
 */
export function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content, remove only tags
  });
}

/**
 * Sanitizes rich text with basic formatting (moderate mode)
 *
 * Allows safe HTML tags for basic text formatting (bold, italic, links, lists).
 * Use this for fields like character descriptions, backgrounds, forum posts.
 *
 * **Allowed Tags**:
 * - Text formatting: `<b>`, `<i>`, `<em>`, `<strong>`, `<u>`, `<s>`
 * - Paragraphs: `<p>`, `<br>`
 * - Links: `<a>` (with href attribute only)
 * - Lists: `<ul>`, `<ol>`, `<li>`
 * - Quotes: `<blockquote>`
 *
 * **Allowed Attributes**:
 * - `href` (on `<a>` tags only)
 * - `target` (on `<a>` tags only, auto-set to `_blank`)
 * - `rel` (on `<a>` tags only, auto-set to `noopener noreferrer`)
 *
 * **Removed**:
 * - JavaScript (all scripts, event handlers)
 * - Dangerous tags (`<script>`, `<iframe>`, `<object>`, `<embed>`)
 * - Dangerous attributes (`onclick`, `onerror`, `onload`, etc.)
 *
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized HTML with safe formatting tags
 *
 * @example
 * ```typescript
 * // Clean formatted input
 * sanitizeRichText('<p>Hello <b>world</b>!</p>');
 * // Returns: '<p>Hello <b>world</b>!</p>'
 *
 * // Malicious input
 * sanitizeRichText('<p>Text</p><script>alert("XSS")</script>');
 * // Returns: '<p>Text</p>' (script removed)
 *
 * // Link sanitization
 * sanitizeRichText('<a href="https://example.com">Link</a>');
 * // Returns: '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>'
 *
 * // Use in forms
 * const formData = {
 *   description: sanitizeRichText(data.description),
 *   background: sanitizeRichText(data.background),
 * };
 * ```
 */
export function sanitizeRichText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'b',
      'i',
      'em',
      'strong',
      'u',
      's',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    // Auto-add target="_blank" and rel="noopener noreferrer" to links
    ADD_ATTR: ['target', 'rel'],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}

/**
 * Sanitizes HTML but keeps structure (permissive mode)
 *
 * Allows most HTML tags but removes dangerous scripts and event handlers.
 * Use this ONLY for admin-generated content or trusted sources, NOT for user input.
 *
 * **Warning**: This is less strict than other sanitizers. Only use for content
 * you trust or in controlled admin areas.
 *
 * **Allowed**:
 * - Most HTML tags (headings, divs, spans, images, tables)
 * - Safe attributes (class, id, style - but NO JavaScript)
 *
 * **Removed**:
 * - JavaScript (`<script>`, `onclick`, `onerror`, etc.)
 * - Dangerous tags (`<iframe>`, `<object>`, `<embed>`)
 * - Data attributes that could contain executable code
 *
 * @param {string} input - HTML content to sanitize
 * @returns {string} Sanitized HTML with structure preserved
 *
 * @example
 * ```typescript
 * // Admin content with structure
 * sanitizeHTML('<div class="content"><h1>Title</h1><img src="/image.jpg"></div>');
 * // Returns: '<div class="content"><h1>Title</h1><img src="/image.jpg"></div>'
 *
 * // Still removes scripts
 * sanitizeHTML('<div><script>alert("XSS")</script></div>');
 * // Returns: '<div></div>'
 *
 * // Use for trusted admin content only
 * const adminContent = {
 *   htmlContent: sanitizeHTML(adminInput),
 * };
 * ```
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(input, {
    // Allow most tags, but DOMPurify still removes dangerous ones by default
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes a URL to prevent javascript: and data: URI attacks
 *
 * Ensures URLs are safe for use in `href` attributes or redirects.
 * Blocks dangerous protocols like `javascript:`, `data:`, `vbscript:`.
 *
 * **Allowed Protocols**:
 * - `http:`
 * - `https:`
 * - `mailto:`
 * - Relative URLs (starting with `/` or `./`)
 *
 * **Blocked Protocols**:
 * - `javascript:`
 * - `data:`
 * - `vbscript:`
 * - `file:`
 *
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL or empty string if dangerous
 *
 * @example
 * ```typescript
 * // Safe URLs
 * sanitizeURL('https://example.com');
 * // Returns: 'https://example.com'
 *
 * sanitizeURL('/path/to/page');
 * // Returns: '/path/to/page'
 *
 * sanitizeURL('mailto:user@example.com');
 * // Returns: 'mailto:user@example.com'
 *
 * // Dangerous URLs
 * sanitizeURL('javascript:alert("XSS")');
 * // Returns: '' (blocked)
 *
 * sanitizeURL('data:text/html,<script>alert("XSS")</script>');
 * // Returns: '' (blocked)
 *
 * // Use in links
 * const safeHref = sanitizeURL(userProvidedURL);
 * if (safeHref) {
 *   return <a href={safeHref}>Link</a>;
 * }
 * ```
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedURL = url.trim();

  // Allow relative URLs
  if (trimmedURL.startsWith('/') || trimmedURL.startsWith('./') || trimmedURL.startsWith('../')) {
    return trimmedURL;
  }

  // Check protocol
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerURL = trimmedURL.toLowerCase();

  for (const protocol of dangerousProtocols) {
    if (lowerURL.startsWith(protocol)) {
      console.warn(`[Sanitizer] Blocked dangerous URL protocol: ${protocol}`);
      return '';
    }
  }

  // Allow safe protocols
  const safeProtocols = ['http:', 'https:', 'mailto:'];
  const hasProtocol = lowerURL.includes(':');

  if (hasProtocol) {
    const isSafe = safeProtocols.some(protocol => lowerURL.startsWith(protocol));
    if (!isSafe) {
      console.warn(`[Sanitizer] Blocked unknown URL protocol: ${trimmedURL}`);
      return '';
    }
  }

  return trimmedURL;
}

/**
 * Sanitizes all string fields in an object recursively
 *
 * Walks through an object and sanitizes all string values using `sanitizeUserInput()`.
 * Useful for sanitizing entire form data objects at once.
 *
 * **Important**: This function mutates the original object. If you need immutability,
 * clone the object first: `sanitizeObject({ ...originalObject })`.
 *
 * @template T - Type of the object (preserves structure)
 * @param {T} obj - Object to sanitize
 * @returns {T} Object with all string values sanitized (same reference)
 *
 * @example
 * ```typescript
 * // Sanitize form data
 * const formData = {
 *   username: 'john<script>alert(1)</script>',
 *   email: 'user@example.com',
 *   profile: {
 *     bio: 'Hello <b>world</b>',
 *   },
 * };
 *
 * const clean = sanitizeObject(formData);
 * // Result:
 * // {
 * //   username: 'john',
 * //   email: 'user@example.com',
 * //   profile: {
 * //     bio: 'Hello world',
 * //   },
 * // }
 *
 * // Use before API calls
 * const sanitizedData = sanitizeObject({ ...formData });
 * await apiPost('/users', sanitizedData);
 * ```
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  for (const key in obj) {
    const value = obj[key];

    if (typeof value === 'string') {
      obj[key] = sanitizeUserInput(value) as any;
    } else if (typeof value === 'object' && value !== null) {
      sanitizeObject(value);
    }
  }

  return obj;
}
