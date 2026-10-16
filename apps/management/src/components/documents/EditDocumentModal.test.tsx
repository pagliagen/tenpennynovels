/**
 * Regressione perdita contenuto (2026-09-18): aprendo un documento esistente
 * l'editor emetteva un `update` durante la sincronizzazione iniziale (TipTap v3:
 * setContent emette per default), l'onChange sovrascriveva lo stato caricato con
 * un paragrafo vuoto e l'autosave lo scriveva sul DB un secondo dopo.
 *
 * Qui il "server" è in memoria: si verifica che aprire e salvare senza toccare
 * nulla non modifichi mai il contenuto e non scriva niente da solo.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Delta = Record<string, unknown>;
const server: {
  doc: Record<string, unknown> | null;
  autosaves: Delta[];
  saves: Delta[];
  /** Payload completo (non solo contentDelta) di autosave e "Salva". */
  autosavePayloads: Record<string, unknown>[];
  savePayloads: Record<string, unknown>[];
} = { doc: null, autosaves: [], saves: [], autosavePayloads: [], savePayloads: [] };

jest.mock('@/lib/api/documents', () => ({
  ...jest.requireActual('@/lib/api/documents'),
  getDocumentById: jest.fn(async () => JSON.parse(JSON.stringify(server.doc))),
  autosaveDocument: jest.fn(async (_id: string, data: { contentDelta: Delta }) => {
    server.autosavePayloads.push(data);
    server.autosaves.push(data.contentDelta);
    return { lastUpdated: new Date().toISOString() };
  }),
  updateDocument: jest.fn(async (_id: string, data: { contentDelta: Delta }) => {
    server.savePayloads.push(data);
    server.saves.push(data.contentDelta);
    return server.doc;
  }),
  getSubtypes: jest.fn(async () => []),
  getDocumentPreviewToken: jest.fn(async () => ({ token: 't', expiresAt: '' }))
}));

import { EditDocumentModal } from './EditDocumentModal';

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const heading = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeAll(() => {
  // ProseMirror usa API di layout che jsdom non implementa.
  const rect = { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => ({ item: () => null, length: 0, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

describe.each(['regolamento', 'ambientazione', 'manuale-master'])('EditDocumentModal (%s)', (type) => {
  it('non altera il contenuto né autosalva all\'apertura, e "Salva" invia il contenuto caricato', async () => {
    const original = { type: 'doc', content: [heading('Titolo'), paragraph('corpo uno'), paragraph('corpo due')] };
    server.autosaves = [];
    server.saves = [];
    server.doc = {
      _id: 'd1', type, title: 'T', lastUpdated: 'x', contentDelta: original,
      subtypeId: { _id: 's1', slug: 's', title: 'S', type }
    };

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditDocumentModal documentId="d1" isOpen onClose={jest.fn()} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(document.querySelector('.ProseMirror')?.textContent).toContain('corpo due'), { timeout: 4000 });
    // Oltre il debounce dell'autosave (1s): senza modifiche non deve partire nulla.
    await wait(1800);
    expect(server.autosaves).toHaveLength(0);

    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(server.saves).toHaveLength(1));
    expect(server.saves[0]).toEqual(original);
  }, 15000);
});


/**
 * Rinomina (2026-10-16): il modal non aveva il campo slug e non lo mandava mai,
 * quindi cambiare il titolo non poteva cambiare l'URL. Ora lo slug segue il
 * titolo finché non si tocca a mano, si scrive solo con "Salva" e, se il
 * documento è pubblicato, chiede conferma.
 */
describe('EditDocumentModal — slug', () => {
  const body = { type: 'doc', content: [paragraph('corpo')] };

  const open = async (overrides: Record<string, unknown> = {}) => {
    server.autosaves = [];
    server.saves = [];
    server.autosavePayloads = [];
    server.savePayloads = [];
    server.doc = {
      _id: 'd1', type: 'ambientazione', title: 'Lore', slug: 'lore', isDraft: true, lastUpdated: 'x', contentDelta: body,
      subtypeId: { _id: 's1', slug: 'introduzione', title: 'Introduzione', type: 'ambientazione' },
      ...overrides
    };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <EditDocumentModal documentId="d1" isOpen onClose={jest.fn()} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(document.querySelector('.ProseMirror')?.textContent).toContain('corpo'), { timeout: 4000 });
    return {
      title: screen.getByLabelText('Titolo Documento') as HTMLInputElement,
      slug: screen.getByLabelText('Slug (URL)') as HTMLInputElement
    };
  };

  it('all\'apertura mostra lo slug attuale', async () => {
    const { slug } = await open();
    expect(slug.value).toBe('lore');
  }, 15000);

  it('lo slug segue il titolo', async () => {
    const { title, slug } = await open();
    fireEvent.change(title, { target: { value: 'Nuova Lore: la città' } });
    expect(slug.value).toBe('nuova-lore-la-citta');
  }, 15000);

  it('titolo svuotato: lo slug non diventa vuoto', async () => {
    const { title, slug } = await open();
    fireEvent.change(title, { target: { value: '' } });
    expect(slug.value).toBe('lore');
  }, 15000);

  it('una modifica manuale dello slug lo sgancia dal titolo', async () => {
    const { title, slug } = await open();
    fireEvent.change(slug, { target: { value: 'indirizzo-scelto' } });
    fireEvent.change(title, { target: { value: 'Altro titolo' } });
    expect(slug.value).toBe('indirizzo-scelto');
  }, 15000);

  it('"Salva" senza toccare lo slug non lo invia', async () => {
    await open();
    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(server.savePayloads).toHaveLength(1));
    expect(server.savePayloads[0]).not.toHaveProperty('slug');
  }, 15000);

  it('bozza: "Salva" invia il nuovo slug senza chiedere conferma', async () => {
    const { title } = await open({ isDraft: true });
    fireEvent.change(title, { target: { value: 'Titolo nuovo' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByText('Salva'));
    await waitFor(() => expect(server.savePayloads).toHaveLength(1));
    expect(server.savePayloads[0]).toMatchObject({ title: 'Titolo nuovo', slug: 'titolo-nuovo' });
  }, 15000);

  it('pubblicato: avviso visibile e "Salva" aspetta la conferma', async () => {
    const { title } = await open({ isDraft: false });
    fireEvent.change(title, { target: { value: 'Titolo nuovo' } });
    expect(screen.getByRole('alert').textContent).toContain('il vecchio URL smetterà di funzionare');

    fireEvent.click(screen.getByText('Salva'));
    await screen.findByText('Cambiare l\'URL del documento?');
    expect(server.savePayloads).toHaveLength(0);

    fireEvent.click(screen.getByText('Cambia URL'));
    await waitFor(() => expect(server.savePayloads).toHaveLength(1));
    expect(server.savePayloads[0]).toMatchObject({ slug: 'titolo-nuovo' });
  }, 15000);

  it('pubblicato: annullando la conferma non salva nulla', async () => {
    const { title } = await open({ isDraft: false });
    fireEvent.change(title, { target: { value: 'Titolo nuovo' } });
    fireEvent.click(screen.getByText('Salva'));
    await screen.findByText('Cambiare l\'URL del documento?');
    fireEvent.click(within(document.querySelector('.confirmDialog') as HTMLElement).getByText('Annulla'));
    await wait(300);
    expect(server.savePayloads).toHaveLength(0);
  }, 15000);

  it('slug non valido: nessuna richiesta', async () => {
    const { slug } = await open();
    fireEvent.change(slug, { target: { value: 'Slug Non Valido' } });
    fireEvent.click(screen.getByText('Salva'));
    await wait(300);
    expect(server.savePayloads).toHaveLength(0);
  }, 15000);

  it('l\'autosave del titolo non manda mai lo slug', async () => {
    const { title } = await open();
    fireEvent.change(title, { target: { value: 'Titolo digitato' } });
    await waitFor(() => expect(server.autosavePayloads.length).toBeGreaterThan(0), { timeout: 3000 });
    expect(server.autosavePayloads[0]).toMatchObject({ title: 'Titolo digitato' });
    expect(server.autosavePayloads[0]).not.toHaveProperty('slug');
  }, 15000);
});
