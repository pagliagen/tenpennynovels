import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BotsPanel } from './BotsPanel';
import * as botsAPI from '@/lib/api/bots';
import { useFeatureFlagsStore } from '@/store/featureFlagsStore';

jest.mock('@/lib/api/bots');
jest.mock('@/hooks/api/useLocations', () => ({ useLocations: () => ({ data: undefined }) }));
const getBots = botsAPI.getBots as jest.Mock;

const row = { name: 'Arthur Sterling', characterId: 'a'.repeat(24), environment: 'production', locationId: 'b'.repeat(24), locationName: 'Borough Market', file: 'x.json', active: false, playerStatus: 'approved' };
const renderIt = () => render(<QueryClientProvider client={new QueryClient()}><BotsPanel /></QueryClientProvider>);

describe('BotsPanel', () => {
  beforeEach(() => {
    getBots.mockReset();
    useFeatureFlagsStore.setState({ botChatEnabled: false, botChatMissing: [] });
  });

  it('mostra i bot di questo ambiente e dice quanti di altri ambienti sono nascosti', async () => {
    getBots.mockResolvedValue({ bots: [row], hiddenOtherEnvironments: 2 });
    renderIt();
    await waitFor(() => expect(screen.getByText('Arthur Sterling')).toBeTruthy());
    expect(screen.getByText(/2 bot di altri ambienti non sono mostrati/)).toBeTruthy();
  });

  it('senza bot nascosti non mostra nessun avviso', async () => {
    getBots.mockResolvedValue({ bots: [row], hiddenOtherEnvironments: 0 });
    renderIt();
    await waitFor(() => expect(screen.getByText('Arthur Sterling')).toBeTruthy());
    expect(screen.queryByText(/altri ambienti/)).toBeNull();
  });

  it('con un solo bot nascosto parla al singolare; senza bot propone di crearne uno', async () => {
    getBots.mockResolvedValue({ bots: [], hiddenOtherEnvironments: 1 });
    renderIt();
    await waitFor(() => expect(screen.getByText(/1 bot di un altro ambiente non è mostrato/)).toBeTruthy());
    expect(screen.getByText(/Nessun bot ancora/)).toBeTruthy();
  });

  it('dice se la chat live è attiva, e se non lo è cosa manca (solo i nomi)', async () => {
    getBots.mockResolvedValue({ bots: [], hiddenOtherEnvironments: 0 });
    useFeatureFlagsStore.setState({ botChatEnabled: true, botChatMissing: [] });
    const { unmount } = renderIt();
    await waitFor(() => expect(screen.getByText(/Chat dei bot attiva/)).toBeTruthy());
    unmount();

    useFeatureFlagsStore.setState({ botChatEnabled: false, botChatMissing: ['BOT_REPLY_BASE_URL (https, o http solo su localhost)'] });
    renderIt();
    await waitFor(() => expect(screen.getByText(/NON attiva: manca BOT_REPLY_BASE_URL/)).toBeTruthy());
  });

  it('chat non attiva senza elenco di variabili: spenta o servizio non raggiungibile', async () => {
    getBots.mockResolvedValue({ bots: [], hiddenOtherEnvironments: 0 });
    renderIt();
    await waitFor(() => expect(screen.getByText(/spenta o servizio AI non raggiungibile/)).toBeTruthy());
  });
});
