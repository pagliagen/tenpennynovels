/**
 * Verifica il plugin sullo schema reale dell'editor documenti: si costruisce
 * una slice a partire da HTML in stile Word e le si applica `transformPasted`,
 * esattamente quello che ProseMirror fa a ogni incolla.
 */
import { Editor } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { DOMParser as ProseMirrorDOMParser, Slice } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';

import { PasteColorCleanup, pasteColorCleanupPluginKey } from './pasteColorCleanup';

function createEditor(): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      PasteColorCleanup
    ],
    content: '<p></p>'
  });
}

/** Incolla `html` come farebbe ProseMirror e restituisce (testo, mark) per nodo. */
function pasteAndDescribe(editor: Editor, html: string): Array<{ text: string; marks: string[] }> {
  const container = document.createElement('div');
  container.innerHTML = html;

  const parsed = ProseMirrorDOMParser.fromSchema(editor.schema).parseSlice(container);
  const plugin = pasteColorCleanupPluginKey.get(editor.state);
  if (!plugin?.props.transformPasted) throw new Error('plugin pasteColorCleanup non registrato');

  // Terzo argomento: `plain` (incolla come testo semplice), qui sempre false.
  const cleaned: Slice = plugin.props.transformPasted.call(plugin, parsed, editor.view, false);

  const nodes: Array<{ text: string; marks: string[] }> = [];
  cleaned.content.descendants((node) => {
    if (node.isText) {
      nodes.push({
        text: node.text ?? '',
        marks: node.marks.map((mark) => mark.type.name)
      });
    }
  });
  return nodes;
}

describe('PasteColorCleanup', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  it('rimuove il colore del testo incollato da Word', () => {
    const nodes = pasteAndDescribe(editor, '<p><span style="color:black">Testo nero da Word</span></p>');

    expect(nodes).toEqual([{ text: 'Testo nero da Word', marks: [] }]);
  });

  it('rimuove anche i colori espressi in esadecimale', () => {
    const nodes = pasteAndDescribe(editor, '<p><span style="color:#1F1F1F">Grigio scuro</span></p>');

    expect(nodes[0]?.marks).toEqual([]);
  });

  it('scarta le evidenziazioni, che trasportano solo un colore di sfondo', () => {
    const nodes = pasteAndDescribe(
      editor,
      '<p><mark data-color="#ffff00" style="background-color:#ffff00">evidenziato</mark></p>'
    );

    expect(nodes[0]?.marks).toEqual([]);
  });

  it('conserva la formattazione non cromatica', () => {
    const nodes = pasteAndDescribe(
      editor,
      '<p><b style="color:#000000">grassetto</b> <em>corsivo</em></p>'
    );

    expect(nodes.map((n) => [n.text, n.marks])).toEqual([
      ['grassetto', ['bold']],
      [' ', []],
      ['corsivo', ['italic']]
    ]);
  });

  it('conserva i link, togliendo solo il colore che Word ci appiccica sopra', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<p><a href="https://tenpennynovels.com" style="color:#0563C1"><span style="color:#0563C1">link</span></a></p>';

    const nodes = pasteAndDescribe(editor, container.innerHTML);

    expect(nodes[0]?.marks).toEqual(['link']);
  });

  it('non tocca il contenuto già presente nel documento, solo ciò che si incolla', () => {
    editor.commands.setContent('<p><span style="color:#8b0000">scelto a mano</span></p>');

    expect(editor.getHTML()).toMatch(/color:\s*(#8b0000|rgb\(139, ?0, ?0\))/i);
  });
});
