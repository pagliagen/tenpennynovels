import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PositionsAiSuggest } from './PositionsAiSuggest';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';
import * as editorialAPI from '@/lib/api/editorial';

jest.mock('@/lib/api/editorial');
const suggest = editorialAPI.suggestLocationPositions as jest.Mock;

const ctx = { name: 'The George Inn', description: '', tags: ['taverna'] };
const current = [{ name: 'Ingresso', image: '', description: 'Dove si entra.' }];

const renderIt = (props: Partial<React.ComponentProps<typeof PositionsAiSuggest>> = {}) => {
  const onChange = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PositionsAiSuggest context={ctx} positions={current} onChange={onChange} {...props} />
    </QueryClientProvider>
  );
  return onChange;
};

beforeEach(() => {
  suggest.mockReset();
  useFeatureFlagsStore.setState({ editorialAiEnabled: true });
});

describe('PositionsAiSuggest', () => {
  it('con l\'AI spenta non compare', () => {
    useFeatureFlagsStore.setState({ editorialAiEnabled: false });
    renderIt();
    expect(screen.queryByText(/Genera posizioni/)).toBeNull();
  });

  it('senza tag né testo il pulsante è disabilitato e spiega perché', () => {
    renderIt({ context: { name: 'X', description: 'Una locanda.', tags: [] } });
    expect((screen.getByRole('button', { name: /Genera posizioni/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/scegli almeno un tag/)).toBeTruthy();
  });

  it('manda anche le posizioni già presenti, e «Sostituisci» le rimpiazza', async () => {
    suggest.mockResolvedValue({ positions: [{ name: 'Angolo del camino', description: 'Per parlare piano.' }], ok: true, checks: [], ms: 1 });
    const onChange = renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Genera posizioni/ }));
    await waitFor(() => expect(screen.getByText('Angolo del camino')).toBeTruthy());
    expect(suggest).toHaveBeenCalledWith(expect.objectContaining({ existing: ['Ingresso'], tags: ['taverna'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Sostituisci le attuali' }));
    expect(onChange).toHaveBeenCalledWith([{ name: 'Angolo del camino', image: '', description: 'Per parlare piano.' }]);
  });

  it('«Aggiungi» tiene le attuali e non duplica per nome', async () => {
    suggest.mockResolvedValue({ positions: [{ name: 'ingresso', description: 'Doppione.' }, { name: 'Tavolo lungo', description: 'Per i gruppi.' }], ok: true, checks: [], ms: 1 });
    const onChange = renderIt();
    fireEvent.click(screen.getByRole('button', { name: /Genera posizioni/ }));
    await waitFor(() => screen.getByText('Tavolo lungo'));
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi alle attuali' }));
    expect(onChange).toHaveBeenCalledWith([current[0], { name: 'Tavolo lungo', image: '', description: 'Per i gruppi.' }]);
  });
});
