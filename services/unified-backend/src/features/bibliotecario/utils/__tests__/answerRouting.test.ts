import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { decideRoute, notCoveredMessage, MAX_SYNTHESIS_CHUNKS, type ScoredChunk } from '../answerRouting';

// Fixture = coseni misurati su Qdrant del server il 2026-10-16 (MiniLM).
const chunk = (heading: string, vectorScore: number | undefined, documentId: string, title = ''): ScoredChunk => ({
  heading,
  content: `contenuto di ${heading || title}`,
  source: { documentId, title, fullPath: `/x/${documentId}` },
  vectorScore,
});

describe('decideRoute', () => {
  it('risposta diretta: la sezione si intitola come la domanda', () => {
    const route = decideRoute('Come si apre un ticket?', [
      chunk('', 0.619, 'd1', 'Ticket'),
      chunk('Come aprire un ticket', 0.548, 'd1', 'Ticket'),
      chunk('Chiusura e nuove richieste', 0.519, 'd1', 'Ticket'),
    ]);
    assert.deepEqual(route, { mode: 'direct', matchedHeading: 'Come aprire un ticket' });
  });

  it('"Come si gioca?" in regolamento non è diretta: "Giocate Estemporanee" condivide una sola parola', () => {
    const route = decideRoute('Come si gioca?', [
      chunk('Giocate Estemporanee', 0.448, 'd1'),
      chunk('Giocate Congelate', 0.412, 'd2'),
      chunk('Quando usarli', 0.392, 'd3'),
      chunk('Azioni', 0.358, 'd4'),
    ]);
    assert.equal(route.mode, 'synthesis');
  });

  it('"Come si gioca?" ≠ "Cosa si gioca?": le parole interrogative contano', () => {
    const route = decideRoute('Come si gioca?', [chunk('', 0.307, 'd1', 'Introduzione'), chunk('Cosa si gioca?', 0.138, 'd2')]);
    assert.notEqual(route.mode, 'direct');
  });

  it('trasversale: fino a 3 chunk da documenti diversi, mai due dello stesso', () => {
    const route = decideRoute('Dove posso giocare una quest in un posto poco frequentato?', [
      chunk('Giocate Estemporanee', 0.501, 'd1'),
      chunk('Giocate Estemporanee (2)', 0.49, 'd1'),
      chunk('Contenuto principale', 0.436, 'd2'),
      chunk('Giocate Congelate', 0.417, 'd3'),
      chunk('Quando usarli', 0.377, 'd4'),
    ]);
    assert.equal(route.mode, 'synthesis');
    if (route.mode !== 'synthesis') return;
    assert.equal(route.chunks.length, MAX_SYNTHESIS_CHUNKS);
    assert.deepEqual(route.chunks.map((c) => c.source.documentId), ['d1', 'd2', 'd3']);
  });

  it('una sola fonte debole (0.298) non basta: era la quest in ambientazione, risposta inventata', () => {
    const route = decideRoute('Dove posso giocare una quest in un posto poco frequentato?', [
      chunk('', 0.298, 'd1', 'Londra'),
      chunk('', 0.248, 'd2', 'Quartieri'),
    ]);
    assert.deepEqual(route, { mode: 'not_covered' });
  });

  it('due documenti che convergono, anche deboli, vanno in sintesi', () => {
    const route = decideRoute('Per cosa si usava il laudano?', [
      chunk('Cure, medicina e igiene', 0.31, 'd1'),
      chunk('', 0.3, 'd2', 'Farmacie'),
    ]);
    assert.equal(route.mode, 'synthesis');
  });

  it('una sola fonte forte (0.45) va in sintesi', () => {
    const route = decideRoute('Cosa succede se il mio personaggio è assente a lungo?', [
      chunk('Contenuto principale', 0.553, 'd1'),
      chunk('PNG legati ai PG', 0.331, 'd1'),
    ]);
    assert.equal(route.mode, 'synthesis');
  });

  it('non coperta: Mondiali 2006 (miglior coseno 0.252)', () => {
    const route = decideRoute('Chi ha vinto i mondiali di calcio nel 2006?', [
      chunk('Crescita demografica', 0.252, 'd1'),
      chunk('', 0.198, 'd2', 'Politica'),
    ]);
    assert.deepEqual(route, { mode: 'not_covered' });
  });

  it('non coperta: nessun risultato', () => {
    assert.deepEqual(decideRoute('Chi ha vinto i mondiali?', []), { mode: 'not_covered' });
  });

  it('un match solo keyword (nessun coseno) non basta a dichiarare la domanda coperta', () => {
    assert.deepEqual(decideRoute('Quanto guadagna un operaio?', [chunk('Donne: ruoli', undefined, 'd1')]), { mode: 'not_covered' });
  });

  it('una sola parola in comune con l\'intestazione non è risposta diretta', () => {
    const route = decideRoute('Come funziona il ticket?', [chunk('Ticket', 0.5, 'd1')]);
    assert.equal(route.mode, 'synthesis');
  });
});

describe('notCoveredMessage', () => {
  it('nomina la sezione', () => {
    assert.equal(notCoveredMessage('ambientazione'), 'Non ho trovato nulla di pertinente in Ambientazione.');
    assert.equal(notCoveredMessage('regolamento'), 'Non ho trovato nulla di pertinente in Regolamento.');
  });
  it('senza sezione', () => {
    assert.equal(notCoveredMessage(undefined), 'Non ho trovato nulla di pertinente nei documenti.');
  });
});
