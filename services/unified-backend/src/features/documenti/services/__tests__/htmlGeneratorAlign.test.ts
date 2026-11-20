import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateHtml, ALIGN_CLASSES } from '../HtmlGenerator';

const para = (textAlign: unknown) => ({
  type: 'doc',
  content: [{ type: 'paragraph', attrs: { textAlign }, content: [{ type: 'text', text: 'ciao' }] }]
});

const heading = (textAlign: unknown) => ({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 2, textAlign }, content: [{ type: 'text', text: 'Titolo' }] }]
});

describe('HtmlGenerator: allineamento del testo', () => {
  for (const [value, cls] of Object.entries(ALIGN_CLASSES)) {
    it(`paragrafo ${value} → class="${cls}", senza style`, () => {
      const html = generateHtml(para(value));
      assert.match(html, new RegExp(`<p class="${cls}">ciao</p>`));
      assert.doesNotMatch(html, /style=/);
    });
  }

  it('sinistra, assente o valori sconosciuti → nessuna classe', () => {
    for (const value of ['left', null, undefined, 'start', 'center; color:red', 42]) {
      assert.match(generateHtml(para(value)), /<p>ciao<\/p>/, String(value));
    }
  });

  it('titolo centrato: id per l\'indice e classe insieme', () => {
    const html = generateHtml(heading('center'), { injectHeadingIds: true });
    assert.match(html, /<h2 id="titolo" class="ta-center">Titolo<\/h2>/);
  });
});
