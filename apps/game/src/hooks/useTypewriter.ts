/**
 * useTypewriter Hook
 *
 * Reveals a string one character at a time with a variable delay (like an
 * actual typist, not a metronome), restarting whenever the input text
 * changes. Falls back to showing the full text instantly when the user
 * has `prefers-reduced-motion` enabled.
 *
 * @module hooks/useTypewriter
 * @since 2.0.0
 */

import { useEffect, useRef, useState } from 'react';

interface UseTypewriterOptions {
  /** Minimum milliseconds between two revealed characters */
  minSpeed?: number;
  /** Maximum milliseconds between two revealed characters */
  maxSpeed?: number;
  /** Called once per revealed character (e.g. to play a key-click sound) */
  onChar?: (char: string, index: number) => void;
}

interface UseTypewriterReturn {
  displayedText: string;
  isDone: boolean;
}

const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Extra pause after this character, on top of the base random delay */
function pauseAfter(char: string): number {
  if (/[.!?]/.test(char)) return 260;
  if (/[,;:]/.test(char)) return 140;
  if (/\s/.test(char)) return 50;
  return 0;
}

export function useTypewriter(
  text: string,
  { minSpeed = 18, maxSpeed = 55, onChar }: UseTypewriterOptions = {}
): UseTypewriterReturn {
  const [displayedText, setDisplayedText] = useState(prefersReducedMotion ? text : '');
  const [isDone, setIsDone] = useState(prefersReducedMotion || !text);
  const onCharRef = useRef(onChar);
  onCharRef.current = onChar;

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText(text);
      setIsDone(true);
      return;
    }

    setDisplayedText('');
    setIsDone(!text);

    if (!text) {
      return;
    }

    let index = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const revealNext = () => {
      index += 1;
      const char = text.charAt(index - 1);
      setDisplayedText(text.slice(0, index));
      onCharRef.current?.(char, index - 1);

      if (index >= text.length) {
        setIsDone(true);
        return;
      }

      const delay = minSpeed + Math.random() * (maxSpeed - minSpeed) + pauseAfter(char);
      timeoutId = setTimeout(revealNext, delay);
    };

    timeoutId = setTimeout(revealNext, minSpeed + Math.random() * (maxSpeed - minSpeed));

    return () => clearTimeout(timeoutId);
  }, [text, minSpeed, maxSpeed]);

  return { displayedText, isDone };
}
