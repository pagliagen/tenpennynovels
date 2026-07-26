/**
 * Message Content Parser
 *
 * Tokenizes chat message content into text/dialogue/mention segments.
 * Pure function - no React, no store access. Rendering (incl. mention
 * resolution against present occupants) happens in MessageContent.tsx.
 *
 * Syntax:
 * - `<...>` marks spoken dialogue (rendered as a styled span)
 * - `@Nome` marks a reference to a character by first name (`Character.name`
 *   has a unique index in the backend, so first-name matching is unambiguous)
 *
 * @module lib/utils/messageContentParser
 */

export type MessageToken =
  | { type: 'text'; value: string }
  | { type: 'dialogue'; value: string }
  | { type: 'mention'; name: string };

// Group 1: dialogue content between < >. Group 2: mention name (letters, apostrophe, hyphen).
const TOKEN_REGEX = /<([^<>]+)>|@([\p{L}][\p{L}'-]*)/gu;

/**
 * Tokenize raw message content into an ordered list of segments.
 *
 * @param content - Raw message content as stored in ChatMessage.content
 * @returns Ordered tokens covering the entire input (text tokens fill the gaps)
 */
export function tokenizeMessageContent(content: string): MessageToken[] {
  const tokens: MessageToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: 'dialogue', value: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'mention', name: match[2] });
    }

    lastIndex = TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < content.length) {
    tokens.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return tokens;
}
