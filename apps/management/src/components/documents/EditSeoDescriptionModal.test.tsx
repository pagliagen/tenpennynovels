import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditSeoDescriptionModal, seoLengthHint } from './EditSeoDescriptionModal';
import * as documentsAPI from '@/lib/api/documents';
import type { SeoDocument } from '@/types/api/Document';

jest.mock('@/lib/api/documents');
const updateSeo = documentsAPI.updateSeoDescription as jest.Mock;

const doc: SeoDocument = { _id: 'd1', title: 'Lore', slug: 'lore', type: 'ambientazione', path: '/ambientazione/lore', description: '' };

const renderIt = (document: SeoDocument | null = doc) => {
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditSeoDescriptionModal document={document} onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
};

describe('seoLengthHint', () => {
  it('dice se la lunghezza è quella consigliata', () => {
    expect(seoLengthHint(0).ok).toBe(false);
    expect(seoLengthHint(80).ok).toBe(false);
    expect(seoLengthHint(80).text).toMatch(/corta/);
    expect(seoLengthHint(150).ok).toBe(true);
    expect(seoLengthHint(190).ok).toBe(false);
    expect(seoLengthHint(190).text).toMatch(/tagliano/);
  });
});

describe('EditSeoDescriptionModal', () => {
  beforeEach(() => updateSeo.mockReset());

  it('senza documento non rende nulla', () => {
    renderIt(null);
    expect(screen.queryByText(/Descrizione SEO:/)).toBeNull();
  });

  it('«Salva» è disabilitato finché non cambia nulla, poi salva il testo ripulito e chiude', async () => {
    updateSeo.mockResolvedValue({ _id: 'd1', description: 'Una descrizione.', previous: '' });
    const onClose = renderIt();
    const save = screen.getByRole('button', { name: 'Salva' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Una descrizione.  ' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateSeo).toHaveBeenCalledWith('d1', 'Una descrizione.');
  });

  it('se il salvataggio fallisce non chiude', async () => {
    updateSeo.mockRejectedValue(new Error('Errore nel salvataggio'));
    const onClose = renderIt();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Qualcosa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(updateSeo).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
