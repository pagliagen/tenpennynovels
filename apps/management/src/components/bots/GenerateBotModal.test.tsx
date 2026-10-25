import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GenerateBotModal } from './GenerateBotModal';
import * as botsAPI from '@/lib/api/bots';
import * as locationAPI from '@/lib/api/locations';
import type { BotDesignResult, BotRow } from '@/types/api/Bot';

jest.mock('@/lib/api/bots');
jest.mock('@/lib/api/locations');
const design = botsAPI.designBot as jest.Mock;
const createBot = botsAPI.createBot as jest.Mock;
const getLocations = locationAPI.getLocations as jest.Mock;

const LOC1 = 'a'.repeat(24);
const LOC2 = 'b'.repeat(24);
const taken: BotRow[] = [{ name: 'Barnaby Finch', characterId: 'c'.repeat(24), environment: 'local', locationId: LOC2, locationName: 'The Ten Bells', file: 'b.json', active: true, playerStatus: 'approved' }];

const DRAFT = {
  character: { name: 'Martha Quill', firstName: 'Martha', surname: 'Quill', gender: 'female' as const, age: 41, apparentAge: 46, height: '1.62m', eyeColor: 'castani', hairColor: 'grigi', visibleMarks: '', physicalDescription: 'È una donna magra dal viso segnato.', publicDescription: 'Una cameriera dall\'aria stanca.' },
  persona: 'Sei una cameriera sbrigativa del locale.',
  psyche: { ocean: { O: 40, C: 75, E: 55, A: 35, N: 50 }, enneagram: { type: 6, fear: 'restare sola', desire: 'un posto sicuro' }, pad: { p: -0.1, a: 0.2, d: 0.3 } },
};
const RESULT: BotDesignResult = { draft: DRAFT, checks: [{ code: 'schema', ok: true }, { code: 'anachronism', ok: false, detail: 'lavatrice' }], attempts: 1, ms: 15000 };

const renderIt = () => {
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <GenerateBotModal existingBots={taken} onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
};

const fillBrief = async () => {
  await waitFor(() => expect(screen.getByRole('option', { name: 'The Rusty Anchor' })).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: LOC1 } });
  fireEvent.change(screen.getByLabelText('Chi è il bot'), { target: { value: 'una cameriera sbrigativa, vedova' } });
};

beforeEach(() => {
  design.mockReset();
  createBot.mockReset();
  getLocations.mockResolvedValue({ result: true, data: { locations: [{ id: LOC1, name: 'The Rusty Anchor' }, { id: LOC2, name: 'The Ten Bells' }], pagination: { page: 1, totalPages: 1, totalItems: 2, pageSize: 200, hasNextPage: false, hasPrevPage: false } } });
});

describe('GenerateBotModal', () => {
  it('propone solo le location senza bot e abilita «Genera» con location e almeno una frase', async () => {
    renderIt();
    await waitFor(() => expect(screen.getByRole('option', { name: 'The Rusty Anchor' })).toBeTruthy());
    expect(screen.queryByRole('option', { name: 'The Ten Bells' })).toBeNull();
    const generate = screen.getByRole('button', { name: /Genera$/ }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: LOC1 } });
    fireEvent.change(screen.getByLabelText('Chi è il bot'), { target: { value: 'troppo corta' } });
    expect(generate.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Chi è il bot'), { target: { value: 'una cameriera sbrigativa, vedova' } });
    expect(generate.disabled).toBe(false);
  });

  it('genera, mostra gli avvisi dei controlli e la bozza modificabile; il nome segue nome e cognome', async () => {
    design.mockResolvedValue(RESULT);
    renderIt();
    await fillBrief();
    fireEvent.click(screen.getByRole('button', { name: /Genera$/ }));
    await waitFor(() => expect(screen.getByDisplayValue('Sei una cameriera sbrigativa del locale.')).toBeTruthy());
    expect(design).toHaveBeenCalledWith({ locationId: LOC1, description: 'una cameriera sbrigativa, vedova' }, expect.any(Object));
    expect(screen.getByText(/Anacronismi: lavatrice/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Cognome'), { target: { value: 'Brandt' } });
    createBot.mockResolvedValue({ characterId: 'd'.repeat(24), file: 'martha-brandt.json', reloaded: true });
    fireEvent.click(screen.getByRole('button', { name: 'Crea bot' }));
    await waitFor(() => expect(createBot).toHaveBeenCalled());
    const sent = createBot.mock.calls[0]![0] as { locationId: string; draft: typeof DRAFT };
    expect(sent.locationId).toBe(LOC1);
    expect(sent.draft.character.name).toBe('Martha Brandt');
    expect(sent.draft.character.surname).toBe('Brandt');
  });

  it('senza una scheda leggibile non si può creare', async () => {
    design.mockResolvedValue({ draft: null, checks: [{ code: 'schema', ok: false, detail: 'character.name: troppo corto' }], attempts: 2, ms: 40000 });
    renderIt();
    await fillBrief();
    fireEvent.click(screen.getByRole('button', { name: /Genera$/ }));
    await waitFor(() => expect(screen.getByText(/non ha prodotto una scheda leggibile/)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Crea bot' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('un errore del server resta nel passo 1 e lo mostra; se la creazione fallisce non chiude', async () => {
    design.mockRejectedValueOnce(new Error('Questa location ha già un bot.'));
    const onClose = renderIt();
    await fillBrief();
    fireEvent.click(screen.getByRole('button', { name: /Genera$/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/già un bot/));

    design.mockResolvedValue(RESULT);
    createBot.mockRejectedValue(new Error('«Martha Quill» è già il nome di un personaggio'));
    fireEvent.click(screen.getByRole('button', { name: /Genera$/ }));
    await waitFor(() => screen.getByRole('button', { name: 'Crea bot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crea bot' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/già il nome/));
    expect(onClose).not.toHaveBeenCalled();
  });
});
