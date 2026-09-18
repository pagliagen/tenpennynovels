/**
 * Gestione dei ritorni a capo "morbidi" (`hardBreak`, il `<br>`) nell'editor
 * documenti.
 *
 * Word e Google Docs esportano "titolo⏎body" come `<p>titolo<br>body</p>`:
 * per TipTap è UN SOLO paragrafo, e `toggleHeading` trasforma l'intero blocco,
 * quindi applicare H2 al titolo rendeva H2 anche tutto il body. Due difese:
 *
 * 1. `PasteHardBreakSplit` spezza in paragrafi distinti i `<br>` incollati.
 * 2. `toggleHeadingOnLine` isola la riga selezionata prima di applicare
 *    l'heading: serve per Shift+Invio digitato a mano e per i documenti già
 *    salvati con i `<br>` dentro.
 */
import type { Editor } from '@tiptap/core';
import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';

const HARD_BREAK = 'hardBreak';

/** Chiave del plugin: esportata per poterlo recuperare nei test. */
export const pasteHardBreakSplitPluginKey = new PluginKey('pasteHardBreakSplit');

function splitParagraph(paragraph: ProseMirrorNode): ProseMirrorNode[] {
  const segments: ProseMirrorNode[][] = [[]];

  paragraph.forEach((child) => {
    if (child.type.name === HARD_BREAK) {
      segments.push([]);
    } else {
      segments[segments.length - 1]?.push(child);
    }
  });

  if (segments.length === 1) return [paragraph];

  // Un <br> finale non deve lasciare un paragrafo vuoto in coda.
  while (segments.length > 1 && segments[segments.length - 1]?.length === 0) {
    segments.pop();
  }

  return segments.map((nodes) => paragraph.type.create(paragraph.attrs, nodes, paragraph.marks));
}

/**
 * Spezza ogni paragrafo sui suoi `hardBreak`, a qualunque profondità
 * (celle di tabella e voci di lista comprese). Heading e code block restano
 * intatti.
 */
export function splitParagraphsOnHardBreaks(fragment: Fragment): Fragment {
  const nodes: ProseMirrorNode[] = [];

  fragment.forEach((node) => {
    if (node.type.name === 'paragraph') {
      nodes.push(...splitParagraph(node));
    } else if (node.isLeaf || node.isTextblock) {
      nodes.push(node);
    } else {
      nodes.push(node.copy(splitParagraphsOnHardBreaks(node.content)));
    }
  });

  return Fragment.fromArray(nodes);
}

export const PasteHardBreakSplit = Extension.create({
  name: 'pasteHardBreakSplit',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pasteHardBreakSplitPluginKey,
        props: {
          transformPasted: (slice) =>
            new Slice(splitParagraphsOnHardBreaks(slice.content), slice.openStart, slice.openEnd)
        }
      })
    ];
  }
});

/** Posizioni assolute degli `hardBreak` nel blocco di testo che contiene `$pos`. */
function hardBreakPositions($pos: ResolvedPos): number[] {
  const parent = $pos.parent;
  if (!parent.isTextblock) return [];

  const start = $pos.start();
  const positions: number[] = [];
  parent.forEach((child, offset) => {
    if (child.type.name === HARD_BREAK) positions.push(start + offset);
  });
  return positions;
}

/**
 * Spezza il blocco (o i blocchi) della selezione in modo che le righe
 * selezionate stiano da sole: taglia sull'ultimo `hardBreak` prima della
 * selezione e sul primo dopo. Modifica `tr` in place; non fa nulla se la
 * selezione non è testuale o non ci sono `hardBreak` da tagliare.
 */
export function isolateSelectedLines(tr: Transaction): void {
  const selection = tr.selection;
  if (!(selection instanceof TextSelection)) return;

  const { $from, $to, from, to, empty } = selection;

  const before = hardBreakPositions($from)
    .filter((pos) => pos + 1 <= from)
    .pop();
  const after = hardBreakPositions($to).find((pos) => pos >= to);

  const cuts = [before, after].filter((pos): pos is number => pos !== undefined);
  if (cuts.length === 0) return;

  const firstStep = tr.steps.length;

  // Dal fondo verso l'inizio, così le posizioni ancora da tagliare restano valide.
  for (const pos of cuts.sort((a, b) => b - a)) {
    tr.delete(pos, pos + 1).split(pos);
  }

  // La selezione mappata da sola non basta: un `to` che coincide col punto di
  // taglio verrebbe spinto nel paragrafo successivo e l'heading si
  // riapplicherebbe a entrambi. Si mappa `from` verso destra solo se c'è un
  // taglio a sinistra, `to` sempre verso sinistra.
  const mapping = tr.mapping.slice(firstStep);
  const newFrom = mapping.map(from, before !== undefined ? 1 : -1);
  const newTo = empty ? newFrom : mapping.map(to, -1);
  tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));
}

/** H2/H3 applicato alla sola riga selezionata, anche dentro un blocco con `<br>`. */
export function toggleHeadingOnLine(editor: Editor, level: 2 | 3): boolean {
  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (dispatch) isolateSelectedLines(tr);
      return true;
    })
    .toggleHeading({ level })
    .run();
}
