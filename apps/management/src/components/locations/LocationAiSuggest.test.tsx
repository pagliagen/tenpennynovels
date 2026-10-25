/**
 * Il suggerimento AI non scrive mai: riempie il form solo con «Usa»/«Applica», e compare solo se
 * l'AI editoriale è attiva (flag del server + gateway raggiungibile).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const suggestions = {
  description: jest.fn(),
  tags: jest.fn(),
};

jest.mock('@/lib/api/editorial', () => ({
  ...jest.requireActual('@/lib/api/editorial'),
  suggestLocationDescription: (...args: unknown[]) => suggestions.description(...args),
  suggestLocationTags: (...args: unknown[]) => suggestions.tags(...args),
}));
jest.mock('@/lib/api/locations', () => ({
  ...jest.requireActual('@/lib/api/locations'),
  getLocationTags: jest.fn(async () => [
    { tag: 'taverna', label: 'Taverna / pub', hint: '' },
    { tag: 'alloggio', label: 'Alloggio', hint: '' },
  ]),
}));

import { LocationAiSuggest, hasEnoughText } from './LocationAiSuggest';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';

const BASE = 'Una taverna popolare frequentata da lavoratori del mercato.';

const GOOD_CHECKS = ['length', 'year', 'anachronism', 'foreign-words', 'unknown-name', 'lost-facts', 'game-meta'].map((code) => ({ code, ok: true }));

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  suggestions.description.mockReset();
  suggestions.tags.mockReset();
  useFeatureFlagsStore.setState({ editorialAiEnabled: true });
});

it('non compare se l\'AI editoriale non è attiva', () => {
  useFeatureFlagsStore.setState({ editorialAiEnabled: false });
  const { container } = wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={BASE} onApplyDescription={jest.fn()} />);
  expect(container.innerHTML).toBe('');
});

it('mostra la bozza con i controlli e la inserisce solo con «Usa», dicendo che nulla è salvato', async () => {
  suggestions.description.mockResolvedValue({ draft: 'Una taverna fumosa e affollata.', ok: true, checks: GOOD_CHECKS, sources: ['La città'], ms: 3000 });
  const onApply = jest.fn();
  wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={BASE} onApplyDescription={onApply} />);

  fireEvent.click(screen.getByRole('button', { name: /Espandi descrizione/ }));
  expect(await screen.findByText('Una taverna fumosa e affollata.')).toBeTruthy();
  expect(suggestions.description).toHaveBeenCalledWith('l1', BASE);
  expect(onApply).not.toHaveBeenCalled();
  expect(screen.getByText(/Ancorata a: La città/)).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Usa questa bozza' }));
  expect(onApply).toHaveBeenCalledWith('Una taverna fumosa e affollata.');
  expect(screen.getByText(/Nulla è stato salvato/)).toBeTruthy();
});

it('un controllo fallito si vede con il suo motivo, ma la bozza resta utilizzabile', async () => {
  suggestions.description.mockResolvedValue({
    draft: 'Una taverna nel 1889.', ok: false, sources: [], ms: 1,
    checks: GOOD_CHECKS.map((c) => (c.code === 'year' ? { ...c, ok: false, detail: 'anno 1889: il canone è 1895' } : c)),
  });
  wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={BASE} onApplyDescription={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Espandi descrizione/ }));
  expect(await screen.findByText(/anno 1889: il canone è 1895/)).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Usa questa bozza' }) as HTMLButtonElement).disabled).toBe(false);
});

it('«Scarta» toglie la bozza senza applicare nulla', async () => {
  suggestions.description.mockResolvedValue({ draft: 'Una bozza.', ok: true, checks: GOOD_CHECKS, sources: [], ms: 1 });
  const onApply = jest.fn();
  wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={BASE} onApplyDescription={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: /Espandi descrizione/ }));
  await screen.findByText('Una bozza.');
  fireEvent.click(screen.getByRole('button', { name: 'Scarta' }));
  await waitFor(() => expect(screen.queryByText('Una bozza.')).toBeNull());
  expect(onApply).not.toHaveBeenCalled();
});

it('un errore del servizio AI è mostrato in italiano', async () => {
  suggestions.description.mockRejectedValue(new Error('Il servizio AI è occupato: riprova fra poco.'));
  wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={BASE} onApplyDescription={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Espandi descrizione/ }));
  expect((await screen.findByRole('alert')).textContent).toContain('Il servizio AI è occupato');
});

it('tag: mostra le etichette e li applica solo con «Applica questi tag»', async () => {
  suggestions.tags.mockResolvedValue({ tags: ['taverna', 'alloggio'], ms: 700 });
  const onApply = jest.fn();
  wrap(<LocationAiSuggest kind="tags" locationId="l1" currentText={BASE} onApplyTags={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: /Suggerisci tag/ }));
  expect(await screen.findByText('Taverna / pub · Alloggio')).toBeTruthy();
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Applica questi tag' }));
  expect(onApply).toHaveBeenCalledWith(['taverna', 'alloggio']);
});

describe('espande ciò che è scritto, non inventa', () => {
  it('con poco o nessun testo il pulsante è disattivo e dice cosa scrivere', () => {
    for (const text of ['', '   ', 'Una strada.', 'Una taverna fumosa.']) {
      const { unmount } = wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={text} onApplyDescription={jest.fn()} />);
      expect((screen.getByRole('button', { name: /Espandi descrizione/ }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByText(/Scrivi prima almeno una frase/)).toBeTruthy();
      unmount();
    }
    expect(suggestions.description).not.toHaveBeenCalled();
  });

  it('manda il testo che c\'è nel form (anche non salvato), non una descrizione su DB', async () => {
    suggestions.description.mockResolvedValue({ draft: 'Bozza.', ok: true, checks: GOOD_CHECKS, sources: [], ms: 1 });
    const typed = 'Taverna di portuali con bancone di zinco, sempre fumosa.';
    wrap(<LocationAiSuggest kind="description" locationId="l1" currentText={typed} onApplyDescription={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Espandi descrizione/ }));
    await screen.findByText('Bozza.');
    expect(suggestions.description).toHaveBeenCalledWith('l1', typed);
  });

  it('i tag si possono chiedere anche con poco testo', () => {
    wrap(<LocationAiSuggest kind="tags" locationId="l1" currentText="" onApplyTags={jest.fn()} />);
    expect((screen.getByRole('button', { name: /Suggerisci tag/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('hasEnoughText coincide con la regola del backend (25 caratteri e 4 parole)', () => {
    expect(hasEnoughText('Una taverna popolare frequentata da lavoratori.')).toBe(true);
    expect(hasEnoughText('Una taverna fumosa.')).toBe(false);
    expect(hasEnoughText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(false);
  });
});
