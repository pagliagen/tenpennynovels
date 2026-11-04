import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateHtml, FONT_SIZE_CLASSES } from '../HtmlGenerator';

const doc = (marks: unknown[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ciao', marks }] }]
});

describe('HtmlGenerator: dimensione del carattere', () => {
  for (const [value, cls] of Object.entries(FONT_SIZE_CLASSES)) {
    it(`${value} → class="${cls}", senza style inline`, () => {
      const html = generateHtml(doc([{ type: 'textStyle', attrs: { fontSize: value } }]));
      assert.match(html, new RegExp(`<span class="${cls}">ciao</span>`));
      assert.doesNotMatch(html, /style=/);
    });
  }

  it('scarta valori fuori scala (es. 12pt incollato da Word)', () => {
    for (const value of ['12pt', '18px', '3em', 'larger', '1.2em; position:fixed']) {
      const html = generateHtml(doc([{ type: 'textStyle', attrs: { fontSize: value } }]));
      assert.doesNotMatch(html, /<span/, `fontSize=${value} non deve produrre uno span`);
      assert.match(html, /ciao/);
    }
  });

  it('dimensione e colore insieme: classe + style', () => {
    const html = generateHtml(doc([{ type: 'textStyle', attrs: { fontSize: '1.5em', color: '#8b1a1a' } }]));
    assert.match(html, /<span class="fs-xl" style="color: #8b1a1a">ciao<\/span>/);
  });

  it('solo colore: invariato rispetto a prima', () => {
    const html = generateHtml(doc([{ type: 'textStyle', attrs: { color: '#8b1a1a' } }]));
    assert.match(html, /<span style="color: #8b1a1a">ciao<\/span>/);
  });

  it('textStyle senza attributi non lascia span vuoti', () => {
    const html = generateHtml(doc([{ type: 'textStyle', attrs: {} }]));
    assert.doesNotMatch(html, /<span/);
  });
});
