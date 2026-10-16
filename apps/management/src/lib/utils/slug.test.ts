import { slugify, isValidSlug } from './slug';

describe('slugify', () => {
  it.each([
    ['Epoca vittoriana', 'epoca-vittoriana'],
    ['La città', 'la-citta'],
    ['  Strati   sociali  ', 'strati-sociali'],
    ['Londra 1885 - 1895', 'londra-1885-1895'],
    ['A - B', 'a-b'],
    ["L'Impero Britannico!", 'limpero-britannico'],
    ['--ciao--', 'ciao'],
    ['', ''],
    ['???', ''],
  ])('%j → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('produce sempre slug validi o stringa vuota', () => {
    for (const t of ['Come si apre un ticket?', 'PNG — personaggi non giocanti', 'Più è meglio', '1']) {
      const s = slugify(t);
      expect(s === '' || isValidSlug(s)).toBe(true);
    }
  });
});

describe('isValidSlug', () => {
  it.each(['faq', 'epoca-vittoriana', '1885'])('accetta %s', (s) => expect(isValidSlug(s)).toBe(true));
  it.each(['', 'Faq', 'a b', 'a--b', '-a', 'a-', 'città'])('rifiuta %j', (s) => expect(isValidSlug(s)).toBe(false));
});
