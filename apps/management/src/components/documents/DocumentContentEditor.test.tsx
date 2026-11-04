/**
 * Toolbar dell'editor documenti: dimensione del carattere a gradini, stile del
 * paragrafo, colore, link, tabella, barra di stato. L'editor TipTap gira per
 * davvero in jsdom; `.ProseMirror.editor` è il riferimento che TipTap stesso
 * lascia sul DOM e serve ai test per posizionare la selezione.
 */
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import type { Editor } from '@tiptap/react';

import { DocumentContentEditor } from './DocumentContentEditor';

type Json = { type: string; attrs?: Record<string, unknown>; marks?: Array<{ type: string; attrs?: Record<string, unknown> }>; content?: Json[]; text?: string };

const paragraph = (text: string, marks?: Json['marks']): Json => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });
const doc = (...nodes: Json[]) => ({ type: 'doc', content: nodes });

beforeAll(() => {
  // ProseMirror usa API di layout che jsdom non implementa.
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

function setup(content: Json, props: Partial<React.ComponentProps<typeof DocumentContentEditor>> = {}) {
  const onChange = jest.fn();
  render(<DocumentContentEditor contentDelta={content} onChange={onChange} {...props} />);
  const pm = document.querySelector('.ProseMirror') as (HTMLElement & { editor: Editor }) | null;
  if (!pm) throw new Error('editor non montato');
  const lastJson = (): Json => onChange.mock.calls.at(-1)?.[0] as Json;
  const marksOf = (json: Json): Array<{ type: string; attrs?: Record<string, unknown> }> => json.content?.[0]?.content?.[0]?.marks ?? [];
  return { editor: pm.editor, onChange, lastJson, marksOf };
}

const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

describe('DocumentContentEditor — dimensione del carattere', () => {
  it('offre i cinque gradini, con Normale selezionato di default', () => {
    setup(doc(paragraph('testo')));
    const options = within(select('Dimensione del carattere')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Piccolo', 'Normale', 'Grande', 'Più grande', 'Enorme']);
    expect(select('Dimensione del carattere').value).toBe('');
  });

  it('applica la dimensione scelta come mark textStyle', () => {
    const { editor, lastJson, marksOf } = setup(doc(paragraph('testo')));
    act(() => { editor.commands.selectAll(); });

    fireEvent.change(select('Dimensione del carattere'), { target: { value: '1.5em' } });

    expect(marksOf(lastJson())).toEqual([{ type: 'textStyle', attrs: expect.objectContaining({ fontSize: '1.5em' }) }]);
  });

  it('"Normale" toglie la dimensione', () => {
    const { editor, lastJson, marksOf } = setup(doc(paragraph('testo', [{ type: 'textStyle', attrs: { fontSize: '2em' } }])));
    act(() => { editor.commands.selectAll(); });

    fireEvent.change(select('Dimensione del carattere'), { target: { value: '' } });

    expect(JSON.stringify(marksOf(lastJson()))).not.toContain('fontSize":"2em');
  });

  it('con il cursore dentro testo grande il menu mostra quel gradino', () => {
    const { editor } = setup(doc(paragraph('testo', [{ type: 'textStyle', attrs: { fontSize: '1.2em' } }])));
    act(() => { editor.commands.setTextSelection(2); });

    expect(select('Dimensione del carattere').value).toBe('1.2em');
  });

  it('una misura fuori scala (documenti vecchi) si mostra come "Personalizzata", non si perde', () => {
    const { editor } = setup(doc(paragraph('testo', [{ type: 'textStyle', attrs: { fontSize: '18px' } }])));
    act(() => { editor.commands.setTextSelection(2); });

    expect(select('Dimensione del carattere').value).toBe('__custom');
    expect(screen.getByRole('option', { name: 'Personalizzata' })).toBeTruthy();
  });
});

describe('DocumentContentEditor — stile del paragrafo', () => {
  it('Titolo 2 e ritorno a Paragrafo', () => {
    const { editor, lastJson } = setup(doc(paragraph('Un titolo')));
    act(() => { editor.commands.setTextSelection(2); });

    fireEvent.change(select('Stile del paragrafo'), { target: { value: 'h2' } });
    expect(lastJson().content?.[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } });

    fireEvent.change(select('Stile del paragrafo'), { target: { value: 'p' } });
    expect(lastJson().content?.[0]?.type).toBe('paragraph');
  });

  it('non offre H1: è riservato al titolo del documento', () => {
    setup(doc(paragraph('x')));
    const labels = within(select('Stile del paragrafo')).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Paragrafo', 'Titolo 2', 'Titolo 3']);
  });
});

describe('DocumentContentEditor — colore', () => {
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'Colore del testo' }));

  it('un colore della griglia viene applicato alla selezione', () => {
    const { editor, lastJson, marksOf } = setup(doc(paragraph('testo')));
    act(() => { editor.commands.selectAll(); });
    open();

    fireEvent.click(screen.getAllByTitle('#8b1a1a')[0] as HTMLElement);

    expect(marksOf(lastJson())).toEqual([{ type: 'textStyle', attrs: expect.objectContaining({ color: '#8b1a1a' }) }]);
  });

  it('"Nessun colore" lo toglie', () => {
    const { editor, lastJson, marksOf } = setup(doc(paragraph('testo', [{ type: 'textStyle', attrs: { color: '#8b1a1a' } }])));
    act(() => { editor.commands.selectAll(); });
    open();

    fireEvent.click(screen.getByText('Nessun colore'));

    expect(JSON.stringify(marksOf(lastJson()))).not.toContain('#8b1a1a');
  });

  it('la griglia ha 70 colori + tema; i recenti compaiono dopo l\'uso', () => {
    window.localStorage.clear();
    const { editor } = setup(doc(paragraph('testo')));
    act(() => { editor.commands.selectAll(); });
    open();
    expect(screen.queryByText('Usati di recente')).toBeNull();

    fireEvent.click(screen.getAllByTitle('#8b1a1a')[0] as HTMLElement);

    expect(screen.getByText('Usati di recente')).toBeTruthy();
  });

  it('"Rimuovi i colori" senza selezione agisce su tutto il documento e non lo seleziona', () => {
    const { editor, lastJson } = setup(doc(paragraph('uno', [{ type: 'textStyle', attrs: { color: '#8b1a1a' } }]), paragraph('due', [{ type: 'highlight', attrs: { color: '#f3e3a0' } }])));
    act(() => { editor.commands.setTextSelection(2); });
    open();

    fireEvent.click(screen.getByText(/Rimuovi i colori dalla selezione/));

    const json = JSON.stringify(lastJson());
    expect(json).not.toContain('#8b1a1a');
    expect(json).not.toContain('highlight');
    expect(editor.state.selection.empty).toBe(true);
  });
});

describe('DocumentContentEditor — link, tabella, stato', () => {
  it('il link si inserisce da un popover e si rimuove', () => {
    const { editor, lastJson, marksOf } = setup(doc(paragraph('testo')));
    act(() => { editor.commands.selectAll(); });

    fireEvent.click(screen.getByRole('button', { name: 'Inserisci link' }));
    fireEvent.change(screen.getByPlaceholderText('https://'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByText('Applica'));
    expect(marksOf(lastJson())).toEqual([{ type: 'link', attrs: expect.objectContaining({ href: 'https://example.com' }) }]);

    act(() => { editor.commands.setTextSelection(2); });
    fireEvent.click(screen.getByRole('button', { name: 'Modifica o rimuovi link' }));
    fireEvent.click(screen.getByText('Rimuovi link'));
    expect(marksOf(lastJson())).toEqual([]);
  });

  it('la barra tabella compare solo dentro una tabella', () => {
    const { editor } = setup(doc(paragraph('testo')));
    expect(screen.queryByRole('toolbar', { name: 'Strumenti tabella' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Inserisci tabella' }));
    expect(editor.isActive('table')).toBe(true);
    expect(screen.getByRole('toolbar', { name: 'Strumenti tabella' })).toBeTruthy();

    fireEvent.click(screen.getByText('Elimina tabella'));
    expect(screen.queryByRole('toolbar', { name: 'Strumenti tabella' })).toBeNull();
  });

  it('annulla/ripeti partono disabilitati e annulla si abilita dopo una modifica', () => {
    const { editor } = setup(doc(paragraph('testo')));
    const undo = screen.getByRole('button', { name: 'Annulla' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);

    act(() => { editor.commands.selectAll(); editor.commands.toggleBold(); });

    expect((screen.getByRole('button', { name: 'Annulla' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('barra di stato: parole e stato del salvataggio', () => {
    setup(doc(paragraph('una due tre')), { saveStatus: 'saving' });
    expect(screen.getByText('3 parole')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Salvataggio…');
  });

  it('in sola lettura non c\'è la toolbar', () => {
    setup(doc(paragraph('testo')), { readOnly: true });
    expect(screen.queryByRole('toolbar', { name: 'Formattazione' })).toBeNull();
  });
});
