/**
 *   cd services/unified-backend
 *   npx tsx --test src/features/documenti/utils/__tests__/gameMeta.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mentionsGameMeta, stripGameMeta } from '../gameMeta';

describe('stripGameMeta', () => {
  it('toglie le frasi di gioco e i rimandi, tiene il resto', () => {
    const good = ['La distanza fra ricchi e poveri è enorme.', 'I bassifondi sono sovraffollati e malsani.', 'I ricchi vivono a ovest.', 'Gli operai affollano l\'est.', 'Un domestico guadagna poco.', 'La borghesia teme il declino.', 'I commercianti vivono sopra le botteghe.', 'Le serve dormono in soffitta.', 'I mendicanti stazionano ai ponti.'];
    const text = `${good.slice(0, 3).join(' ')} Le differenze di classe attraversano ogni aspetto del gioco. ${good.slice(3).join(' ')} Leggi anche [APPROFONDIMENTO LINK] - [REGOLAMENTO LINK]`;
    assert.equal(stripGameMeta(text), good.join(' '));
  });

  it('un chunk fatto soprattutto di gioco non lascia niente (la «Presentazione»)', () => {
    const text = 'Ten Penny Novels è un gioco di ruolo horror. Londra è la città dei contrasti. Il gioco ha l\'impianto di una campagna investigativa. Non si chiede ai giocatori di immedesimarsi in un cittadino medio.';
    assert.equal(stripGameMeta(text), '');
  });

  it('non tocca parole simili che appartengono al mondo', () => {
    const text = 'Fuori città la campagna offre isolamento ma poco anonimato. I farmaci sono regolamentati solo in parte. Master Tom, il figlio del droghiere, consegna il pane.';
    assert.equal(stripGameMeta(text), text);
  });

  it('spezza anche le frasi attaccate (domanda e risposta senza spazio)', () => {
    const rest = 'Si sposano presto nelle classi basse. Lavorano come domestiche o sarte. Le nobili frequentano i salotti. Le borghesi gestiscono la casa. Poche studiano all\'università.';
    assert.equal(stripGameMeta(`Le donne sono giocabili quanto gli uomini?Sì. ${rest}`), `Sì. ${rest}`);
  });
});

describe('mentionsGameMeta', () => {
  it('riconosce il gioco e i giocatori, ma non il contado né Master Tom', () => {
    assert.equal(mentionsGameMeta('I giocatori creano un personaggio.'), true);
    assert.equal(mentionsGameMeta('Il master decide la scena.'), true);
    assert.equal(mentionsGameMeta('Fuori città la campagna offre isolamento.'), false);
    assert.equal(mentionsGameMeta('Master Tom consegna il pane.'), false);
  });
});
