/**
 * Riproduce il bug segnalato: "titolo⏎body" incollato da Word arriva come un
 * unico paragrafo con un `<br>` e H2 si applicava a tutto il blocco.
 */
import { Editor } from '@tiptap/core';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';

import { pasteHardBreakSplitPluginKey, PasteHardBreakSplit, toggleHeadingOnLine } from './hardBreaks';

function createEditor(content: string): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false, underline: false }),
      PasteHardBreakSplit
    ],
    content
  });
}

/** Posizione (nel documento) dell'inizio di `needle` nel testo. */
function posOf(editor: Editor, needle: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found === -1 && node.isText && node.text?.includes(needle)) {
      found = pos + (node.text?.indexOf(needle) ?? 0);
    }
  });
  if (found === -1) throw new Error(`testo "${needle}" non trovato`);
  return found;
}

describe('toggleHeadingOnLine', () => {
  it('applica H2 alla sola prima riga di un paragrafo con <br>', () => {
    const editor = createEditor('<p>Titolo<br>Body molto lungo</p>');
    const from = posOf(editor, 'Titolo');
    editor.commands.setTextSelection({ from, to: from + 'Titolo'.length });

    toggleHeadingOnLine(editor, 2);

    expect(editor.getHTML()).toBe('<h2>Titolo</h2><p>Body molto lungo</p>');
  });

  it('funziona col solo cursore dentro il titolo', () => {
    const editor = createEditor('<p>Titolo<br>Body molto lungo</p>');
    editor.commands.setTextSelection(posOf(editor, 'Titolo') + 3);

    toggleHeadingOnLine(editor, 2);

    expect(editor.getHTML()).toBe('<h2>Titolo</h2><p>Body molto lungo</p>');
  });

  it('isola una riga in mezzo, tagliando da entrambi i lati', () => {
    const editor = createEditor('<p>Prima<br>Titolo<br>Dopo</p>');
    const from = posOf(editor, 'Titolo');
    editor.commands.setTextSelection({ from, to: from + 'Titolo'.length });

    toggleHeadingOnLine(editor, 3);

    expect(editor.getHTML()).toBe('<p>Prima</p><h3>Titolo</h3><p>Dopo</p>');
  });

  it('sulla riga body di un documento già salvato come H2+<br> la riporta a paragrafo', () => {
    const editor = createEditor('<h2>Titolo<br>Body molto lungo</h2>');
    editor.commands.setTextSelection(posOf(editor, 'Body') + 2);

    toggleHeadingOnLine(editor, 2);

    // Il <p></p> finale lo aggiunge il TrailingNode di StarterKit (il documento
    // caricato finiva con un heading): non dipende da questo comando.
    expect(editor.getHTML()).toBe('<h2>Titolo</h2><p>Body molto lungo</p><p></p>');
  });

  it('non cambia il comportamento sui paragrafi separati da Invio', () => {
    const editor = createEditor('<p>Titolo</p><p>Body</p>');
    editor.commands.setTextSelection(posOf(editor, 'Titolo') + 1);

    toggleHeadingOnLine(editor, 2);

    expect(editor.getHTML()).toBe('<h2>Titolo</h2><p>Body</p>');
  });

  it('toglie l\'heading al secondo click', () => {
    const editor = createEditor('<p>Titolo<br>Body</p>');
    editor.commands.setTextSelection(posOf(editor, 'Titolo') + 1);

    toggleHeadingOnLine(editor, 2);
    toggleHeadingOnLine(editor, 2);

    expect(editor.getHTML()).toBe('<p>Titolo</p><p>Body</p>');
  });
});

describe('PasteHardBreakSplit', () => {
  function pasteHtml(editor: Editor, html: string): string[] {
    const container = document.createElement('div');
    container.innerHTML = html;
    const parsed = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(container);

    const plugin = pasteHardBreakSplitPluginKey.get(editor.state);
    if (!plugin?.props.transformPasted) throw new Error('plugin pasteHardBreakSplit non registrato');
    const slice = plugin.props.transformPasted.call(plugin, parsed, editor.view, false);

    const blocks: string[] = [];
    slice.content.forEach((node) => blocks.push(`${node.type.name}:${node.textContent}`));
    return blocks;
  }

  it('spezza <p>titolo<br>body</p> in due paragrafi', () => {
    const editor = createEditor('<p></p>');
    expect(pasteHtml(editor, '<p>Titolo<br>Body molto lungo</p>')).toEqual([
      'paragraph:Titolo',
      'paragraph:Body molto lungo'
    ]);
  });

  it('non lascia un paragrafo vuoto per un <br> finale', () => {
    const editor = createEditor('<p></p>');
    expect(pasteHtml(editor, '<p>Titolo<br></p>')).toEqual(['paragraph:Titolo']);
  });

  it('spezza anche dentro una voce di lista', () => {
    const editor = createEditor('<p></p>');
    expect(pasteHtml(editor, '<ul><li><p>Uno<br>Due</p></li></ul>')).toEqual(['bulletList:UnoDue']);
  });

  it('lascia intatto un paragrafo senza <br>', () => {
    const editor = createEditor('<p></p>');
    expect(pasteHtml(editor, '<p>Solo testo</p>')).toEqual(['paragraph:Solo testo']);
  });
});
