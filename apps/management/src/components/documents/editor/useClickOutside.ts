import { useEffect, useRef } from 'react';

/** Chiama `onOutside` quando si preme fuori dall'elemento a cui è collegato il ref. */
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOutside]);

  return ref;
}
