/**
 * Estensione TipTap: ripulisce i colori dal contenuto incollato.
 *
 * Word (e Google Docs) portano con sé il colore assoluto del testo di origine
 * — tipicamente nero. Incollato nell'editor del forum, che ha fondo scuro, il
 * testo diventa illeggibile; e al submit `ForumContentSanitizer` scarta
 * comunque qualunque colore fuori dalla palette (`ALLOWED_COLORS`), quindi il
 * nero di Word non sopravvive alla pubblicazione. Rimuoverlo all'incolla
 * rende l'editor onesto: quello che vedi è quello che verrà salvato.
 *
 * Si rimuove il colore, non lo si forza a bianco: un bianco hardcoded non
 * sarebbe nella palette e verrebbe scartato dal sanitizer lato server.
 *
 * ⚠️ Copia gemella di `apps/management/src/lib/tiptap/pasteColorCleanup.ts`:
 * niente npm workspace, il file non è condivisibile. Modificare entrambe.
 */
import { Extension } from '@tiptap/core';
import type { Mark, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/** Chiave del plugin: esportata per poterlo recuperare nei test. */
export const pasteColorCleanupPluginKey = new PluginKey('pasteColorCleanup');

/** Mark rimossi in blocco: esistono solo per trasportare un colore. */
const DROPPED_MARKS = new Set(['highlight']);

/**
 * Azzera ogni attributo "colore" del mark. Se non resta alcun attributo
 * valorizzato il mark viene scartato del tutto, per non lasciare uno `<span>`
 * vuoto nel documento.
 */
function stripColorAttributes(mark: Mark): Mark | null {
  const attrs: Record<string, unknown> = {};
  let hasOtherValue = false;

  for (const [key, value] of Object.entries(mark.attrs)) {
    if (/color/i.test(key)) {
      attrs[key] = null;
      continue;
    }
    attrs[key] = value;
    if (value !== null && value !== undefined) {
      hasOtherValue = true;
    }
  }

  return hasOtherValue ? mark.type.create(attrs) : null;
}

function cleanMarks(marks: readonly Mark[]): Mark[] {
  const cleaned: Mark[] = [];

  for (const mark of marks) {
    if (DROPPED_MARKS.has(mark.type.name)) continue;

    const hasColorAttribute = Object.keys(mark.attrs).some((key) => /color/i.test(key));
    if (!hasColorAttribute) {
      cleaned.push(mark);
      continue;
    }

    const stripped = stripColorAttributes(mark);
    if (stripped) cleaned.push(stripped);
  }

  return cleaned;
}

function cleanFragment(fragment: Fragment): Fragment {
  const nodes: ProseMirrorNode[] = [];

  fragment.forEach((node) => {
    const withCleanContent = node.isText ? node : node.copy(cleanFragment(node.content));
    nodes.push(withCleanContent.mark(cleanMarks(node.marks)));
  });

  return Fragment.fromArray(nodes);
}

export const PasteColorCleanup = Extension.create({
  name: 'pasteColorCleanup',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pasteColorCleanupPluginKey,
        props: {
          transformPasted: (slice) =>
            new Slice(cleanFragment(slice.content), slice.openStart, slice.openEnd)
        }
      })
    ];
  }
});
