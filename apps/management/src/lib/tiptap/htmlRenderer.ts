/**
 * Convert TipTap JSON Delta to HTML for preview
 * Uses @tiptap/html generateHTML (no React needed)
 */
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { logger } from '@/lib/logger';

/**
 * TipTap extensions (must match editor config)
 */
const extensions = [
  StarterKit.configure({
    heading: {
      levels: [2, 3]
    }
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer'
    }
  }),
  Underline,
  Image.configure({
    inline: true,
    allowBase64: true
  }),
  TextStyle,
  Color,
  Highlight.configure({
    multicolor: true
  })
];

/**
 * Convert TipTap Delta JSON to HTML string
 */
export function tiptapDeltaToHTML(delta: any): string {
  if (!delta || !delta.content) {
    return '<p>No content</p>';
  }

  try {
    return generateHTML(delta, extensions);
  } catch (error) {
    logger.error('Error converting Delta to HTML:', { error });
    return '<p>Error rendering content</p>';
  }
}
