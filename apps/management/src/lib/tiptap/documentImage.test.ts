import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { DocumentImage, isImageAlign } from './documentImage';

function createEditor(content: string | Record<string, unknown>): Editor {
  return new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit.configure({ link: false, underline: false }), DocumentImage],
    content
  });
}

function firstImage(editor: Editor): Record<string, unknown> | undefined {
  let attrs: Record<string, unknown> | undefined;
  editor.state.doc.descendants((node) => {
    if (!attrs && node.type.name === 'image') attrs = node.attrs;
  });
  return attrs;
}

describe('DocumentImage', () => {
  it('rilegge posizione e larghezza dal JSON salvato', () => {
    const editor = createEditor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'image', attrs: { src: '/a.png', align: 'right', width: 240, height: 120 } }] }]
    });
    expect(firstImage(editor)).toMatchObject({ src: '/a.png', align: 'right', width: 240, height: 120 });
    editor.destroy();
  });

  it('i documenti vecchi (senza align) restano nel testo', () => {
    const editor = createEditor('<p>prima <img src="/a.png"> dopo</p>');
    expect(firstImage(editor)).toMatchObject({ align: null, width: null });
    editor.destroy();
  });

  it('cambia posizione con updateAttributes e scarta i valori sconosciuti dall\'HTML', () => {
    const editor = createEditor('<p><img src="/a.png" data-align="top"></p>');
    expect(firstImage(editor)?.align).toBeNull();
    editor.chain().setNodeSelection(1).updateAttributes('image', { align: 'left' }).run();
    expect(firstImage(editor)?.align).toBe('left');
    expect(editor.getHTML()).toContain('data-align="left"');
    editor.destroy();
  });

  it('isImageAlign', () => {
    expect(['left', 'center', 'right'].every(isImageAlign)).toBe(true);
    expect([null, '', 'top', 1].some(isImageAlign)).toBe(false);
  });
});
