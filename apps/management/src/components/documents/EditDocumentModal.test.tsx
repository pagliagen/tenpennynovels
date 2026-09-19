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
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Delta = Record<string, unknown>;
const server: { doc: Record<string, unknown> | null; autosaves: Delta[]; saves: Delta[] } = { doc: null, autosaves: [], saves: [] };

jest.mock('@/lib/api/documents', () => ({
  ...jest.requireActual('@/lib/api/documents'),
  getDocumentById: jest.fn(async () => JSON.parse(JSON.stringify(server.doc))),
  autosaveDocument: jest.fn(async (_id: string, data: { contentDelta: Delta }) => {
    server.autosaves.push(data.contentDelta);
    return { lastUpdated: new Date().toISOString() };
  }),
  updateDocument: jest.fn(async (_id: string, data: { contentDelta: Delta }) => {
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
